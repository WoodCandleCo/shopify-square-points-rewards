import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-shopify-*',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    const orderData = await req.json()
    
    console.log('Processing Shopify order webhook:', orderData.id)
    console.log('Order total:', orderData.total_price)
    console.log('Customer:', orderData.customer?.id)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Process discount codes (finalize rewards)
    const discountCodes = orderData.discount_codes || []
    const discountApplications = orderData.discount_applications || []
    
    const squareDiscountCodes = [
      ...discountCodes.filter((code: any) => code.code && code.code.startsWith('SQ-')),
      ...discountApplications.filter((app: any) => app.code && app.code.startsWith('SQ-'))
    ]

    for (const discountCode of squareDiscountCodes) {
      const code = discountCode.code
      const rewardIdMatch = code.match(/^SQ-(.+)$/)
      
      if (rewardIdMatch) {
        const rewardId = rewardIdMatch[1]
        console.log(`Finalizing Square reward: ${rewardId}`)

        try {
          await supabase.functions.invoke('loyalty-finalize', {
            body: {
              rewardId,
              success: true,
              shopifyOrderId: orderData.id
            }
          })
          console.log(`Successfully finalized reward ${rewardId}`)
        } catch (error) {
          console.error(`Failed to finalize reward ${rewardId}:`, error)
        }
      }
    }

    // Process points accumulation for eligible purchases
    const totalAmount = parseFloat(orderData.total_price || '0')
    const customer = orderData.customer
    
    if (totalAmount > 0 && customer) {
      console.log(`Processing points accumulation for customer ${customer.id}, order total: $${totalAmount}`)
      
      try {
        await supabase.functions.invoke('loyalty-accumulate-points', {
          body: {
            customerId: customer.id.toString(),
            customerEmail: customer.email,
            customerPhone: customer.phone,
            orderTotal: totalAmount,
            orderId: orderData.id,
            orderNumber: orderData.order_number
          }
        })
        console.log(`Points accumulation processed for order ${orderData.id}`)
      } catch (accumulateError) {
        console.error('Points accumulation failed:', accumulateError)
        // Don't fail the webhook for this
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Order webhook processed successfully',
        orderId: orderData.id,
        processedDiscounts: squareDiscountCodes.length,
        pointsEligible: totalAmount > 0 && customer ? true : false
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error: any) {
    console.error('Shopify webhook error:', error)
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