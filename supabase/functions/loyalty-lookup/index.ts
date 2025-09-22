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

    const { phone, customer_id, email } = await req.json()

    if (!phone) {
      return new Response(
        JSON.stringify({ error: 'Phone number required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Normalize phone -> E.164 (+1XXXXXXXXXX default to US if 10 digits)
    const rawDigits = String(phone).replace(/\D/g, '')
    let e164 = String(phone).trim()
    if (!String(phone).startsWith('+')) {
      if (rawDigits.length === 10) e164 = `+1${rawDigits}`
      else if (rawDigits.length === 11 && rawDigits.startsWith('1')) e164 = `+${rawDigits}`
      else e164 = `+${rawDigits}`
    }

    console.log(`Looking up loyalty account for phone: ${e164}`)

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

    console.log(`Using Square ${environment} environment: ${baseUrl}`)

    // Call Square API to find loyalty account by phone using correct schema (mappings)
    const squareResponse = await fetch(`${baseUrl}/v2/loyalty/accounts/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-10-17'
      },
      body: JSON.stringify({
        query: {
          mappings: [
            { phone_number: e164 }
          ]
        },
        limit: 1
      })
    })

    console.log(`Square API response status: ${squareResponse.status}`)

    if (!squareResponse.ok) {
      const errorText = await squareResponse.text()
      console.error(`Square API error: ${squareResponse.status} - ${errorText}`)
      return new Response(
        JSON.stringify({ error: 'Failed to find loyalty account' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const squareData = await squareResponse.json()
    console.log(`Square API response:`, JSON.stringify(squareData, null, 2))
    
    if (!squareData.loyalty_accounts || squareData.loyalty_accounts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No loyalty account found for this phone number' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const squareLoyaltyAccount = squareData.loyalty_accounts[0]
    console.log(`Found Square loyalty account:`, JSON.stringify(squareLoyaltyAccount, null, 2))

    // Try to find existing profile first
    let profile = null
    if (customer_id || email) {
      let profileQuery = supabase
        .from('profiles')
        .select('*')
        .maybeSingle()

      if (customer_id) {
        profileQuery = profileQuery.eq('shopify_customer_id', customer_id)
      } else if (email) {
        profileQuery = profileQuery.eq('email', email)
      }

      const { data: existingProfile } = await profileQuery
      profile = existingProfile
    }

    // Create a temporary loyalty account data for response (without saving to database)
    const loyaltyAccountData = {
      id: squareLoyaltyAccount.id, // Use Square's ID temporarily
      program_id: squareLoyaltyAccount.program_id,
      square_loyalty_account_id: squareLoyaltyAccount.id,
      balance: squareLoyaltyAccount.balance,
      points_earned_lifetime: squareLoyaltyAccount.lifetime_points || 0,
      user_id: profile?.id || null
    }

    console.log(`Loyalty account data:`, JSON.stringify(loyaltyAccountData, null, 2))

    // Get available rewards based on points balance
    const { data: rewards } = await supabase
      .from('loyalty_rewards')
      .select('*')
      .eq('is_active', true)
      .lte('points_required', loyaltyAccountData.balance)
      .order('points_required', { ascending: true })

    console.log(`Found ${rewards?.length || 0} available rewards`)

    return new Response(
      JSON.stringify({
        loyalty_account: loyaltyAccountData,
        available_rewards: rewards || [],
        square_customer_id: squareLoyaltyAccount.customer_id,
        phone_number: e164
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