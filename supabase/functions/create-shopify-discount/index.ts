import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { reward_id, customer_email, discount_amount, discount_type, max_discount_amount } = await req.json();

    console.log('Creating Shopify discount for reward:', reward_id);

    // Get Shopify credentials
    const shopifyStoreUrl = Deno.env.get('SHOPIFY_STORE_URL');
    const shopifyAccessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');

    if (!shopifyStoreUrl || !shopifyAccessToken) {
      throw new Error('Missing Shopify credentials');
    }

    // Generate unique discount code
    const discountCode = `LOYALTY${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    
    // Determine discount value based on type
    let discountValue: string;
    let valueType: string;
    
    if (discount_type === 'PERCENTAGE') {
      discountValue = (discount_amount / 100).toString(); // Convert percentage to decimal
      valueType = 'percentage';
    } else {
      discountValue = (discount_amount / 100).toString(); // Convert cents to dollars
      valueType = 'fixed_amount';
    }

    // Create discount in Shopify
    const discountPayload = {
      price_rule: {
        title: `Loyalty Reward - ${discountCode}`,
        value_type: valueType,
        value: discountValue,
        customer_selection: 'all',
        target_type: 'line_item',
        target_selection: 'all',
        allocation_method: 'across',
        usage_limit: 1,
        once_per_customer: true,
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        ...(max_discount_amount && valueType === 'percentage' && {
          value_type: 'percentage',
          value: discountValue,
          allocation_limit: (max_discount_amount / 100).toString()
        })
      }
    };

    console.log('Creating price rule with payload:', JSON.stringify(discountPayload, null, 2));

    const priceRuleResponse = await fetch(`https://${shopifyStoreUrl}/admin/api/2024-10/price_rules.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': shopifyAccessToken,
      },
      body: JSON.stringify(discountPayload),
    });

    if (!priceRuleResponse.ok) {
      const errorText = await priceRuleResponse.text();
      console.error('Failed to create price rule:', errorText);
      throw new Error(`Failed to create price rule: ${errorText}`);
    }

    const priceRuleData = await priceRuleResponse.json();
    const priceRuleId = priceRuleData.price_rule.id;

    console.log('Created price rule with ID:', priceRuleId);

    // Create discount code
    const discountCodePayload = {
      discount_code: {
        code: discountCode,
        usage_count: 0
      }
    };

    const discountCodeResponse = await fetch(
      `https://${shopifyStoreUrl}/admin/api/2024-10/price_rules/${priceRuleId}/discount_codes.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': shopifyAccessToken,
        },
        body: JSON.stringify(discountCodePayload),
      }
    );

    if (!discountCodeResponse.ok) {
      const errorText = await discountCodeResponse.text();
      console.error('Failed to create discount code:', errorText);
      throw new Error(`Failed to create discount code: ${errorText}`);
    }

    const discountCodeData = await discountCodeResponse.json();
    
    console.log('Successfully created discount code:', discountCode);

    return new Response(
      JSON.stringify({
        success: true,
        discount_code: discountCode,
        price_rule_id: priceRuleId,
        discount_id: discountCodeData.discount_code.id,
        expires_at: discountPayload.price_rule.ends_at
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error creating Shopify discount:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});