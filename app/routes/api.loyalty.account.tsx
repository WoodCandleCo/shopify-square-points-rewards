import { json } from "@remix-run/node";
import type { ActionFunction } from "@remix-run/node";
import { supabase } from "~/integrations/supabase/client";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const action: ActionFunction = async ({ request }) => {
  // Handle CORS preflight requests
  if (request.method === "OPTIONS") {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { 
      status: 405,
      headers: corsHeaders 
    });
  }

  try {
    const { customer_id, email } = await request.json();

    if (!customer_id && !email) {
      return json({ error: "Customer ID or email required" }, { 
        status: 400,
        headers: corsHeaders 
      });
    }

    // Find customer profile by Shopify customer ID or email
    let profileQuery = supabase
      .from('profiles')
      .select('*, loyalty_accounts(*)')
      .single();

    if (customer_id) {
      profileQuery = profileQuery.eq('shopify_customer_id', customer_id);
    } else {
      profileQuery = profileQuery.eq('email', email);
    }

    const { data: profile, error: profileError } = await profileQuery;

    if (profileError || !profile) {
      return json({ loyalty_account: null, available_rewards: [] }, {
        headers: corsHeaders
      });
    }

    // Get available rewards
    const { data: rewards } = await supabase
      .from('loyalty_rewards')
      .select('*')
      .eq('is_active', true)
      .lte('points_required', profile.loyalty_accounts[0]?.balance || 0)
      .order('points_required', { ascending: true });

    return json({
      loyalty_account: profile.loyalty_accounts[0] || null,
      available_rewards: rewards || []
    }, {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Error loading loyalty account:', error);
    return json({ error: "Internal server error" }, { 
      status: 500,
      headers: corsHeaders 
    });
  }
};