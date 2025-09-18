import { json } from "@remix-run/node";
import type { ActionFunction } from "@remix-run/node";
import { supabase } from "~/integrations/supabase/client";

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { customer_id, email } = await request.json();

    if (!customer_id && !email) {
      return json({ error: "Customer ID or email required" }, { status: 400 });
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
      return json({ loyalty_account: null, available_rewards: [] });
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
    });

  } catch (error) {
    console.error('Error loading loyalty account:', error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
};