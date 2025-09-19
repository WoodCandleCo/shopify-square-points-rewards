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
    console.log('Get Shopify products function called!');
    
    // Get Shopify credentials
    let shopifyStoreUrl = Deno.env.get('SHOPIFY_STORE_URL');
    const shopifyAccessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');

    if (!shopifyStoreUrl || !shopifyAccessToken) {
      throw new Error('Missing Shopify credentials');
    }

    // Clean up the store URL - remove protocol if present
    shopifyStoreUrl = shopifyStoreUrl.replace(/^https?:\/\//, '');
    shopifyStoreUrl = shopifyStoreUrl.replace(/\/$/, ''); // Remove trailing slash

    console.log('Using Shopify store URL:', shopifyStoreUrl);

    // Fetch all products from Shopify with variants for SKU and pricing
    const productsResponse = await fetch(
      `https://${shopifyStoreUrl}/admin/api/2024-10/products.json?limit=250&fields=id,title,handle,tags,variants`,
      {
        headers: {
          'X-Shopify-Access-Token': shopifyAccessToken,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!productsResponse.ok) {
      const errorText = await productsResponse.text();
      throw new Error(`Failed to fetch products: ${errorText}`);
    }

    const productsData = await productsResponse.json();
    const products = productsData.products || [];
    
    console.log(`Found ${products.length} products in store`);

    return new Response(
      JSON.stringify({
        success: true,
        products: products,
        total_count: products.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error fetching Shopify products:', error);
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