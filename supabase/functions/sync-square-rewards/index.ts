import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const SQUARE_ACCESS_TOKEN = Deno.env.get('SQUARE_ACCESS_TOKEN')

    if (!SQUARE_ACCESS_TOKEN) {
      throw new Error('Square access token not configured')
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the environment setting from the database
    const { data: settingData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'square_environment')
      .single()

    // Normalize environment value regardless of how it's stored
    let environment: string = 'sandbox'
    const raw = (settingData as any)?.value
    if (typeof raw === 'string') {
      try { environment = JSON.parse(raw) } catch { environment = raw }
    } else if (raw != null) {
      environment = String(raw)
    }
    environment = environment === 'production' ? 'production' : 'sandbox'
    
    // Use appropriate Square API URL based on environment
    const baseUrl = environment === 'production' 
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com'

    console.log(`Syncing rewards from Square in ${environment} environment`)

    // Get Shopify products for mapping
    const shopifyResponse = await supabase.functions.invoke('get-shopify-products')
    let shopifyProducts = []
    if (shopifyResponse.data?.success) {
      shopifyProducts = shopifyResponse.data.products || []
      console.log(`Found ${shopifyProducts.length} Shopify products for mapping`)
    } else {
      console.warn('Could not fetch Shopify products for mapping:', shopifyResponse.error)
    }

    // First, get the loyalty program ID
    const programsResponse = await fetch(`${baseUrl}/v2/loyalty/programs`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Square-Version': '2024-01-18',
        'Content-Type': 'application/json'
      }
    })

    if (!programsResponse.ok) {
      const errorText = await programsResponse.text()
      console.error(`Square API error fetching programs: ${programsResponse.status} - ${errorText}`)
      throw new Error(`Failed to fetch loyalty programs: ${programsResponse.status}`)
    }

    const programsData = await programsResponse.json()
    console.log('Programs response:', JSON.stringify(programsData, null, 2))

    if (!programsData.programs || programsData.programs.length === 0) {
      throw new Error('No loyalty programs found in Square account')
    }

    const program = programsData.programs[0]
    const rewards = program.reward_tiers || []

    console.log(`Found ${rewards.length} reward tiers`)
    console.log('Sample reward structure:', JSON.stringify(rewards[0], null, 2))

    let syncedCount = 0

    // Sync each reward to the database
    for (const reward of rewards) {
      try {
        console.log(`Processing reward:`, JSON.stringify(reward, null, 2))
        
        // Extract discount information from the reward name (since Square uses pricing rule references)
        let discountType = 'PERCENTAGE'
        let discountAmount = 0
        let maxDiscountAmount = null
        let description = reward.name || `${reward.points} points reward`

        // Parse discount info from reward name
        const rewardName = reward.name || ''
        
        // Check for percentage discounts with max amounts
        const percentageMatch = rewardName.match(/(\d+)% off.*up to \$(\d+)/i)
        if (percentageMatch) {
          discountType = 'PERCENTAGE'
          discountAmount = parseInt(percentageMatch[1])
          maxDiscountAmount = parseInt(percentageMatch[2]) * 100 // Convert to cents
        }
        // Check for simple percentage discounts
        else if (rewardName.match(/(\d+)% off/i)) {
          const match = rewardName.match(/(\d+)% off/i)
          discountType = 'PERCENTAGE'
          discountAmount = parseInt(match[1])
        }
        // Check for fixed dollar amounts
        else if (rewardName.match(/\$(\d+(?:\.\d{2})?) off/i)) {
          const match = rewardName.match(/\$(\d+(?:\.\d{2})?) off/i)
          discountType = 'FIXED_AMOUNT'
          discountAmount = Math.round(parseFloat(match[1]) * 100) // Convert to cents
        }
        // Check for free items (treat as 100% off)
        else if (rewardName.toLowerCase().startsWith('free ')) {
          discountType = 'PERCENTAGE'
          discountAmount = 100
        }

        console.log(`Parsed discount for "${rewardName}": ${discountType} - ${discountAmount}${discountType === 'PERCENTAGE' ? '%' : ' cents'}, max: ${maxDiscountAmount}`)

        // Map to Shopify products for free items
        let shopifyProductId = null
        let shopifyProductHandle = null
        let shopifySku = null
        let applicableProductNames = null

        if (discountType === 'PERCENTAGE' && discountAmount === 100) {
          // This is a free item, try to map it to Shopify products
          const rewardNameLower = rewardName.toLowerCase()
          
          // Map common reward names to loyalty tags
          const rewardMappings = {
            'free matches': 'loyalty-matches',
            'free wax melt': 'loyalty-wax-melt', 
            'free wick trimmer': 'loyalty-wick-trimmer',
            'free 7oz candle': 'loyalty-7oz-candle'
          }
          
          const loyaltyTag = rewardMappings[rewardNameLower]
          if (loyaltyTag) {
            // Find matching products by tag
            const matchingProducts = shopifyProducts.filter(product => 
              product.tags && product.tags.toLowerCase().includes(loyaltyTag)
            )
            
            if (matchingProducts.length > 0) {
              // Use the first product as the primary reference
              shopifyProductId = matchingProducts[0].id?.toString()
              shopifyProductHandle = matchingProducts[0].handle
              
              // Collect all product names for the applicable_product_names array
              applicableProductNames = matchingProducts.map(p => p.title)
              
              console.log(`Mapped "${rewardName}" to ${matchingProducts.length} products: ${applicableProductNames.join(', ')}`)
            }
          }
        }

        const rewardData = {
          square_reward_id: reward.id,
          name: reward.name || `${reward.points} Points Reward`,
          description,
          points_required: reward.points || 0,
          discount_type: discountType,
          discount_amount: discountAmount,
          max_discount_amount: maxDiscountAmount,
          shopify_product_id: shopifyProductId,
          shopify_product_handle: shopifyProductHandle,
          shopify_sku: shopifySku,
          applicable_product_names: applicableProductNames,
          is_active: true
        }

        // Upsert the reward
        const { error } = await supabase
          .from('loyalty_rewards')
          .upsert(rewardData, { 
            onConflict: 'square_reward_id' 
          })

        if (error) {
          console.error('Error upserting reward:', error)
        } else {
          syncedCount++
          console.log(`Synced reward: ${rewardData.name}`)
        }
      } catch (rewardError) {
        console.error('Error processing individual reward:', rewardError)
      }
    }

    console.log(`Successfully synced ${syncedCount} rewards`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully synced ${syncedCount} rewards from Square`,
        count: syncedCount,
        environment
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error in sync-square-rewards function:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})