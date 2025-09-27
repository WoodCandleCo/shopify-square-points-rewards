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

    console.log(`Processing reward redemption for account ${loyaltyAccountId}`)

    // Get reward details from database
    let reward: any = null
    if (rewardId) {
      const { data } = await supabase
        .from('loyalty_rewards')
        .select('*')
        .eq('id', rewardId)
        .single()
      reward = data
    } else if (rewardTierId) {
      const { data } = await supabase
        .from('loyalty_rewards')
        .select('*')
        .eq('square_reward_id', rewardTierId)
        .single()
      reward = data
    }

    if (!reward) {
      return new Response(
        JSON.stringify({ error: 'Reward not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get environment setting
    const { data: settingData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'square_environment')
      .single()

    let environment = 'sandbox'
    const raw = (settingData as any)?.value
    if (typeof raw === 'string') {
      try { environment = JSON.parse(raw) } catch { environment = raw }
    } else if (raw != null) {
      environment = String(raw)
    }
    environment = environment === 'production' ? 'production' : 'sandbox'
    
    const baseUrl = environment === 'production' 
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com'

    // Step 1: Create (issue) the reward in Square - this locks the points
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
          loyalty_account_id: loyaltyAccountId,
          reward_tier_id: reward.square_reward_id
        }
      })
    })

    if (!createRewardResponse.ok) {
      const errorText = await createRewardResponse.text()
      console.error(`Square create reward error: ${createRewardResponse.status} - ${errorText}`)
      return new Response(
        JSON.stringify({ error: 'Failed to create reward in Square' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const createRewardData = await createRewardResponse.json()
    const squareRewardId = createRewardData.reward?.id

    if (!squareRewardId) {
      return new Response(
        JSON.stringify({ error: 'Failed to get reward ID from Square' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Created Square reward: ${squareRewardId}`)

    // Step 2: Create Shopify discount code
    const discountResponse = await supabase.functions.invoke('create-shopify-discount', {
      body: {
        reward_id: reward.id,
        reward_name: reward.name,
        discount_type: reward.discount_type,
        discount_amount: reward.discount_amount,
        max_discount_amount: reward.max_discount_amount,
        shopify_product_id: reward.shopify_product_id,
        shopify_product_handle: reward.shopify_product_handle,
        shopify_sku: reward.shopify_sku,
        applicable_product_names: reward.applicable_product_names,
        square_reward_id: squareRewardId
      }
    })

    if (discountResponse.error) {
      console.error('Failed to create Shopify discount:', discountResponse.error)
      
      // Clean up the Square reward since discount creation failed
      try {
        await fetch(`${baseUrl}/v2/loyalty/rewards/${squareRewardId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'Square-Version': '2024-10-17'
          }
        })
        console.log(`Cleaned up Square reward ${squareRewardId}`)
      } catch (cleanupError) {
        console.error('Failed to cleanup Square reward:', cleanupError)
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to create discount code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const discountCode = discountResponse.data.discount_code

    // Step 3: Record the pending redemption in our database
    const { data: loyaltyAccount } = await supabase
      .from('loyalty_accounts')
      .select('*')
      .eq('square_loyalty_account_id', loyaltyAccountId)
      .single()

    if (loyaltyAccount) {
      await supabase
        .from('loyalty_transactions')
        .insert({
          user_id: loyaltyAccount.user_id,
          loyalty_account_id: loyaltyAccount.id,
          transaction_type: 'REDEEM',
          points: -reward.points_required,
          description: `Redeemed: ${reward.name}`,
          square_transaction_id: squareRewardId
        })
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: 'issued',
        square_reward_id: squareRewardId,
        discount_code: discountCode,
        discountCode: discountCode, // For compatibility
        message: `Reward issued! Use code: ${discountCode}`,
        instructions: 'Discount will be finalized when order is completed'
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