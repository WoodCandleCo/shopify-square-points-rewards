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
    console.log('Auto-tag function called!');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

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

    // Get product mappings from database
    const { data: mappings, error: mappingsError } = await supabaseClient
      .from('product_mappings')
      .select('*')
      .eq('is_active', true);

    if (mappingsError) {
      throw new Error(`Failed to get product mappings: ${mappingsError.message}`);
    }

    console.log('Found mappings:', mappings.length);

    // First, get ALL products from Shopify to analyze
    console.log('Fetching all products from Shopify...');
    const allProductsResponse = await fetch(
      `https://${shopifyStoreUrl}/admin/api/2024-10/products.json?limit=250`,
      {
        headers: {
          'X-Shopify-Access-Token': shopifyAccessToken,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!allProductsResponse.ok) {
      const errorText = await allProductsResponse.text();
      throw new Error(`Failed to fetch products: ${errorText}`);
    }

    const allProductsData = await allProductsResponse.json();
    const allProducts = allProductsData.products || [];
    
    console.log(`Found ${allProducts.length} total products in store`);
    if (allProducts.length > 0) {
      console.log('Sample product names:', allProducts.slice(0, 5).map(p => p.title));
    }

    let taggedCount = 0;
    const results = [];

    for (const mapping of mappings) {
      console.log(`Processing mapping for: ${mapping.product_name}`);
      
      try {
        // Define search terms for each category
        let keywords = [];
        const productName = mapping.product_name.toLowerCase();
        
        if (productName.includes('match')) {
          keywords = ['match'];
        } else if (productName.includes('wick trimmer')) {
          keywords = ['wick', 'trimmer'];
        } else if (productName.includes('candle')) {
          keywords = ['candle'];
        } else if (productName.includes('wax melt')) {
          keywords = ['wax', 'melt'];
        } else {
          keywords = [productName];
        }

        console.log(`Looking for products containing: ${keywords.join(' OR ')}`);

        // Find matching products
        const matchingProducts = allProducts.filter(product => {
          const title = product.title.toLowerCase();
          const description = (product.body_html || '').toLowerCase();
          const tags = (product.tags || '').toLowerCase();
          const vendor = (product.vendor || '').toLowerCase();
          
          const allText = `${title} ${description} ${tags} ${vendor}`;
          
          // For single keywords, just check if any keyword exists
          return keywords.some(keyword => allText.includes(keyword));
        });

        console.log(`Found ${matchingProducts.length} products for ${mapping.product_name}`);

        // Tag matching products
        for (const product of matchingProducts) {
          const currentTags = product.tags ? product.tags.split(', ') : [];
          
          if (!currentTags.includes(mapping.shopify_tag)) {
            currentTags.push(mapping.shopify_tag);
            
            const updateResponse = await fetch(
              `https://${shopifyStoreUrl}/admin/api/2024-10/products/${product.id}.json`,
              {
                method: 'PUT',
                headers: {
                  'X-Shopify-Access-Token': shopifyAccessToken,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  product: {
                    id: product.id,
                    tags: currentTags.join(', ')
                  }
                })
              }
            );

            if (updateResponse.ok) {
              taggedCount++;
              console.log(`Tagged product "${product.title}" with ${mapping.shopify_tag}`);
              
              results.push({
                product_name: product.title,
                product_id: product.id,
                product_handle: product.handle,
                tag_added: mapping.shopify_tag,
                mapping_type: mapping.mapping_type,
                success: true
              });
            } else {
              const errorText = await updateResponse.text();
              console.error(`Failed to tag product ${product.title}:`, errorText);
              
              results.push({
                product_name: product.title,
                product_id: product.id,
                tag_added: mapping.shopify_tag,
                success: false,
                error: errorText
              });
            }
          } else {
            console.log(`Product "${product.title}" already has tag ${mapping.shopify_tag}`);
            results.push({
              product_name: product.title,
              product_id: product.id,
              tag_added: mapping.shopify_tag,
              success: true,
              already_tagged: true
            });
          }
        }

        // If no products found, log it
        if (matchingProducts.length === 0) {
          results.push({
            mapping_name: mapping.product_name,
            success: false,
            error: `No products found containing: ${keywords.join(', ')}`
          });
        }

      } catch (error) {
        console.error(`Error processing mapping for ${mapping.product_name}:`, error);
        results.push({
          mapping_name: mapping.product_name,
          success: false,
          error: error.message
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Tagged ${taggedCount} products with loyalty tags`,
        tagged_count: taggedCount,
        total_mappings: mappings.length,
        total_products_in_store: allProducts.length,
        results: results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error auto-tagging products:', error);
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