import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to normalize phone to E.164 format
function normalizePhoneToE164(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '')
  
  // If it starts with 1 and is 11 digits, it's already in the right format
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  }
  
  // If it's 10 digits, assume US and add +1
  if (digits.length === 10) {
    return `+1${digits}`
  }
  
  // If it already starts with +, return as is
  if (phone.startsWith('+')) {
    return phone
  }
  
  // Default: add + if not present
  return `+${digits}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    const { phone, email } = await req.json()

    if (!phone && !email) {
      return new Response(
        JSON.stringify({ error: 'Phone or email is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Get environment variables
    const SQUARE_ACCESS_TOKEN = Deno.env.get('SQUARE_ACCESS_TOKEN')
    const SQUARE_LOCATION_ID = Deno.env.get('SQUARE_LOCATION_ID')
    const SQUARE_LOYALTY_PROGRAM_ID = Deno.env.get('SQUARE_LOYALTY_PROGRAM_ID')

    if (!SQUARE_ACCESS_TOKEN || !SQUARE_LOCATION_ID || !SQUARE_LOYALTY_PROGRAM_ID) {
      throw new Error('Square configuration not complete')
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

    console.log(`Using Square ${environment} environment`)

    // Normalize phone number if provided
    const normalizedPhone = phone ? normalizePhoneToE164(phone) : null

    // Step 1: Search for existing customer
    const searchCustomerPayload: any = {
      query: {
        filter: {}
      }
    }

    if (normalizedPhone) {
      searchCustomerPayload.query.filter.phone_number = { exact: normalizedPhone }
    } else if (email) {
      searchCustomerPayload.query.filter.email_address = { exact: email }
    }

    console.log('Searching for customer with payload:', JSON.stringify(searchCustomerPayload))

    const customerSearchResponse = await fetch(`${baseUrl}/v2/customers/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Square-Version': '2024-01-18',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(searchCustomerPayload)
    })

    if (!customerSearchResponse.ok) {
      const errorText = await customerSearchResponse.text()
      console.error('Customer search failed:', errorText)
      throw new Error(`Customer search failed: ${errorText}`)
    }

    const customerData = await customerSearchResponse.json()
    let customerId = customerData.customers?.[0]?.id

    // Step 2: Create customer if not found
    if (!customerId) {
      console.log('Creating new customer')
      const createCustomerPayload: any = {}
      
      if (normalizedPhone) createCustomerPayload.phone_number = normalizedPhone
      if (email) createCustomerPayload.email_address = email

      const createCustomerResponse = await fetch(`${baseUrl}/v2/customers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
          'Square-Version': '2024-01-18',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(createCustomerPayload)
      })

      if (!createCustomerResponse.ok) {
        const errorText = await createCustomerResponse.text()
        console.error('Customer creation failed:', errorText)
        throw new Error(`Customer creation failed: ${errorText}`)
      }

      const newCustomerData = await createCustomerResponse.json()
      customerId = newCustomerData.customer.id
      console.log('Created customer:', customerId)
    }

    // Step 3: Search for existing loyalty account
    const loyaltySearchResponse = await fetch(`${baseUrl}/v2/loyalty/accounts/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Square-Version': '2024-01-18',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: {
          customer_ids: [customerId]
        }
      })
    })

    if (!loyaltySearchResponse.ok) {
      const errorText = await loyaltySearchResponse.text()
      console.error('Loyalty account search failed:', errorText)
      throw new Error(`Loyalty account search failed: ${errorText}`)
    }

    const loyaltyData = await loyaltySearchResponse.json()
    let loyaltyAccount = loyaltyData.loyalty_accounts?.[0]

    // Step 4: Create loyalty account if not found
    if (!loyaltyAccount) {
      if (!normalizedPhone) {
        return new Response(
          JSON.stringify({ error: 'Phone number is required to create loyalty account' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      console.log('Creating new loyalty account')
      const createLoyaltyPayload = {
        loyalty_account: {
          program_id: SQUARE_LOYALTY_PROGRAM_ID,
          mapping: {
            phone_number: normalizedPhone
          }
        },
        idempotency_key: `loyalty-${customerId}-${Date.now()}`
      }

      const createLoyaltyResponse = await fetch(`${baseUrl}/v2/loyalty/accounts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
          'Square-Version': '2024-01-18',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(createLoyaltyPayload)
      })

      if (!createLoyaltyResponse.ok) {
        const errorText = await createLoyaltyResponse.text()
        console.error('Loyalty account creation failed:', errorText)
        throw new Error(`Loyalty account creation failed: ${errorText}`)
      }

      const newLoyaltyData = await createLoyaltyResponse.json()
      loyaltyAccount = newLoyaltyData.loyalty_account
      console.log('Created loyalty account:', loyaltyAccount.id)
    }

    // Return the customer and loyalty account information
    return new Response(
      JSON.stringify({
        customerId,
        loyaltyAccountId: loyaltyAccount.id,
        pointsBalance: loyaltyAccount.balance || 0,
        lifetimePoints: loyaltyAccount.lifetime_points || 0,
        programId: SQUARE_LOYALTY_PROGRAM_ID,
        environment
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error: any) {
    console.error('Loyalty identify error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})