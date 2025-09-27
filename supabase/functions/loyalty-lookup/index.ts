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

  try {
    const { phone, customer_id, email } = await req.json()

    if (!phone) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Phone number is required'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // For demo purposes, return mock data
    const mockAccount = {
      id: 'demo_loyalty_account_' + Date.now(),
      balance: 785,
      points_earned_lifetime: 1250,
      program_id: 'demo_program'
    }

    const mockRewards = [
      {
        id: 'reward_1',
        name: '$5 Off Purchase',
        points_required: 500,
        discount_amount: 500,
        discount_type: 'FIXED_AMOUNT'
      },
      {
        id: 'reward_2', 
        name: '10% Off Order',
        points_required: 750,
        discount_amount: 10,
        discount_type: 'PERCENTAGE'
      }
    ]

    return new Response(
      JSON.stringify({
        success: true,
        loyalty_account: mockAccount,
        rewards: mockRewards.filter(r => r.points_required <= mockAccount.balance)
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error in loyalty-lookup:', error)
    
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