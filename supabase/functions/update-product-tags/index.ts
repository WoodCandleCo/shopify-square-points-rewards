import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    console.log('Update product tags function called!');
    
    const { productId, action, tag } = await req.json();
    
    if (!productId || !action) {
      throw new Error('Missing required parameters: productId and action');
    }

    if (action === 'add' && !tag) {
      throw new Error('Tag is required when action is "add"');
    }

    // Get Shopify credentials
    let shopifyStoreUrl = Deno.env.get('SHOPIFY_STORE_URL');
    const shopifyAccessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');

    if (!shopifyStoreUrl || !shopifyAccessToken) {
      throw new Error('Missing Shopify credentials');
    }

    // Clean up the store URL
    shopifyStoreUrl = shopifyStoreUrl.replace(/^https?:\/\//, '');
    shopifyStoreUrl = shopifyStoreUrl.replace(/\/$/, '');

    console.log(`Updating product ${productId}: ${action} ${tag || 'all loyalty tags'}`);

    // First, get the current product to retrieve existing tags
    const getProductResponse = await fetch(
      `https://${shopifyStoreUrl}/admin/api/2024-10/products/${productId}.json?fields=id,tags`,
      {
        headers: {
          'X-Shopify-Access-Token': shopifyAccessToken,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!getProductResponse.ok) {
      const errorText = await getProductResponse.text();
      throw new Error(`Failed to fetch product: ${errorText}`);
    }

    const productData = await getProductResponse.json();
    const currentTags = productData.product.tags ? productData.product.tags.split(', ') : [];
    
    console.log('Current tags:', currentTags);

    let newTags = [...currentTags];

    if (action === 'add') {
      // Add the tag if it doesn't already exist
      if (!newTags.includes(tag)) {
        newTags.push(tag);
      }
    } else if (action === 'remove') {
      if (tag) {
        // Remove specific tag
        newTags = newTags.filter(t => t !== tag);
      } else {
        // Remove all loyalty tags
        newTags = newTags.filter(t => !t.startsWith('loyalty-'));
      }
    }

    console.log('New tags:', newTags);

    // Update the product with new tags
    const updateResponse = await fetch(
      `https://${shopifyStoreUrl}/admin/api/2024-10/products/${productId}.json`,
      {
        method: 'PUT',
        headers: {
          'X-Shopify-Access-Token': shopifyAccessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          product: {
            id: productId,
            tags: newTags.join(', ')
          }
        })
      }
    );

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Failed to update product: ${errorText}`);
    }

    const updatedProduct = await updateResponse.json();
    console.log(`Successfully updated product ${productId}`);

    return new Response(
      JSON.stringify({
        success: true,
        product_id: productId,
        action: action,
        tag: tag,
        new_tags: newTags
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error updating product tags:', error);
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