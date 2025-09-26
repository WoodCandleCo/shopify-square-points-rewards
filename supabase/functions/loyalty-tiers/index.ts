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
    const programId = url.searchParams.get('programId')

    if (!programId) {
      return new Response(
        JSON.stringify({ error: 'programId parameter is required' }),
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

    console.log(`Fetching reward tiers for program ${programId} in ${environment} environment`)

    // Retrieve loyalty program from Square
    const programResponse = await fetch(`${baseUrl}/v2/loyalty/programs/${programId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Square-Version': '2024-01-18',
        'Content-Type': 'application/json'
      }
    })

    if (!programResponse.ok) {
      const errorText = await programResponse.text()
      console.error('Loyalty program retrieval failed:', errorText)
      
      if (programResponse.status === 404) {
        return new Response(
          JSON.stringify({ error: 'Loyalty program not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        )
      }
      
      throw new Error(`Loyalty program retrieval failed: ${errorText}`)
    }

    const programData = await programResponse.json()
    const program = programData.program

    // Extract reward tiers from the program
    const rewardTiers = program.reward_tiers || []

    // Transform the tiers to include relevant information for the UI
    const formattedTiers = rewardTiers.map((tier: any) => ({
      id: tier.id,
      name: tier.name,
      points: tier.points,
      createdAt: tier.created_at,
      definition: tier.definition,
      pricingRuleReference: tier.pricing_rule_reference
    }))

    // Also get terminology for display
    const terminology = program.terminology || { one: 'Point', other: 'Points' }

    return new Response(
      JSON.stringify({
        programId: program.id,
        rewardTiers: formattedTiers,
        terminology,
        accrualRules: program.accrual_rules || [],
        environment
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Loyalty tiers error:', error)
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