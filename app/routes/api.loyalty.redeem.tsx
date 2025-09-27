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
    const { loyalty_account_id, reward_id, cart_total } = await request.json();

    if (!loyalty_account_id || !reward_id) {
      return json({ error: "Missing required fields" }, { 
        status: 400,
        headers: corsHeaders 
      });
    }

    // Get loyalty account and reward details
    const { data: loyaltyAccount } = await supabase
      .from('loyalty_accounts')
      .select('*')
      .eq('id', loyalty_account_id)
      .maybeSingle();

    const { data: reward } = await supabase
      .from('loyalty_rewards')
      .select('*')
      .eq('id', reward_id)
      .maybeSingle();

    if (!loyaltyAccount || !reward) {
      return json({ error: "Invalid loyalty account or reward" }, { 
        status: 404,
        headers: corsHeaders 
      });
    }

    if (loyaltyAccount.balance < reward.points_required) {
      return json({ error: "Insufficient points" }, { 
        status: 400,
        headers: corsHeaders 
      });
    }

    // Get Square reward definition for proper discount creation
    const squareRewardResponse = await fetch(`https://connect.squareup.com/v2/loyalty/programs`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-10-17'
      }
    });

    let squareRewardDefinition = null;
    if (squareRewardResponse.ok) {
      const squarePrograms = await squareRewardResponse.json();
      const program = squarePrograms.programs?.[0];
      const rewardTier = program?.reward_tiers?.find((tier: any) => tier.id === reward.square_reward_id);
      squareRewardDefinition = rewardTier;
    }

    // Step 1: Create a Square reward (ISSUED - lock points, do not redeem yet)
    const squareResponse = await fetch(`https://connect.squareup.com/v2/loyalty/rewards`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-10-17'
      },
      body: JSON.stringify({
        reward: {
          loyalty_account_id: loyaltyAccount.square_loyalty_account_id,
          reward_tier_id: reward.square_reward_id
        }
      })
    });

    if (!squareResponse.ok) {
      const errorData = await squareResponse.json();
      console.error('Square reward creation error:', errorData);
      return json({ error: "Failed to create reward" }, { 
        status: 500,
        headers: corsHeaders 
      });
    }

    const squareData = await squareResponse.json();
    const squareRewardId = squareData.reward?.id;

    // Step 2: Create a Shopify discount code linked to this Square reward
    const shopifyDiscountResponse = await supabase.functions.invoke('create-shopify-discount', {
      body: {
        reward_id: reward.id,
        discount_amount: reward.discount_amount,
        discount_type: reward.discount_type,
        max_discount_amount: reward.max_discount_amount,
        square_reward_data: squareRewardDefinition,
        code: squareRewardId ? `SQ-${squareRewardId}` : undefined
      }
    });

    if (shopifyDiscountResponse.error) {
      console.error('Shopify discount creation error:', shopifyDiscountResponse.error);
      return json({ error: "Failed to create discount code" }, { 
        status: 500,
        headers: corsHeaders 
      });
    }

    const discountData = shopifyDiscountResponse.data;

    // Do NOT update local balance or record redemption yet; finalize on order webhook


    return json({
      success: true,
      status: 'issued',
      square_reward_id: squareRewardId,
      discount_code: discountData.discount_code,
      discount_expires_at: discountData.expires_at
    }, {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Error redeeming reward:', error);
    return json({ error: "Internal server error" }, { 
      status: 500,
      headers: corsHeaders 
    });
  }
};