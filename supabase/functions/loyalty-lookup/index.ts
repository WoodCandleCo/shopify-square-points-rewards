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

    const { phone, customer_id, email } = await req.json()

    if (!phone && !email) {
      return new Response(
        JSON.stringify({ error: 'Phone number or email required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Normalize phone to E.164 format
    let e164Phone = null
    if (phone) {
      const rawDigits = String(phone).replace(/\D/g, '')
      if (phone.startsWith('+')) {
        e164Phone = phone
      } else if (rawDigits.length === 10) {
        e164Phone = `+1${rawDigits}`
      } else if (rawDigits.length === 11 && rawDigits.startsWith('1')) {
        e164Phone = `+${rawDigits}`
      } else {
        e164Phone = `+${rawDigits}`
      }
    }

    console.log(`Looking up loyalty account for phone: ${e164Phone}, email: ${email}`)

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

    console.log(`Using Square ${environment} environment`)

    // Search for existing customer first
    let customerId = null
    const customerSearchPayload: any = {
      query: {
        filter: {}
      }
    }

    if (e164Phone) {
      customerSearchPayload.query.filter.phone_number = { exact: e164Phone }
    } else if (email) {
      customerSearchPayload.query.filter.email_address = { exact: email }
    }

    const customerSearchResponse = await fetch(`${baseUrl}/v2/customers/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-10-17'
      },
      body: JSON.stringify(customerSearchPayload)
    })

    if (customerSearchResponse.ok) {
      const customerData = await customerSearchResponse.json()
      customerId = customerData.customers?.[0]?.id
    }

    // Search for loyalty account
    let loyaltyAccount = null
    if (customerId) {
      const loyaltySearchResponse = await fetch(`${baseUrl}/v2/loyalty/accounts/search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'Square-Version': '2024-10-17'
        },
        body: JSON.stringify({
          query: {
            customer_ids: [customerId]
          }
        })
      })

      if (loyaltySearchResponse.ok) {
        const loyaltyData = await loyaltySearchResponse.json()
        loyaltyAccount = loyaltyData.loyalty_accounts?.[0]
      }
    }

    // If no loyalty account found, search by phone mapping
    if (!loyaltyAccount && e164Phone) {
      const loyaltyPhoneSearchResponse = await fetch(`${baseUrl}/v2/loyalty/accounts/search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'Square-Version': '2024-10-17'
        },
        body: JSON.stringify({
          query: {
            mappings: [
              { phone_number: e164Phone }
            ]
          }
        })
      })

      if (loyaltyPhoneSearchResponse.ok) {
        const loyaltyData = await loyaltyPhoneSearchResponse.json()
        loyaltyAccount = loyaltyData.loyalty_accounts?.[0]
      }
    }

    if (!loyaltyAccount) {
      return new Response(
        JSON.stringify({ 
          error: 'No loyalty account found',
          enrollment_available: true,
          phone: e164Phone,
          email: email
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create or update profile in Supabase
    let profile = null
    if (customer_id || email) {
      const { data: existingProfile, error: profileError } = await supabase
        .from('profiles')
        .upsert({
          shopify_customer_id: customer_id,
          email: email,
          phone: e164Phone,
          square_customer_id: loyaltyAccount.customer_id
        }, {
          onConflict: 'shopify_customer_id',
          ignoreDuplicates: false
        })
        .select()
        .single()

      if (!profileError) {
        profile = existingProfile
      }
    }

    // Create or update loyalty account in Supabase
    let dbLoyaltyAccount = null
    if (profile) {
      const { data: existingLoyalty, error: loyaltyError } = await supabase
        .from('loyalty_accounts')
        .upsert({
          user_id: profile.id,
          program_id: loyaltyAccount.program_id,
          square_loyalty_account_id: loyaltyAccount.id,
          balance: loyaltyAccount.balance || 0,
          points_earned_lifetime: loyaltyAccount.lifetime_points || 0
        }, {
          onConflict: 'square_loyalty_account_id',
          ignoreDuplicates: false
        })
        .select()
        .single()

      if (!loyaltyError) {
        dbLoyaltyAccount = existingLoyalty
      }
    }

    // Get available rewards
    const { data: rewards } = await supabase
      .from('loyalty_rewards')
      .select('*')
      .eq('is_active', true)
      .lte('points_required', loyaltyAccount.balance || 0)
      .order('points_required', { ascending: true })

    // Get available promotions
    const promotionsResponse = await supabase.functions.invoke('loyalty-promotions', {
      body: {
        customerId: loyaltyAccount.customer_id,
        loyaltyAccountId: loyaltyAccount.id
      }
    })

    const promotions = promotionsResponse.data?.promotions || []

    return new Response(
      JSON.stringify({
        loyalty_account: {
          id: dbLoyaltyAccount?.id || loyaltyAccount.id,
          square_loyalty_account_id: loyaltyAccount.id,
          program_id: loyaltyAccount.program_id,
          balance: loyaltyAccount.balance || 0,
          points_earned_lifetime: loyaltyAccount.lifetime_points || 0,
          customer_id: loyaltyAccount.customer_id
        },
        available_rewards: rewards || [],
        available_promotions: promotions.filter((p: any) => p.customer_eligible),
        square_customer_id: loyaltyAccount.customer_id,
        phone_number: e164Phone
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error looking up loyalty account:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})