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

    console.log(`Looking up loyalty account for phone: ${phone}`)

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

    // Call Square API to find loyalty account by phone
    const squareResponse = await fetch(`${baseUrl}/v2/loyalty/accounts/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-10-17'
      },
      body: JSON.stringify({
        query: {
          filter: {
            phone_number_filter: {
              phone_number: phone
            }
          }
        }
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

    // Create or update profile in Supabase
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .upsert({
        shopify_customer_id: customer_id,
        email: email,
        phone: phone,
        square_customer_id: squareLoyaltyAccount.customer_id
      })
      .select()
      .single()

    if (profileError) {
      console.error('Profile error:', profileError)
      return new Response(
        JSON.stringify({ error: 'Failed to create profile' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Created/updated profile:`, JSON.stringify(profile, null, 2))

    // Create or update loyalty account
    const { data: loyaltyAccount, error: loyaltyError } = await supabase
      .from('loyalty_accounts')
      .upsert({
        user_id: profile.id,
        program_id: squareLoyaltyAccount.program_id,
        square_loyalty_account_id: squareLoyaltyAccount.id,
        balance: squareLoyaltyAccount.balance,
        points_earned_lifetime: squareLoyaltyAccount.lifetime_points || 0
      })
      .select()
      .single()

    if (loyaltyError) {
      console.error('Loyalty account error:', loyaltyError)
      return new Response(
        JSON.stringify({ error: 'Failed to create loyalty account' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Created/updated loyalty account:`, JSON.stringify(loyaltyAccount, null, 2))

    // Get available rewards
    const { data: rewards } = await supabase
      .from('loyalty_rewards')
      .select('*')
      .eq('is_active', true)
      .lte('points_required', loyaltyAccount.balance)
      .order('points_required', { ascending: true })

    console.log(`Found ${rewards?.length || 0} available rewards`)

    return new Response(
      JSON.stringify({
        loyalty_account: loyaltyAccount,
        available_rewards: rewards || []
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