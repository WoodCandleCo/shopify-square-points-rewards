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

  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const customerId = url.searchParams.get('customerId')
    const loyaltyAccountId = url.searchParams.get('loyaltyAccountId')

    if (!customerId && !loyaltyAccountId) {
      return new Response(
        JSON.stringify({ error: 'customerId or loyaltyAccountId parameter is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Get environment variables
    const SQUARE_ACCESS_TOKEN = Deno.env.get('SQUARE_ACCESS_TOKEN')
    const SQUARE_LOYALTY_PROGRAM_ID = Deno.env.get('SQUARE_LOYALTY_PROGRAM_ID')

    if (!SQUARE_ACCESS_TOKEN || !SQUARE_LOYALTY_PROGRAM_ID) {
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

    console.log(`Fetching promotions for customer in ${environment} environment`)

    // Get customer's loyalty account if only customerId is provided
    let actualLoyaltyAccountId = loyaltyAccountId
    
    if (!actualLoyaltyAccountId && customerId) {
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

      if (loyaltySearchResponse.ok) {
        const loyaltyData = await loyaltySearchResponse.json()
        actualLoyaltyAccountId = loyaltyData.loyalty_accounts?.[0]?.id
      }
    }

    if (!actualLoyaltyAccountId) {
      return new Response(
        JSON.stringify({ error: 'Loyalty account not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Fetch loyalty promotions for the program
    const promotionsResponse = await fetch(`${baseUrl}/v2/loyalty/promotions`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Square-Version': '2024-01-18',
        'Content-Type': 'application/json'
      }
    })

    if (!promotionsResponse.ok) {
      const errorText = await promotionsResponse.text()
      console.error('Promotions fetch failed:', errorText)
      throw new Error(`Promotions fetch failed: ${errorText}`)
    }

    const promotionsData = await promotionsResponse.json()
    const allPromotions = promotionsData.loyalty_promotions || []

    // Filter promotions for this loyalty program and that are currently active
    const currentDate = new Date()
    const activePromotions = allPromotions.filter((promo: any) => {
      const isCorrectProgram = promo.loyalty_program_id === SQUARE_LOYALTY_PROGRAM_ID
      const isActive = promo.status === 'ACTIVE'
      
      // Check if promotion is currently valid (within date range)
      let isInDateRange = true
      if (promo.available_time) {
        const startTime = promo.available_time.start_date ? new Date(promo.available_time.start_date) : null
        const endTime = promo.available_time.end_date ? new Date(promo.available_time.end_date) : null
        
        if (startTime && currentDate < startTime) isInDateRange = false
        if (endTime && currentDate > endTime) isInDateRange = false
      }
      
      return isCorrectProgram && isActive && isInDateRange
    })

    // Get customer information to check for birthday promotions
    let customerInfo = null
    if (customerId) {
      const customerResponse = await fetch(`${baseUrl}/v2/customers/${customerId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
          'Square-Version': '2024-01-18',
          'Content-Type': 'application/json'
        }
      })

      if (customerResponse.ok) {
        const customerData = await customerResponse.json()
        customerInfo = customerData.customer
      }
    }

    // Check for customer-specific promotions (like birthday)
    const customerSpecificPromotions: any[] = []
    const today = new Date()
    
    if (customerInfo && customerInfo.birthday) {
      const birthday = new Date(customerInfo.birthday)
      const isBirthdayMonth = birthday.getMonth() === today.getMonth()
      
      // Look for birthday promotions
      const birthdayPromotions = activePromotions.filter((promo: any) => 
        promo.name && promo.name.toLowerCase().includes('birthday')
      )
      
      if (isBirthdayMonth && birthdayPromotions.length > 0) {
        customerSpecificPromotions.push(...birthdayPromotions.map((promo: any) => ({
          ...promo,
          customer_eligible: true,
          eligibility_reason: 'birthday_month'
        })))
      }
    }

    // Format promotions for response
    const formattedPromotions = activePromotions.map((promo: any) => {
      const isCustomerSpecific = customerSpecificPromotions.some(cp => cp.id === promo.id)
      
      return {
        id: promo.id,
        name: promo.name,
        status: promo.status,
        description: promo.incentive?.type || 'Special promotion',
        incentive_type: promo.incentive?.type,
        incentive_value: promo.incentive?.percentage_discount || promo.incentive?.fixed_discount_money,
        available_time: promo.available_time,
        customer_eligible: isCustomerSpecific,
        eligibility_reason: isCustomerSpecific ? 
          customerSpecificPromotions.find(cp => cp.id === promo.id)?.eligibility_reason : null,
        minimum_spend: promo.minimum_spend_amount_money,
        maximum_discount: promo.qualifying_category_ids ? null : promo.incentive?.fixed_discount_money
      }
    })

    return new Response(
      JSON.stringify({
        promotions: formattedPromotions,
        customer_specific_count: customerSpecificPromotions.length,
        total_active_promotions: activePromotions.length,
        environment,
        loyalty_account_id: actualLoyaltyAccountId
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error: any) {
    console.error('Loyalty promotions error:', error)
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