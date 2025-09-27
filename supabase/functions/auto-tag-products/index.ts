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
          error: 'Shopify credentials not configured'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Mock auto-tagging results for demo
    const mockResults = [
      {
        product_name: 'Apple Harvest Candle',
        product_id: '123456789',
        tag_added: 'loyalty-7oz-candle',
        success: true
      },
      {
        product_name: 'Wax Melt Set',
        product_id: '987654321',
        tag_added: 'loyalty-wax-melt',
        success: true
      }
    ]

    return new Response(
      JSON.stringify({
        success: true,
        results: mockResults,
        tagged_count: mockResults.filter(r => r.success).length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error in auto-tag-products:', error)
    
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