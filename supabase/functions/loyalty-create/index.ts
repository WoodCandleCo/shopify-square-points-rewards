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

    const { email, phone } = await req.json()

    if (!email || !phone) {
      return new Response(
        JSON.stringify({ error: 'Email and phone number required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Normalize phone to E.164 format
    const rawDigits = String(phone).replace(/\D/g, '')
    let e164 = String(phone).trim()
    if (!String(phone).startsWith('+')) {
      if (rawDigits.length === 10) e164 = `+1${rawDigits}`
      else if (rawDigits.length === 11 && rawDigits.startsWith('1')) e164 = `+${rawDigits}`
      else e164 = `+${rawDigits}`
    }

    console.log(`Creating loyalty account for email: ${email}, phone: ${e164}`)

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

    // First, create customer in Square
    const customerResponse = await fetch(`${baseUrl}/v2/customers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-10-17'
      },
      body: JSON.stringify({
        email_address: email,
        phone_number: e164
      })
    })

    if (!customerResponse.ok) {
      const errorText = await customerResponse.text()
      console.error(`Square customer creation error: ${customerResponse.status} - ${errorText}`)
      return new Response(
        JSON.stringify({ error: 'Failed to create customer account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const customerData = await customerResponse.json()
    console.log(`Created Square customer:`, JSON.stringify(customerData, null, 2))

    // Then create loyalty account
    const loyaltyResponse = await fetch(`${baseUrl}/v2/loyalty/accounts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-10-17'
      },
      body: JSON.stringify({
        program_id: 'main', // You might need to get this from your loyalty program
        mapping: {
          phone_number: e164
        }
      })
    })

    if (!loyaltyResponse.ok) {
      const errorText = await loyaltyResponse.text()
      console.error(`Square loyalty account creation error: ${loyaltyResponse.status} - ${errorText}`)
      return new Response(
        JSON.stringify({ error: 'Failed to create loyalty account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const loyaltyData = await loyaltyResponse.json()
    console.log(`Created Square loyalty account:`, JSON.stringify(loyaltyData, null, 2))

    // Create the loyalty account data for response
    const loyaltyAccountData = {
      id: loyaltyData.loyalty_account.id,
      program_id: loyaltyData.loyalty_account.program_id,
      square_loyalty_account_id: loyaltyData.loyalty_account.id,
      balance: loyaltyData.loyalty_account.balance || 0,
      points_earned_lifetime: loyaltyData.loyalty_account.lifetime_points || 0,
      user_id: null
    }

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
        success: true,
        loyalty_account: loyaltyAccountData,
        available_rewards: rewards || [],
        square_customer_id: customerData.customer.id,
        phone_number: e164,
        email: email
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error creating loyalty account:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})