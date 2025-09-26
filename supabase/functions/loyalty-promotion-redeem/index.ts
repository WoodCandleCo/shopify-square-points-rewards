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
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    const { loyaltyAccountId, promotionId, customerId } = await req.json()

    if (!loyaltyAccountId || !promotionId) {
      return new Response(
        JSON.stringify({ error: 'loyaltyAccountId and promotionId are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Get environment variables
    const SQUARE_ACCESS_TOKEN = Deno.env.get('SQUARE_ACCESS_TOKEN')
    const SHOP_NAME = Deno.env.get('SHOP_NAME')
    const SHOPIFY_ADMIN_TOKEN = Deno.env.get('SHOPIFY_ADMIN_TOKEN')

    if (!SQUARE_ACCESS_TOKEN) {
      throw new Error('Square access token not configured')
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get Square environment setting
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

    console.log(`Redeeming promotion ${promotionId} in ${environment} environment`)

    // Get promotion details
    const promotionResponse = await fetch(`${baseUrl}/v2/loyalty/promotions/${promotionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Square-Version': '2024-01-18',
        'Content-Type': 'application/json'
      }
    })

    if (!promotionResponse.ok) {
      const errorText = await promotionResponse.text()
      console.error('Promotion fetch failed:', errorText)
      throw new Error(`Promotion fetch failed: ${errorText}`)
    }

    const promotionData = await promotionResponse.json()
    const promotion = promotionData.loyalty_promotion

    // Create a loyalty reward for this promotion
    const createRewardPayload = {
      reward: {
        loyalty_account_id: loyaltyAccountId,
        reward_tier_id: null, // For promotions, we don't use tier_id
        promotion_id: promotionId
      },
      idempotency_key: `promotion-${promotionId}-${loyaltyAccountId}-${Date.now()}`
    }

    const createRewardResponse = await fetch(`${baseUrl}/v2/loyalty/rewards`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Square-Version': '2024-01-18',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(createRewardPayload)
    })

    if (!createRewardResponse.ok) {
      const errorText = await createRewardResponse.text()
      console.error(`Square promotion reward creation failed: ${createRewardResponse.status} - ${errorText}`)
      return new Response(
        JSON.stringify({ error: 'Failed to create promotion reward in Square', details: errorText }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const rewardData = await createRewardResponse.json()
    const squareRewardId = rewardData.reward.id

    console.log(`Created Square promotion reward: ${squareRewardId}`)

    // Create Shopify discount code for the promotion
    let discountCode = null
    
    if (SHOP_NAME && SHOPIFY_ADMIN_TOKEN) {
      try {
        // Determine discount values from promotion incentive
        let discountValue = '10' // Default 10% off
        let valueType = 'percentage'
        let minimumAmount = null

        if (promotion.incentive) {
          if (promotion.incentive.type === 'PERCENTAGE_DISCOUNT') {
            valueType = 'percentage'
            discountValue = (promotion.incentive.percentage_discount || 10).toString()
          } else if (promotion.incentive.type === 'FIXED_DISCOUNT') {
            valueType = 'fixed_amount'
            const amount = promotion.incentive.fixed_discount_money?.amount || 500
            discountValue = (amount / 100).toString()
          }
        }

        // Set minimum spend if specified
        if (promotion.minimum_spend_amount_money?.amount) {
          minimumAmount = (promotion.minimum_spend_amount_money.amount / 100).toString()
        }

        // Create the price rule
        const priceRulePayload: any = {
          price_rule: {
            title: `Square Loyalty Promotion - ${promotion.name}`,
            target_type: 'line_item',
            target_selection: 'all',
            allocation_method: 'across',
            value_type: valueType,
            value: valueType === 'fixed_amount' ? `-${discountValue}` : `-${discountValue}`,
            customer_selection: 'all',
            starts_at: new Date().toISOString(),
            ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
            usage_limit: 1,
            once_per_customer: true
          }
        }

        // Add minimum amount if specified
        if (minimumAmount) {
          priceRulePayload.price_rule.prerequisite_subtotal_range = {
            greater_than_or_equal_to: minimumAmount
          }
        }

        const priceRuleResponse = await fetch(`https://${SHOP_NAME}/admin/api/2024-10/price_rules.json`, {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': SHOPIFY_ADMIN_TOKEN,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(priceRulePayload)
        })

        if (!priceRuleResponse.ok) {
          const errorText = await priceRuleResponse.text()
          console.error('Price rule creation failed:', errorText)
          throw new Error(`Price rule creation failed: ${errorText}`)
        }

        const priceRuleData = await priceRuleResponse.json()
        const priceRuleId = priceRuleData.price_rule.id

        // Create the discount code with unique identifier
        const uniqueCode = `PROMO-${squareRewardId.slice(0, 8)}`
        const discountCodePayload = {
          discount_code: {
            code: uniqueCode
          }
        }

        const discountCodeResponse = await fetch(`https://${SHOP_NAME}/admin/api/2024-10/price_rules/${priceRuleId}/discount_codes.json`, {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': SHOPIFY_ADMIN_TOKEN,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(discountCodePayload)
        })

        if (!discountCodeResponse.ok) {
          const errorText = await discountCodeResponse.text()
          console.error('Discount code creation failed:', errorText)
          throw new Error(`Discount code creation failed: ${errorText}`)
        }

        const discountCodeData = await discountCodeResponse.json()
        discountCode = discountCodeData.discount_code.code

        console.log(`Created Shopify promotion discount code: ${discountCode}`)

      } catch (shopifyError: any) {
        console.error('Shopify discount creation failed:', shopifyError)
        
        // If Shopify fails, we should delete the Square reward to clean up
        try {
          await fetch(`${baseUrl}/v2/loyalty/rewards/${squareRewardId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
              'Square-Version': '2024-01-18',
              'Content-Type': 'application/json'
            }
          })
          console.log(`Deleted Square reward ${squareRewardId} due to Shopify error`)
        } catch (deleteError) {
          console.error('Failed to cleanup Square reward:', deleteError)
        }
        
        return new Response(
          JSON.stringify({ error: 'Failed to create promotion discount code', details: shopifyError.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
      }
    }

    // Store promotion redemption record in Supabase for tracking
    try {
      await supabase
        .from('loyalty_transactions')
        .insert({
          user_id: null, // Will be updated when we have user context
          loyalty_account_id: null, // Will be updated when we have internal account
          transaction_type: 'promotion_redemption',
          points: 0, // Promotions don't typically cost points
          description: `Redeemed promotion: ${promotion.name}`,
          square_transaction_id: squareRewardId
        })
    } catch (dbError) {
      console.error('Failed to record promotion redemption:', dbError)
      // Don't fail the request for this, just log it
    }

    return new Response(
      JSON.stringify({ 
        rewardId: squareRewardId,
        discountCode,
        promotion: {
          id: promotion.id,
          name: promotion.name,
          description: promotion.incentive?.type || 'Special promotion'
        },
        environment,
        message: 'Promotion redeemed successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error: any) {
    console.error('Loyalty promotion redeem error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})