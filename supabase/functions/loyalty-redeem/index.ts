import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
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

    const body = await req.json()
    const loyaltyAccountId = body.loyalty_account_id ?? body.loyaltyAccountId ?? body.accountId
    const rewardId = body.reward_id ?? body.rewardId ?? null
    const rewardTierId = body.reward_tier_id ?? body.rewardTierId ?? null

    if (!loyaltyAccountId || (!rewardId && !rewardTierId)) {
      return new Response(
        JSON.stringify({ error: 'Loyalty account ID and reward (or reward tier) required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Redeeming reward request for loyalty account ${loyaltyAccountId} (rewardId=${rewardId ?? 'n/a'}, rewardTierId=${rewardTierId ?? 'n/a'})`)

    // Get loyalty account details (support both DB id and Square id). Proceed even if not found in DB.
    let hasDbAccount = false
    let loyaltyAccount: any = null

    const { data: byId, error: byIdErr } = await supabase
      .from('loyalty_accounts')
      .select('*')
      .eq('id', loyaltyAccountId)
      .maybeSingle()

    if (byId) {
      loyaltyAccount = byId
      hasDbAccount = true
    } else {
      const { data: bySquare, error: bySquareErr } = await supabase
        .from('loyalty_accounts')
        .select('*')
        .eq('square_loyalty_account_id', loyaltyAccountId)
        .maybeSingle()
      if (bySquare) {
        loyaltyAccount = bySquare
        hasDbAccount = true
      }
    }

    if (!hasDbAccount) {
      console.warn('Loyalty account not found in DB; will proceed using Square account id only:', loyaltyAccountId)
    }

    // Get reward details (allow lookup by DB id or Square reward tier id)
    let reward: any = null
    if (rewardId) {
      const { data, error } = await supabase
        .from('loyalty_rewards')
        .select('*')
        .eq('id', rewardId)
        .maybeSingle()
      reward = data
      if (error) console.error('Reward lookup error by id:', error)
    }

    if (!reward && rewardTierId) {
      const { data, error } = await supabase
        .from('loyalty_rewards')
        .select('*')
        .eq('square_reward_id', rewardTierId)
        .maybeSingle()
      reward = data
      if (error) console.error('Reward lookup error by square_reward_id:', error)
    }

    if (!reward) {
      return new Response(
        JSON.stringify({ error: 'Reward not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user has enough points (only if we have a DB record)
    if (hasDbAccount && loyaltyAccount.balance < reward.points_required) {
      return new Response(
        JSON.stringify({ error: 'Insufficient points' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the environment setting from the database
    const { data: settingData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'square_environment')
      .single()

    // Normalize environment value
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

    console.log(`Using Square ${environment} environment for redemption`)

    // Step 1: Create a loyalty reward in Square
    const createRewardResponse = await fetch(`${baseUrl}/v2/loyalty/rewards`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-10-17'
      },
      body: JSON.stringify({
        idempotency_key: `reward-${Date.now()}-${Math.random()}`,
        reward: {
          loyalty_account_id: (loyaltyAccount?.square_loyalty_account_id || loyaltyAccountId),
          reward_tier_id: reward.square_reward_id
        }
      })
    })

    if (!createRewardResponse.ok) {
      const errorText = await createRewardResponse.text()
      console.error(`Square create reward API error: ${createRewardResponse.status} - ${errorText}`)
      return new Response(
        JSON.stringify({ error: 'Failed to create reward in Square' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const createRewardData = await createRewardResponse.json()
    console.log(`Square create reward response:`, JSON.stringify(createRewardData, null, 2))

    const rewardId = createRewardData.reward?.id
    if (!rewardId) {
      return new Response(
        JSON.stringify({ error: 'Failed to get reward ID from Square' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 2: Redeem the loyalty reward in Square
    const redeemResponse = await fetch(`${baseUrl}/v2/loyalty/rewards/${rewardId}/redeem`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-10-17'
      },
      body: JSON.stringify({
        idempotency_key: `redeem-${Date.now()}-${Math.random()}`,
        location_id: 'main' // You may need to get this from settings if you have multiple locations
      })
    })

    if (!redeemResponse.ok) {
      const errorText = await redeemResponse.text()
      console.error(`Square redeem API error: ${redeemResponse.status} - ${errorText}`)
      return new Response(
        JSON.stringify({ error: 'Failed to redeem reward in Square' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const redeemData = await redeemResponse.json()
    console.log(`Square redeem response:`, JSON.stringify(redeemData, null, 2))

    // Update local loyalty account balance if we have a DB record
    let newBalance: number | null = null
    if (hasDbAccount) {
      newBalance = (loyaltyAccount.balance - reward.points_required)
      const { error: updateError } = await supabase
        .from('loyalty_accounts')
        .update({ balance: newBalance })
        .eq('id', loyaltyAccount.id)

      if (updateError) {
        console.error('Error updating loyalty account balance:', updateError)
      }
    }

    // Create discount code if this is a discount reward
    let discountCode = null
    if (reward.discount_type && reward.discount_amount > 0) {
      try {
        const discountResponse = await supabase.functions.invoke('create-shopify-discount', {
          body: {
            reward_name: reward.name,
            discount_type: reward.discount_type,
            discount_amount: reward.discount_amount,
            max_discount_amount: reward.max_discount_amount,
            shopify_product_id: reward.shopify_product_id,
            shopify_product_handle: reward.shopify_product_handle,
            shopify_sku: reward.shopify_sku,
            applicable_product_names: reward.applicable_product_names
          }
        })

        if (discountResponse.data?.success) {
          discountCode = discountResponse.data.discount_code
          console.log(`Created Shopify discount code: ${discountCode}`)
        } else {
          console.error('Failed to create Shopify discount:', discountResponse.error)
        }
      } catch (discountError) {
        console.error('Error creating discount code:', discountError)
      }
    }

    // Record the redemption if we have a DB account
    if (hasDbAccount) {
      const { error: redemptionError } = await supabase
        .from('loyalty_redemptions')
        .insert({
          loyalty_account_id: loyaltyAccount.id,
          reward_id: reward.id,
          points_redeemed: reward.points_required,
          discount_code: discountCode,
          square_redemption_id: redeemData.reward?.id
        })

      if (redemptionError) {
        console.error('Error recording redemption:', redemptionError)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        new_balance: newBalance,
        discount_code: discountCode,
        discountCode: discountCode,
        message: discountCode 
          ? `Reward redeemed! Use code ${discountCode}` 
          : 'Reward redeemed successfully!'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error redeeming reward:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})