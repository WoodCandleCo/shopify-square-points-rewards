import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Mock promotions data
    const mockPromotions = [
      {
        id: 'promo_1',
        name: 'Birthday Special',
        status: 'ACTIVE',
        description: 'Special birthday discount for loyalty members',
        incentive_type: 'PERCENTAGE_DISCOUNT',
        incentive_value: 20,
        available_time: {
          start_date: '2024-01-01',
          end_date: '2024-12-31'
        },
        minimum_spend: null,
        maximum_discount: null,
        loyalty_program_id: 'program_1'
      }
    ]

    return new Response(
      JSON.stringify({
        success: true,
        promotions: mockPromotions,
        total_active_promotions: 1,
        customer_specific_count: 1,
        environment: 'sandbox'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error in loyalty-promotions:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: `Internal server error: ${error.message}`
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})