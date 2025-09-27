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
    const SQUARE_LOYALTY_PROGRAM_ID = Deno.env.get('SQUARE_LOYALTY_PROGRAM_ID')
    
    if (!SQUARE_ACCESS_TOKEN || !SQUARE_LOYALTY_PROGRAM_ID) {
      throw new Error('Square configuration not complete')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { email, phone, first_name, last_name } = await req.json()

    if (!email || !phone) {
      return new Response(
        JSON.stringify({ error: 'Email and phone number required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Normalize phone to E.164 format
    const rawDigits = String(phone).replace(/\D/g, '')
    let e164Phone = String(phone).trim()
    if (!phone.startsWith('+')) {
      if (rawDigits.length === 10) {
        e164Phone = `+1${rawDigits}`
      } else if (rawDigits.length === 11 && rawDigits.startsWith('1')) {
        e164Phone = `+${rawDigits}`
      } else {
        e164Phone = `+${rawDigits}`
      }
    }

    console.log(`Creating loyalty account for email: ${email}, phone: ${e164Phone}`)

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

    // Step 1: Create customer in Square
    const customerPayload: any = {
      email_address: email,
      phone_number: e164Phone
    }

    if (first_name) customerPayload.given_name = first_name
    if (last_name) customerPayload.family_name = last_name

    const customerResponse = await fetch(`${baseUrl}/v2/customers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-10-17'
      },
      body: JSON.stringify(customerPayload)
    })

    if (!customerResponse.ok) {
      const errorText = await customerResponse.text()
      console.error(`Square customer creation error: ${customerResponse.status} - ${errorText}`)
      
      // Check if customer already exists
      if (errorText.includes('EMAIL_ADDRESS_INVALID') || errorText.includes('PHONE_NUMBER_INVALID')) {
        return new Response(
          JSON.stringify({ error: 'Invalid email or phone number format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to create customer account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const customerData = await customerResponse.json()
    const squareCustomerId = customerData.customer.id
    console.log(`Created Square customer: ${squareCustomerId}`)

    // Step 2: Create loyalty account
    const loyaltyPayload = {
      loyalty_account: {
        program_id: SQUARE_LOYALTY_PROGRAM_ID,
        mapping: {
          phone_number: e164Phone
        }
      },
      idempotency_key: `loyalty-${squareCustomerId}-${Date.now()}`
    }

    const loyaltyResponse = await fetch(`${baseUrl}/v2/loyalty/accounts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-10-17'
      },
      body: JSON.stringify(loyaltyPayload)
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
    const loyaltyAccount = loyaltyData.loyalty_account
    console.log(`Created Square loyalty account: ${loyaltyAccount.id}`)

    // Step 3: Create profile in Supabase
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        email: email,
        phone: e164Phone,
        first_name: first_name,
        last_name: last_name,
        square_customer_id: squareCustomerId
      })
      .select()
      .single()

    if (profileError) {
      console.error('Profile creation error:', profileError)
      // Continue even if profile creation fails
    }

    // Step 4: Create loyalty account record in Supabase
    let dbLoyaltyAccount = null
    if (profile) {
      const { data: loyaltyAccountData, error: loyaltyAccountError } = await supabase
        .from('loyalty_accounts')
        .insert({
          user_id: profile.id,
          program_id: loyaltyAccount.program_id,
          square_loyalty_account_id: loyaltyAccount.id,
          balance: loyaltyAccount.balance || 0,
          points_earned_lifetime: loyaltyAccount.lifetime_points || 0
        })
        .select()
        .single()

      if (!loyaltyAccountError) {
        dbLoyaltyAccount = loyaltyAccountData
      }
    }

    // Get available rewards
    const { data: rewards } = await supabase
      .from('loyalty_rewards')
      .select('*')
      .eq('is_active', true)
      .lte('points_required', loyaltyAccount.balance || 0)
      .order('points_required', { ascending: true })

    return new Response(
      JSON.stringify({
        success: true,
        loyalty_account: {
          id: dbLoyaltyAccount?.id || loyaltyAccount.id,
          square_loyalty_account_id: loyaltyAccount.id,
          program_id: loyaltyAccount.program_id,
          balance: loyaltyAccount.balance || 0,
          points_earned_lifetime: loyaltyAccount.lifetime_points || 0,
          customer_id: squareCustomerId
        },
        available_rewards: rewards || [],
        square_customer_id: squareCustomerId,
        phone_number: e164Phone,
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