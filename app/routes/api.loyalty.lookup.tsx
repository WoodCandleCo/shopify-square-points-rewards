import { json } from "@remix-run/node";
import type { ActionFunction } from "@remix-run/node";
import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    const { phone, customer_id, email } = await request.json();

    if (!phone) {
      return json({ error: "Phone number required" }, { 
        status: 400,
        headers: corsHeaders 
      });
    }

    // Call Square API to find loyalty account by phone
    const squareApiUrl = process.env.SQUARE_ENVIRONMENT === 'production' 
      ? 'https://connect.squareup.com/v2/loyalty/accounts/search'
      : 'https://connect.squareupsandbox.com/v2/loyalty/accounts/search';
      
    const squareResponse = await fetch(squareApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-10-17'
      },
      body: JSON.stringify({
        query: {
          filter: {
            phone_number_filter: {
              phone_number: phone
            }
          }
        }
      })
    });

    if (!squareResponse.ok) {
      return json({ error: "Failed to find loyalty account" }, { 
        status: 404,
        headers: corsHeaders 
      });
    }

    const squareData = await squareResponse.json();
    
    if (!squareData.loyalty_accounts || squareData.loyalty_accounts.length === 0) {
      return json({ error: "No loyalty account found for this phone number" }, { 
        status: 404,
        headers: corsHeaders 
      });
    }

    const squareLoyaltyAccount = squareData.loyalty_accounts[0];

    // Create or update profile in Supabase
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .upsert({
        shopify_customer_id: customer_id,
        email: email,
        phone: phone,
        square_customer_id: squareLoyaltyAccount.customer_id
      })
      .select()
      .single();

    if (profileError) {
      console.error('Profile error:', profileError);
      return json({ error: "Failed to create profile" }, { 
        status: 500,
        headers: corsHeaders 
      });
    }

    // Create or update loyalty account
    const { data: loyaltyAccount, error: loyaltyError } = await supabase
      .from('loyalty_accounts')
      .upsert({
        user_id: profile.id,
        program_id: squareLoyaltyAccount.program_id,
        square_loyalty_account_id: squareLoyaltyAccount.id,
        balance: squareLoyaltyAccount.balance,
        points_earned_lifetime: squareLoyaltyAccount.lifetime_points || 0
      })
      .select()
      .single();

    if (loyaltyError) {
      console.error('Loyalty account error:', loyaltyError);
      return json({ error: "Failed to create loyalty account" }, { 
        status: 500,
        headers: corsHeaders 
      });
    }

    // Get available rewards
    const { data: rewards } = await supabase
      .from('loyalty_rewards')
      .select('*')
      .eq('is_active', true)
      .lte('points_required', loyaltyAccount.balance)
      .order('points_required', { ascending: true });

    return json({
      loyalty_account: loyaltyAccount,
      available_rewards: rewards || []
    }, {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Error looking up loyalty account:', error);
    return json({ error: "Internal server error" }, { 
      status: 500,
      headers: corsHeaders 
    });
  }
};