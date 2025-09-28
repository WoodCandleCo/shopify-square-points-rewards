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
      try {
        // Extract reward tier information
        const rewardTier = reward.reward_tier
        if (!rewardTier) continue

        const rewardName = rewardTier.name || 'Unnamed Reward'
        const pointsRequired = parseInt(rewardTier.points) || 0
        
        // Parse discount information based on type
        let discountAmount = null
        let discountType = null
        let maxDiscountAmount = null
        let description = null

        const discount = rewardTier.definition?.discount
        if (discount) {
          if (discount.fixed_discount) {
            // Fixed amount discount (amount is in cents)
            discountType = 'FIXED_AMOUNT'
            discountAmount = parseInt(discount.fixed_discount.amount) || 0
            description = `$${(discountAmount / 100).toFixed(2)} off`
          } else if (discount.percentage_discount) {
            // Percentage discount
            discountType = 'PERCENTAGE'
            // Parse percentage string to integer (e.g., "10.0" -> 10)
            const percentageStr = discount.percentage_discount.percentage || '0'
            discountAmount = parseInt(parseFloat(percentageStr).toString()) || 0
            description = `${discountAmount}% off`
            
            // Check for maximum discount amount
            if (discount.percentage_discount.maximum_discount_money) {
              maxDiscountAmount = parseInt(discount.percentage_discount.maximum_discount_money.amount) || null
              if (maxDiscountAmount) {
                description += ` (max $${(maxDiscountAmount / 100).toFixed(2)})`
              }
            }
          }
        }

        // Prepare the reward data for database insertion
        const rewardData = {
          square_reward_id: reward.id,
          name: rewardName,
          description: description,
          points_required: pointsRequired,
          discount_amount: discountAmount,
          discount_type: discountType,
          max_discount_amount: maxDiscountAmount,
          is_active: true
        }

        // Insert/update the reward in the database
        const { error } = await supabaseClient
          .from('loyalty_rewards')
          .upsert(rewardData, {
            onConflict: 'square_reward_id'
          })

        if (error) {
          console.error(`Error syncing reward ${reward.id}:`, error)
        } else {
          syncedCount++
        }
      } catch (rewardError) {
        console.error(`Error processing reward ${reward.id}:`, rewardError)
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        count: syncedCount,
        total_rewards: rewards.length,
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