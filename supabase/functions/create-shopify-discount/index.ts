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

    const { reward_id, customer_email, discount_amount, discount_type, max_discount_amount, square_reward_data } = await req.json();

    console.log('Creating Shopify discount for reward:', reward_id);
    console.log('Square reward data:', JSON.stringify(square_reward_data, null, 2));

    // Get Shopify credentials
    const shopifyStoreUrl = Deno.env.get('SHOPIFY_STORE_URL');
    const shopifyAccessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');

    if (!shopifyStoreUrl || !shopifyAccessToken) {
      throw new Error('Missing Shopify credentials');
    }

    // Generate unique discount code
    const discountCode = `LOYALTY${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    
    // Parse Square reward definition to understand the discount scope
    const definition = square_reward_data?.definition || {};
    const scope = definition.scope; // ORDER, CATEGORY, ITEM_VARIATION
    const catalogObjectIds = definition.catalog_object_ids || [];
    
    console.log('Discount scope:', scope, 'Catalog objects:', catalogObjectIds);

    let discountPayload: any;

    // Handle different discount types based on Square's scope
    if (scope === 'ITEM_VARIATION' || scope === 'CATEGORY') {
      // For specific items or categories, create a product-specific discount
      // Since Shopify doesn't directly map Square catalog IDs, we'll create a percentage discount
      // and include instructions in the title for manual application
      
      let title = `Loyalty Reward - ${discountCode}`;
      if (scope === 'ITEM_VARIATION') {
        title += ` (Free Item - Apply to specific product)`;
      } else if (scope === 'CATEGORY') {
        title += ` (Category Discount - Apply to category items)`;
      }

      discountPayload = {
        price_rule: {
          title: title,
          value_type: 'percentage',
          value: '-100.0', // 100% off for free items
          customer_selection: 'all',
          target_type: 'line_item',
          target_selection: 'all',
          allocation_method: 'across',
          usage_limit: 1,
          once_per_customer: true,
          starts_at: new Date().toISOString(),
          ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          prerequisite_subtotal_range: {
            greater_than_or_equal_to: '0.01'
          }
        }
      };
    } else {
      // ORDER scope - apply to entire order
      let valueType: string;
      let value: string;
      
      if (discount_type === 'PERCENTAGE') {
        valueType = 'percentage';
        value = `-${discount_amount}.0`; // Shopify expects negative percentages
      } else {
        valueType = 'fixed_amount';
        value = (discount_amount / 100).toString(); // Convert cents to dollars
      }

      discountPayload = {
        price_rule: {
          title: `Loyalty Reward - ${discountCode}`,
          value_type: valueType,
          value: value,
          customer_selection: 'all',
          target_type: 'line_item',
          target_selection: 'all',
          allocation_method: 'across',
          usage_limit: 1,
          once_per_customer: true,
          starts_at: new Date().toISOString(),
          ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          prerequisite_subtotal_range: {
            greater_than_or_equal_to: '0.01'
          }
        }
      };

      // Add maximum discount amount for percentage discounts
      if (discount_type === 'PERCENTAGE' && max_discount_amount) {
        discountPayload.price_rule.value_type = 'percentage';
        discountPayload.price_rule.value = `-${discount_amount}.0`;
        discountPayload.price_rule.allocation_limit = (max_discount_amount / 100).toString();
      }
    }

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