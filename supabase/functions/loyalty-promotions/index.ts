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
    const programId = url.searchParams.get('programId')

    const SQUARE_ACCESS_TOKEN = Deno.env.get('SQUARE_ACCESS_TOKEN')
    const SQUARE_LOYALTY_PROGRAM_ID = Deno.env.get('SQUARE_LOYALTY_PROGRAM_ID')

    if (!SQUARE_ACCESS_TOKEN) {
      throw new Error('Square access token not configured')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

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

    console.log(`Fetching promotions in ${environment} environment`)

    // Get customer info for birthday promotions
    let customerInfo = null
    if (customerId) {
      try {
        const customerResponse = await fetch(`${baseUrl}/v2/customers/${customerId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'Square-Version': '2024-10-17'
          }
        })

        if (customerResponse.ok) {
          const customerData = await customerResponse.json()
          customerInfo = customerData.customer
        }
      } catch (error) {
        console.warn('Could not fetch customer info:', error)
      }
    }

    // Fetch all active loyalty promotions
    const promotionsResponse = await fetch(`${baseUrl}/v2/loyalty/promotions`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-10-17'
      }
    })

    if (!promotionsResponse.ok) {
      const errorText = await promotionsResponse.text()
      console.error('Promotions fetch failed:', errorText)
      throw new Error(`Promotions fetch failed: ${errorText}`)
    }

    const promotionsData = await promotionsResponse.json()
    const allPromotions = promotionsData.loyalty_promotions || []

    // Filter for active promotions in the correct program
    const targetProgramId = programId || SQUARE_LOYALTY_PROGRAM_ID
    const currentDate = new Date()
    
    const activePromotions = allPromotions.filter((promo: any) => {
      const isCorrectProgram = promo.loyalty_program_id === targetProgramId
      const isActive = promo.status === 'ACTIVE'
      
      // Check date range
      let isInDateRange = true
      if (promo.available_time) {
        const startTime = promo.available_time.start_date ? new Date(promo.available_time.start_date) : null
        const endTime = promo.available_time.end_date ? new Date(promo.available_time.end_date) : null
        
        if (startTime && currentDate < startTime) isInDateRange = false
        if (endTime && currentDate > endTime) isInDateRange = false
      }
      
      return isCorrectProgram && isActive && isInDateRange
    })

    console.log(`Found ${activePromotions.length} active promotions`)

    // Check customer eligibility for each promotion
    const eligiblePromotions = activePromotions.map((promo: any) => {
      let customerEligible = false
      let eligibilityReason = null

      // Check for birthday promotions
      if (customerInfo?.birthday && promo.name?.toLowerCase().includes('birthday')) {
        const birthday = new Date(customerInfo.birthday)
        const isBirthdayMonth = birthday.getMonth() === currentDate.getMonth()
        
        if (isBirthdayMonth) {
          customerEligible = true
          eligibilityReason = 'birthday_month'
        }
      }

      // Check for general promotions (no specific eligibility criteria)
      if (!promo.name?.toLowerCase().includes('birthday')) {
        customerEligible = true
        eligibilityReason = 'general_promotion'
      }

      // Format incentive value
      let incentiveValue = null
      let incentiveType = null
      
      if (promo.incentive) {
        if (promo.incentive.type === 'PERCENTAGE_DISCOUNT') {
          incentiveType = 'PERCENTAGE_DISCOUNT'
          incentiveValue = promo.incentive.percentage_discount
        } else if (promo.incentive.type === 'FIXED_DISCOUNT') {
          incentiveType = 'FIXED_DISCOUNT'
          incentiveValue = promo.incentive.fixed_discount_money
        }
      }

      return {
        id: promo.id,
        name: promo.name,
        status: promo.status,
        description: promo.incentive?.type || 'Special promotion',
        incentive_type: incentiveType,
        incentive_value: incentiveValue,
        available_time: promo.available_time,
        customer_eligible: customerEligible,
        eligibility_reason: eligibilityReason,
        minimum_spend: promo.minimum_spend_amount_money,
        maximum_discount: promo.qualifying_category_ids ? null : promo.incentive?.fixed_discount_money,
        loyalty_program_id: promo.loyalty_program_id
      }
    })

    const customerSpecificCount = eligiblePromotions.filter(p => p.customer_eligible).length

    return new Response(
      JSON.stringify({
        promotions: eligiblePromotions,
        customer_specific_count: customerSpecificCount,
        total_active_promotions: activePromotions.length,
        environment,
        customer_info: customerInfo ? {
          id: customerInfo.id,
          has_birthday: !!customerInfo.birthday,
          birthday_month: customerInfo.birthday ? new Date(customerInfo.birthday).getMonth() : null
        } : null
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