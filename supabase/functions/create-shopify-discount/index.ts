import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      reward_id, 
      reward_name, 
      discount_amount, 
      discount_type, 
      max_discount_amount,
      shopify_product_id,
      shopify_product_handle,
      shopify_sku,
      applicable_product_names,
      square_reward_id
    } = await req.json();

    console.log('Creating Shopify discount for reward:', reward_name);

    // Get Shopify credentials
    let shopifyStoreUrl = Deno.env.get('SHOPIFY_STORE_URL');
    const shopifyAccessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');

    if (!shopifyStoreUrl || !shopifyAccessToken) {
      throw new Error('Missing Shopify credentials');
    }

    // Clean up store URL
    shopifyStoreUrl = shopifyStoreUrl.replace(/^https?:\/\//, '');
    shopifyStoreUrl = shopifyStoreUrl.replace(/\/$/, '');

    // Generate unique discount code
    const discountCode = square_reward_id 
      ? `SQ-${square_reward_id.slice(-8)}` 
      : `LOYALTY${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Determine discount configuration
    let valueType: string;
    let value: string;
    let allocationLimit: string | null = null;

    if (discount_type === 'PERCENTAGE') {
      valueType = 'percentage';
      value = `-${discount_amount}`;
      
      // Set allocation limit for percentage discounts to prevent abuse
      if (max_discount_amount) {
        allocationLimit = (max_discount_amount / 100).toString();
      } else if (discount_amount === 100) {
        // For 100% off (free items), limit to reasonable amount
        allocationLimit = '25.00';
      }
    } else {
      valueType = 'fixed_amount';
      value = `-${(discount_amount / 100).toFixed(2)}`;
    }

    // Create price rule payload
    const priceRulePayload: any = {
      price_rule: {
        title: `${reward_name} - ${discountCode}`,
        value_type: valueType,
        value: value,
        customer_selection: 'all',
        target_type: 'line_item',
        target_selection: 'all',
        allocation_method: discount_amount === 100 ? 'each' : 'across',
        usage_limit: 1,
        once_per_customer: true,
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        prerequisite_subtotal_range: {
          greater_than_or_equal_to: '0.01'
        }
      }
    };

    // Add allocation limit if specified
    if (allocationLimit) {
      priceRulePayload.price_rule.allocation_limit = allocationLimit;
    }

    // For free items (100% off), add product restrictions if available
    if (discount_amount === 100 && applicable_product_names && applicable_product_names.length > 0) {
      // Try to find Shopify products that match the applicable product names
      try {
        const productsResponse = await fetch(
          `https://${shopifyStoreUrl}/admin/api/2024-10/products.json?limit=250&fields=id,title,handle,variants`,
          {
            headers: {
              'X-Shopify-Access-Token': shopifyAccessToken,
              'Content-Type': 'application/json'
            }
          }
        );

        if (productsResponse.ok) {
          const productsData = await productsResponse.json();
          const allProducts = productsData.products || [];
          
          // Find products that match the applicable product names
          const matchingProducts = allProducts.filter((product: any) => 
            applicable_product_names.some((applicableProduct: any) => {
              const productTitle = typeof applicableProduct === 'string' 
                ? applicableProduct 
                : applicableProduct.title;
              return product.title.toLowerCase().includes(productTitle.toLowerCase()) ||
                     productTitle.toLowerCase().includes(product.title.toLowerCase());
            })
          );

          if (matchingProducts.length > 0) {
            // Get all variant IDs for the matching products
            const variantIds = matchingProducts.flatMap((product: any) => 
              product.variants?.map((variant: any) => variant.id) || []
            );

            if (variantIds.length > 0) {
              priceRulePayload.price_rule.entitled_product_ids = matchingProducts.map((p: any) => p.id);
              priceRulePayload.price_rule.entitled_variant_ids = variantIds;
              priceRulePayload.price_rule.target_selection = 'entitled';
              
              console.log(`Restricting discount to ${matchingProducts.length} matching products`);
            }
          }
        }
      } catch (productError) {
        console.warn('Could not fetch products for restriction:', productError);
        // Continue without product restrictions
      }
    }

    console.log('Creating price rule:', JSON.stringify(priceRulePayload, null, 2));

    // Create price rule
    const priceRuleResponse = await fetch(`https://${shopifyStoreUrl}/admin/api/2024-10/price_rules.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': shopifyAccessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(priceRulePayload)
    });

    if (!priceRuleResponse.ok) {
      const errorText = await priceRuleResponse.text();
      console.error('Price rule creation failed:', errorText);
      throw new Error(`Failed to create price rule: ${errorText}`);
    }

    const priceRuleData = await priceRuleResponse.json();
    const priceRuleId = priceRuleData.price_rule.id;

    console.log('Created price rule:', priceRuleId);

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
          'X-Shopify-Access-Token': shopifyAccessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(discountCodePayload)
      }
    );

    if (!discountCodeResponse.ok) {
      const errorText = await discountCodeResponse.text();
      console.error('Discount code creation failed:', errorText);
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
        expires_at: priceRulePayload.price_rule.ends_at,
        value_type: valueType,
        value: value,
        allocation_limit: allocationLimit
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
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