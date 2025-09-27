import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const shopDomain = Deno.env.get('SHOPIFY_SHOP_DOMAIN')
    const accessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN')

    if (!shopDomain || !accessToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Shopify credentials not configured. Please set SHOPIFY_SHOP_DOMAIN and SHOPIFY_ACCESS_TOKEN in Supabase secrets.'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const shopifyUrl = `https://${shopDomain}/admin/api/2023-10/products.json?limit=250`
    
    const response = await fetch(shopifyUrl, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to fetch products: ${errorText}`
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const data = await response.json()
    
    return new Response(
      JSON.stringify({
        success: true,
        products: data.products || []
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error in get-shopify-products:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: `Internal server error: ${error.message}`
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})