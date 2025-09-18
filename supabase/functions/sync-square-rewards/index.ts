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
    const SQUARE_ACCESS_TOKEN = Deno.env.get('SQUARE_ACCESS_TOKEN')

    if (!SQUARE_ACCESS_TOKEN) {
      throw new Error('Square access token not configured')
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the environment setting from the database
    const { data: settingData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'square_environment')
      .single()

    const environment = settingData?.value ? JSON.parse(settingData.value) : 'sandbox'
    
    // Use appropriate Square API URL based on environment
    const baseUrl = environment === 'production' 
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com'

    console.log(`Syncing rewards from Square in ${environment} environment`)

    // First, get the loyalty program ID
    const programsResponse = await fetch(`${baseUrl}/v2/loyalty/programs`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Square-Version': '2024-01-18',
        'Content-Type': 'application/json'
      }
    })

    if (!programsResponse.ok) {
      const errorText = await programsResponse.text()
      console.error(`Square API error fetching programs: ${programsResponse.status} - ${errorText}`)
      throw new Error(`Failed to fetch loyalty programs: ${programsResponse.status}`)
    }

    const programsData = await programsResponse.json()
    console.log('Programs response:', JSON.stringify(programsData, null, 2))

    if (!programsData.programs || programsData.programs.length === 0) {
      throw new Error('No loyalty programs found in Square account')
    }

    const program = programsData.programs[0]
    const rewards = program.reward_tiers || []

    console.log(`Found ${rewards.length} reward tiers`)

    let syncedCount = 0

    // Sync each reward to the database
    for (const reward of rewards) {
      try {
        const rewardData = {
          square_reward_id: reward.id,
          name: reward.name || `${reward.points} Points Reward`,
          description: reward.definition?.discount?.percentage ? 
            `${reward.definition.discount.percentage}% off` :
            `$${(reward.definition?.discount?.amount_money?.amount || 0) / 100} off`,
          points_required: reward.points || 0,
          discount_type: reward.definition?.discount?.percentage ? 'FIXED_PERCENTAGE' : 'FIXED_AMOUNT',
          discount_amount: reward.definition?.discount?.percentage || 
            (reward.definition?.discount?.amount_money?.amount || 0),
          max_discount_amount: reward.definition?.discount?.percentage ? 
            (reward.definition?.discount?.max_discount_money?.amount || null) : null,
          is_active: true
        }

        // Upsert the reward
        const { error } = await supabase
          .from('loyalty_rewards')
          .upsert(rewardData, { 
            onConflict: 'square_reward_id' 
          })

        if (error) {
          console.error('Error upserting reward:', error)
        } else {
          syncedCount++
          console.log(`Synced reward: ${rewardData.name}`)
        }
      } catch (rewardError) {
        console.error('Error processing individual reward:', rewardError)
      }
    }

    console.log(`Successfully synced ${syncedCount} rewards`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully synced ${syncedCount} rewards from Square`,
        count: syncedCount,
        environment
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error in sync-square-rewards function:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})