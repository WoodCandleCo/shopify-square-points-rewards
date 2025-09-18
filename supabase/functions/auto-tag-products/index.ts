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

    // Get Shopify credentials
    const shopifyStoreUrl = Deno.env.get('SHOPIFY_STORE_URL');
    const shopifyAccessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');

    if (!shopifyStoreUrl || !shopifyAccessToken) {
      throw new Error('Missing Shopify credentials');
    }

    console.log('Starting automatic product tagging...');

    // Get product mappings from database
    const { data: mappings, error: mappingsError } = await supabaseClient
      .from('product_mappings')
      .select('*')
      .eq('is_active', true);

    if (mappingsError) {
      throw new Error(`Failed to get product mappings: ${mappingsError.message}`);
    }

    let taggedCount = 0;
    const results = [];

    for (const mapping of mappings) {
      console.log(`Processing mapping for: ${mapping.product_name}`);
      
      try {
        // Search for products by name/title
        const searchTerms = [
          mapping.product_name.toLowerCase(),
          mapping.product_name.replace(/\s+/g, ''),
          mapping.product_name.split(' ')[0] // First word
        ];

        let foundProducts = [];

        for (const searchTerm of searchTerms) {
          const response = await fetch(
            `https://${shopifyStoreUrl}/admin/api/2024-10/products.json?title=${encodeURIComponent(searchTerm)}&limit=10`,
            {
              headers: {
                'X-Shopify-Access-Token': shopifyAccessToken,
                'Content-Type': 'application/json'
              }
            }
          );

          if (response.ok) {
            const data = await response.json();
            foundProducts = foundProducts.concat(data.products || []);
          }
        }

        // Remove duplicates
        foundProducts = foundProducts.filter((product, index, self) => 
          index === self.findIndex(p => p.id === product.id)
        );

        console.log(`Found ${foundProducts.length} products for ${mapping.product_name}`);

        // Filter products that likely match our item
        const matchingProducts = foundProducts.filter(product => {
          const title = product.title.toLowerCase();
          const productName = mapping.product_name.toLowerCase();
          
          return title.includes(productName) || 
                 productName.includes(title) ||
                 title.includes(productName.split(' ')[0]);
        });

        console.log(`${matchingProducts.length} products match criteria for ${mapping.product_name}`);

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
                tag_added: mapping.shopify_tag,
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
            error: 'No matching products found'
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