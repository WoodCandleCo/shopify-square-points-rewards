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
    const SQUARE_ACCESS_TOKEN = Deno.env.get('SQUARE_ACCESS_TOKEN')
    const SQUARE_LOCATION_ID = Deno.env.get('SQUARE_LOCATION_ID')
    
    if (!SQUARE_ACCESS_TOKEN || !SQUARE_LOCATION_ID) {
      throw new Error('Square configuration not complete')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { 
      customerId, 
      customerEmail, 
      customerPhone, 
      orderTotal, 
      orderId, 
      orderNumber 
    } = await req.json()

    if (!orderTotal || orderTotal <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid order total' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing points accumulation for order ${orderId}, total: $${orderTotal}`)

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

    // Find customer's loyalty account
    let loyaltyAccountId = null

    // First try to find by Shopify customer ID in our database
    if (customerId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*, loyalty_accounts(*)')
        .eq('shopify_customer_id', customerId)
        .single()

      if (profile?.loyalty_accounts?.[0]) {
        loyaltyAccountId = profile.loyalty_accounts[0].square_loyalty_account_id
        console.log(`Found loyalty account via Shopify customer ID: ${loyaltyAccountId}`)
      }
    }

    // If not found, try to find by email or phone in Square
    if (!loyaltyAccountId) {
      const searchPayload: any = {
        query: {}
      }

      if (customerPhone) {
        // Normalize phone
        const rawDigits = String(customerPhone).replace(/\D/g, '')
        let e164Phone = customerPhone
        if (!customerPhone.startsWith('+')) {
          if (rawDigits.length === 10) {
            e164Phone = `+1${rawDigits}`
          } else if (rawDigits.length === 11 && rawDigits.startsWith('1')) {
            e164Phone = `+${rawDigits}`
          }
        }

        searchPayload.query.mappings = [{ phone_number: e164Phone }]
      } else if (customerEmail) {
        // Search by customer email
        const customerSearchResponse = await fetch(`${baseUrl}/v2/customers/search`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'Square-Version': '2024-10-17'
          },
          body: JSON.stringify({
            query: {
              filter: {
                email_address: { exact: customerEmail }
              }
            }
          })
        })

        if (customerSearchResponse.ok) {
          const customerData = await customerSearchResponse.json()
          const squareCustomerId = customerData.customers?.[0]?.id

          if (squareCustomerId) {
            searchPayload.query.customer_ids = [squareCustomerId]
          }
        }
      }

      if (searchPayload.query.mappings || searchPayload.query.customer_ids) {
        const loyaltySearchResponse = await fetch(`${baseUrl}/v2/loyalty/accounts/search`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'Square-Version': '2024-10-17'
          },
          body: JSON.stringify(searchPayload)
        })

        if (loyaltySearchResponse.ok) {
          const loyaltyData = await loyaltySearchResponse.json()
          const loyaltyAccount = loyaltyData.loyalty_accounts?.[0]
          if (loyaltyAccount) {
            loyaltyAccountId = loyaltyAccount.id
            console.log(`Found loyalty account via Square search: ${loyaltyAccountId}`)
          }
        }
      }
    }

    if (!loyaltyAccountId) {
      console.log('No loyalty account found for customer, skipping points accumulation')
      return new Response(
        JSON.stringify({ 
          message: 'No loyalty account found, points accumulation skipped',
          orderId: orderId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Calculate points to award (typically 1 point per dollar spent)
    const pointsToAward = Math.floor(orderTotal)

    if (pointsToAward <= 0) {
      console.log('No points to award for this order')
      return new Response(
        JSON.stringify({ 
          message: 'Order total too low for points accumulation',
          orderId: orderId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Accumulate points in Square
    const accumulatePayload = {
      accumulate_points: {
        loyalty_account_id: loyaltyAccountId,
        points: pointsToAward,
        order_id: `shopify-${orderId}`
      },
      idempotency_key: `accumulate-${orderId}-${Date.now()}`,
      location_id: SQUARE_LOCATION_ID
    }

    console.log('Accumulating points:', JSON.stringify(accumulatePayload, null, 2))

    const accumulateResponse = await fetch(`${baseUrl}/v2/loyalty/accounts/${loyaltyAccountId}/accumulate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-10-17'
      },
      body: JSON.stringify(accumulatePayload)
    })

    if (!accumulateResponse.ok) {
      const errorText = await accumulateResponse.text()
      console.error(`Points accumulation failed: ${accumulateResponse.status} - ${errorText}`)
      
      // Don't fail the webhook for points accumulation issues
      return new Response(
        JSON.stringify({ 
          message: 'Points accumulation failed but order processed',
          error: errorText,
          orderId: orderId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const accumulateData = await accumulateResponse.json()
    const newBalance = accumulateData.loyalty_account?.balance || 0

    console.log(`Successfully accumulated ${pointsToAward} points. New balance: ${newBalance}`)

    // Update local database if we have a record
    try {
      await supabase
        .from('loyalty_accounts')
        .update({ 
          balance: newBalance,
          points_earned_lifetime: accumulateData.loyalty_account?.lifetime_points || 0
        })
        .eq('square_loyalty_account_id', loyaltyAccountId)

      // Record the transaction
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
            transaction_type: 'EARN',
            points: pointsToAward,
            description: `Earned from order #${orderNumber || orderId}`,
            square_transaction_id: accumulateData.loyalty_event?.id
          })
      }
    } catch (dbError) {
      console.error('Database update failed:', dbError)
      // Don't fail the webhook for database issues
    }

    return new Response(
      JSON.stringify({ 
        message: 'Points accumulation successful',
        orderId: orderId,
        pointsAwarded: pointsToAward,
        newBalance: newBalance,
        loyaltyAccountId: loyaltyAccountId
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error: any) {
    console.error('Points accumulation error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        orderId: req.json().then(data => data.id).catch(() => 'unknown')
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})