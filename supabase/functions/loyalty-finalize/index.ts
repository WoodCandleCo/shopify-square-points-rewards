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
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    const { rewardId, success, shopifyOrderId } = await req.json()

    if (!rewardId || typeof success !== 'boolean') {
      return new Response(
        JSON.stringify({ error: 'rewardId and success (boolean) are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Get environment variables
    const SQUARE_ACCESS_TOKEN = Deno.env.get('SQUARE_ACCESS_TOKEN')

    if (!SQUARE_ACCESS_TOKEN) {
      throw new Error('Square access token not configured')
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

    console.log(`Finalizing reward ${rewardId} with success=${success} in ${environment} environment`)

    if (success) {
      // Redeem the loyalty reward (marks it as REDEEMED)
      const redeemResponse = await fetch(`${baseUrl}/v2/loyalty/rewards/${rewardId}/redeem`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
          'Square-Version': '2024-01-18',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          idempotency_key: `redeem-${rewardId}-${Date.now()}`
        })
      })

      if (!redeemResponse.ok) {
        const errorText = await redeemResponse.text()
        console.error('Reward redemption failed:', errorText)
        throw new Error(`Reward redemption failed: ${errorText}`)
      }

      const redeemData = await redeemResponse.json()
      console.log(`Successfully redeemed reward ${rewardId}`)

      // Log the successful redemption
      if (shopifyOrderId) {
        console.log(`Reward ${rewardId} linked to Shopify order ${shopifyOrderId}`)
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Reward successfully redeemed',
          reward: redeemData.reward,
          environment
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )

    } else {
      // Delete the loyalty reward (releases the locked points)
      const deleteResponse = await fetch(`${baseUrl}/v2/loyalty/rewards/${rewardId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
          'Square-Version': '2024-01-18',
          'Content-Type': 'application/json'
        }
      })

      if (!deleteResponse.ok) {
        const errorText = await deleteResponse.text()
        console.error('Reward deletion failed:', errorText)
        throw new Error(`Reward deletion failed: ${errorText}`)
      }

      console.log(`Successfully deleted/released reward ${rewardId}`)

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Reward deleted and points released',
          environment
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

  } catch (error: any) {
    console.error('Loyalty finalize error:', error)
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