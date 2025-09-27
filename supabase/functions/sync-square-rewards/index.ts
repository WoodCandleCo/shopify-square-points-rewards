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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const squareAccessToken = Deno.env.get('SQUARE_ACCESS_TOKEN')
    const squareEnvironment = Deno.env.get('SQUARE_ENVIRONMENT') || 'sandbox'

    if (!squareAccessToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Square access token not configured'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const baseUrl = squareEnvironment === 'production' 
      ? 'https://connect.squareup.com' 
      : 'https://connect.squareupsandbox.com'

    // Get loyalty programs
    const programsResponse = await fetch(`${baseUrl}/v2/loyalty/programs`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${squareAccessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!programsResponse.ok) {
      const errorText = await programsResponse.text()
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to fetch loyalty programs: ${errorText}`
        }),
        {
          status: programsResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const programsData = await programsResponse.json()
    const programs = programsData.programs || []

    if (programs.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          count: 0,
          environment: squareEnvironment,
          message: 'No loyalty programs found'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get rewards for the first program
    const programId = programs[0].id
    const rewardsResponse = await fetch(`${baseUrl}/v2/loyalty/rewards?program_id=${programId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${squareAccessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!rewardsResponse.ok) {
      const errorText = await rewardsResponse.text()
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to fetch rewards: ${errorText}`
        }),
        {
          status: rewardsResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const rewardsData = await rewardsResponse.json()
    const rewards = rewardsData.rewards || []

    // Sync rewards to database
    let syncedCount = 0
    for (const reward of rewards) {
      const { error } = await supabaseClient
        .from('loyalty_rewards')
        .upsert({
          square_reward_id: reward.id,
          name: reward.reward_tier?.name || 'Unnamed Reward',
          description: reward.reward_tier?.definition?.discount?.percentage_discount?.percentage || null,
          points_required: reward.reward_tier?.points || 0,
          discount_amount: reward.reward_tier?.definition?.discount?.fixed_discount?.amount || 
                          reward.reward_tier?.definition?.discount?.percentage_discount?.percentage || null,
          discount_type: reward.reward_tier?.definition?.discount?.fixed_discount ? 'FIXED_AMOUNT' : 'PERCENTAGE',
          is_active: true
        }, {
          onConflict: 'square_reward_id'
        })

      if (!error) {
        syncedCount++
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        count: syncedCount,
        environment: squareEnvironment
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error in sync-square-rewards:', error)
    
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