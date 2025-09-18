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

    // First, get ALL products with collection info from Shopify
    console.log('Fetching all products with collection data from Shopify...');
    
    // Fetch products with collection associations
    const allProductsResponse = await fetch(
      `https://${shopifyStoreUrl}/admin/api/2024-10/products.json?limit=250&fields=id,title,handle,product_type,vendor,tags,body_html,variants`,
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
    
    // Fetch collections and their products
    const collectionsResponse = await fetch(
      `https://${shopifyStoreUrl}/admin/api/2024-10/collections.json?fields=id,title,handle,products`,
      {
        headers: {
          'X-Shopify-Access-Token': shopifyAccessToken,
          'Content-Type': 'application/json'
        }
      }
    );

    let collections = [];
    let productCollectionMap = new Map(); // Map product ID to collection names
    
    if (collectionsResponse.ok) {
      const collectionsData = await collectionsResponse.json();
      collections = collectionsData.collections || [];
      console.log('Found collections:', collections.map(c => c.title));
      
      // For each collection, get its products
      for (const collection of collections) {
        const collectionProductsResponse = await fetch(
          `https://${shopifyStoreUrl}/admin/api/2024-10/collections/${collection.id}/products.json?fields=id`,
          {
            headers: {
              'X-Shopify-Access-Token': shopifyAccessToken,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (collectionProductsResponse.ok) {
          const collectionProductsData = await collectionProductsResponse.json();
          const collectionProducts = collectionProductsData.products || [];
          
          // Map each product to this collection
          collectionProducts.forEach(product => {
            if (!productCollectionMap.has(product.id)) {
              productCollectionMap.set(product.id, []);
            }
            productCollectionMap.get(product.id).push(collection.title.toLowerCase());
          });
        }
      }
    }
    
    console.log(`Found ${allProducts.length} total products in store`);
    if (allProducts.length > 0) {
      console.log('Sample product info:');
      allProducts.slice(0, 3).forEach(p => {
        const collections = productCollectionMap.get(p.id) || [];
        console.log(`- "${p.title}" | Type: ${p.product_type} | Collections: [${collections.join(', ')}]`);
      });
    }

    let taggedCount = 0;
    const results = [];

    for (const mapping of mappings) {
      console.log(`Processing mapping for: ${mapping.product_name}`);
      
      try {
        // Use collection-based matching for more accurate tagging
        const productName = mapping.product_name.toLowerCase();
        let matchingProducts = [];
        
        if (productName.includes('match')) {
          // Look for products in matches/accessories collections or with "match" in title
          matchingProducts = allProducts.filter(product => {
            const title = product.title.toLowerCase();
            const collections = productCollectionMap.get(product.id) || [];
            return title.includes('match') && !title.includes('matching') ||
                   collections.some(col => col.includes('match') || col.includes('accessor'));
          });
        } else if (productName.includes('wick trimmer')) {
          // Look for wick trimmers in accessories or tools collections
          matchingProducts = allProducts.filter(product => {
            const title = product.title.toLowerCase();
            const productType = (product.product_type || '').toLowerCase();
            const collections = productCollectionMap.get(product.id) || [];
            return (title.includes('wick') && title.includes('trimmer')) || 
                   productType.includes('wick trimmer') ||
                   collections.some(col => col.includes('accessor') || col.includes('tool'));
          });
        } else if (productName.includes('7oz candle')) {
          // Look for products in candle collections, excluding melts
          matchingProducts = allProducts.filter(product => {
            const title = product.title.toLowerCase();
            const productType = (product.product_type || '').toLowerCase();
            const collections = productCollectionMap.get(product.id) || [];
            return ((title.includes('candle') || productType.includes('candle')) && 
                   !title.includes('melt') && 
                   !title.includes('trimmer') && 
                   !title.includes('warmer')) ||
                   collections.some(col => col.includes('candle') && !col.includes('melt'));
          });
        } else if (productName.includes('wax melt')) {
          // Look for products in wax melts collections
          matchingProducts = allProducts.filter(product => {
            const title = product.title.toLowerCase();
            const productType = (product.product_type || '').toLowerCase();
            const collections = productCollectionMap.get(product.id) || [];
            return title.includes('melt') || 
                   productType.includes('melt') ||
                   title.includes('wax melt warmer') ||
                   collections.some(col => col.includes('melt') || col.includes('wax'));
          });
        }

        console.log(`Found ${matchingProducts.length} products for ${mapping.product_name}`);
        
        if (matchingProducts.length > 0) {
          const sampleProducts = matchingProducts.slice(0, 3).map(p => {
            const collections = productCollectionMap.get(p.id) || [];
            return `"${p.title}" (Collections: [${collections.join(', ')}])`;
          });
          console.log('Matching products:', sampleProducts);
        }

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