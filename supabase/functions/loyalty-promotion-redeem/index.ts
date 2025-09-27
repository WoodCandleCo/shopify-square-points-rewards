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

    const SQUARE_ACCESS_TOKEN = Deno.env.get('SQUARE_ACCESS_TOKEN')
    if (!SQUARE_ACCESS_TOKEN) {
      throw new Error('Square access token not configured')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

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

    console.log(`Redeeming promotion ${promotionId} in ${environment} environment`)

    // Get promotion details
    const promotionResponse = await fetch(`${baseUrl}/v2/loyalty/promotions/${promotionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-10-17'
      }
    })

    if (!promotionResponse.ok) {
      const errorText = await promotionResponse.text()
      console.error('Promotion fetch failed:', errorText)
      throw new Error(`Promotion fetch failed: ${errorText}`)
    }

    const promotionData = await promotionResponse.json()
    const promotion = promotionData.loyalty_promotion

    // Create Shopify discount code for the promotion
    let discountCode = `PROMO${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    
    // Get Shopify credentials
    let shopifyStoreUrl = Deno.env.get('SHOPIFY_STORE_URL')
    const shopifyAccessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN')

    if (shopifyStoreUrl && shopifyAccessToken) {
      try {
        // Clean up store URL
        shopifyStoreUrl = shopifyStoreUrl.replace(/^https?:\/\//, '')
        shopifyStoreUrl = shopifyStoreUrl.replace(/\/$/, '')

        // Determine discount values from promotion incentive
        let discountValue = '10'
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

        // Create unique discount code for this promotion redemption
        discountCode = `${promotion.name?.replace(/\s+/g, '').substring(0, 8).toUpperCase() || 'PROMO'}${Date.now().toString().slice(-6)}`

        // Create price rule
        const priceRulePayload: any = {
          price_rule: {
            title: `${promotion.name} - ${discountCode}`,
            target_type: 'line_item',
            target_selection: 'all',
            allocation_method: 'across',
            value_type: valueType,
            value: valueType === 'fixed_amount' ? `-${discountValue}` : `-${discountValue}`,
            customer_selection: 'all',
            starts_at: new Date().toISOString(),
            ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
            usage_limit: 1,
            once_per_customer: true
          }
        }

        // Add minimum spend requirement
        if (minimumAmount) {
          priceRulePayload.price_rule.prerequisite_subtotal_range = {
            greater_than_or_equal_to: minimumAmount
          }
        }

        // Add maximum discount for percentage discounts
        if (valueType === 'percentage' && promotion.incentive?.fixed_discount_money?.amount) {
          priceRulePayload.price_rule.allocation_limit = (promotion.incentive.fixed_discount_money.amount / 100).toString()
        }

        console.log('Creating promotion price rule:', JSON.stringify(priceRulePayload, null, 2))

        const priceRuleResponse = await fetch(`https://${shopifyStoreUrl}/admin/api/2024-10/price_rules.json`, {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': shopifyAccessToken,
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

        // Create discount code
        const discountCodePayload = {
          discount_code: {
            code: discountCode
          }
        }

        const discountCodeResponse = await fetch(`https://${shopifyStoreUrl}/admin/api/2024-10/price_rules/${priceRuleId}/discount_codes.json`, {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': shopifyAccessToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(discountCodePayload)
        })

        if (!discountCodeResponse.ok) {
          const errorText = await discountCodeResponse.text()
          console.error('Discount code creation failed:', errorText)
          throw new Error(`Discount code creation failed: ${errorText}`)
        }

        console.log(`Created promotion discount code: ${discountCode}`)

      } catch (shopifyError: any) {
        console.error('Shopify discount creation failed:', shopifyError)
        return new Response(
          JSON.stringify({ error: 'Failed to create promotion discount code', details: shopifyError.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
      }
    } else {
      console.warn('Shopify credentials not configured, cannot create discount codes')
    }

    // Record promotion redemption
    try {
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
            points: 0, // Promotions typically don't cost points
            description: `Redeemed promotion: ${promotion.name}`,
            square_transaction_id: `promo-${promotionId}`
          })
      }
    } catch (dbError) {
      console.error('Failed to record promotion redemption:', dbError)
    }

    return new Response(
      JSON.stringify({ 
        rewardId: `promo-${promotionId}`,
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