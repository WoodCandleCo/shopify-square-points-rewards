import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { customer_id, email } = await req.json()

    if (!customer_id && !email) {
      return new Response(
        JSON.stringify({ error: 'Customer ID or email required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Looking up existing loyalty account for customer_id: ${customer_id}, email: ${email}`)

    // Find customer profile by Shopify customer ID or email
    let profileQuery = supabase
      .from('profiles')
      .select('*, loyalty_accounts(*)')

    if (customer_id) {
      profileQuery = profileQuery.eq('shopify_customer_id', customer_id)
    } else {
      profileQuery = profileQuery.eq('email', email)
    }

    const { data: profile, error: profileError } = await profileQuery.single()

    if (profileError || !profile) {
      console.log('No existing profile found')
      return new Response(
        JSON.stringify({ loyalty_account: null, available_rewards: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    console.log(`Found profile:`, JSON.stringify(profile, null, 2))

    // Get available rewards
    const { data: rewards } = await supabase
      .from('loyalty_rewards')
      .select('*')
      .eq('is_active', true)
      .lte('points_required', profile.loyalty_accounts[0]?.balance || 0)
      .order('points_required', { ascending: true })

    console.log(`Found ${rewards?.length || 0} available rewards`)

    return new Response(
      JSON.stringify({
        loyalty_account: profile.loyalty_accounts[0] || null,
        available_rewards: rewards || []
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error loading loyalty account:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})