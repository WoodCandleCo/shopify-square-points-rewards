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
        
        // Extract discount information from the reward structure
        let discountType = 'UNKNOWN'
        let discountAmount = 0
        let maxDiscountAmount = null
        let description = 'Reward'

        // Check if there's a pricing rule definition
        if (reward.pricing_rule_reference) {
          console.log('Found pricing rule reference:', reward.pricing_rule_reference)
          // We'll need to fetch the actual pricing rule details
          description = `${reward.points} points reward`
        }

        // Check for direct discount definition (some loyalty programs structure it this way)
        if (reward.discount) {
          const discount = reward.discount
          if (discount.discount_type === 'FIXED_PERCENTAGE') {
            discountType = 'FIXED_PERCENTAGE'
            discountAmount = parseFloat(discount.percentage) || 0
            if (discount.max_discount_money?.amount) {
              maxDiscountAmount = discount.max_discount_money.amount
            }
            description = `${discountAmount}% off`
          } else if (discount.discount_type === 'FIXED_AMOUNT') {
            discountType = 'FIXED_AMOUNT'
            discountAmount = discount.amount_money?.amount || 0
            description = `$${(discountAmount / 100).toFixed(2)} off`
          }
        }

        // Check for definition-based structure
        if (reward.definition?.discount) {
          const discount = reward.definition.discount
          if (discount.percentage) {
            discountType = 'FIXED_PERCENTAGE'
            discountAmount = parseFloat(discount.percentage)
            if (discount.max_discount_money?.amount) {
              maxDiscountAmount = discount.max_discount_money.amount
            }
            description = `${discountAmount}% off`
          } else if (discount.amount_money?.amount) {
            discountType = 'FIXED_AMOUNT'
            discountAmount = discount.amount_money.amount
            description = `$${(discountAmount / 100).toFixed(2)} off`
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