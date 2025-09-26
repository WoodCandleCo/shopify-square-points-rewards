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
    
    console.log('Received Shopify order webhook:', orderData.id)

    // Check if the order used any discount codes
    const discountCodes = orderData.discount_codes || []
    const discountApplications = orderData.discount_applications || []
    
    // Look for discount codes that start with "SQ-" (our Square reward codes)
    const squareDiscountCodes = discountCodes.filter((code: any) => 
      code.code && code.code.startsWith('SQ-')
    )

    const squareDiscountApps = discountApplications.filter((app: any) => 
      app.code && app.code.startsWith('SQ-')
    )

    if (squareDiscountCodes.length === 0 && squareDiscountApps.length === 0) {
      console.log('No Square discount codes found in order')
      return new Response(
        JSON.stringify({ message: 'No Square discount codes to process' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Process each Square discount code
    for (const discountCode of [...squareDiscountCodes, ...squareDiscountApps]) {
      const code = discountCode.code
      
      // Extract reward ID from discount code (format: SQ-{rewardId})
      const rewardIdMatch = code.match(/^SQ-(.+)$/)
      if (!rewardIdMatch) {
        console.log(`Invalid Square discount code format: ${code}`)
        continue
      }
      
      const rewardId = rewardIdMatch[1]
      console.log(`Processing Square reward finalization for reward: ${rewardId}`)

      try {
        // Call the loyalty-finalize function to redeem the reward
        const finalizeResponse = await supabase.functions.invoke('loyalty-finalize', {
          body: {
            rewardId,
            success: true,
            shopifyOrderId: orderData.id
          }
        })

        if (finalizeResponse.error) {
          console.error(`Failed to finalize reward ${rewardId}:`, finalizeResponse.error)
        } else {
          console.log(`Successfully finalized reward ${rewardId} for order ${orderData.id}`)
        }

      } catch (error) {
        console.error(`Error finalizing reward ${rewardId}:`, error)
      }
    }

    // Optional: Accumulate points for the purchase
    // This would require implementing the Square Loyalty Accumulate API
    // Based on your program's accrual rules (1 point per $1 spent)
    
    const totalAmount = parseFloat(orderData.total_price || '0')
    if (totalAmount > 0) {
      console.log(`Order ${orderData.id} total: $${totalAmount} - could accumulate ${Math.floor(totalAmount)} points`)
      
      // TODO: Implement points accumulation if desired
      // This would require:
      // 1. Finding the customer's loyalty account
      // 2. Calling Square Loyalty Accumulate API
      // 3. Recording the transaction in our database
    }

    return new Response(
      JSON.stringify({ 
        message: 'Webhook processed successfully',
        orderId: orderData.id,
        processedDiscounts: [...squareDiscountCodes, ...squareDiscountApps].length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
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