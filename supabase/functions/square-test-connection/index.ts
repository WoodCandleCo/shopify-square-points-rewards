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
    const SQUARE_ACCESS_TOKEN = Deno.env.get('SQUARE_ACCESS_TOKEN')
    const SQUARE_APPLICATION_ID = Deno.env.get('SQUARE_APPLICATION_ID')

    if (!SQUARE_ACCESS_TOKEN || !SQUARE_APPLICATION_ID) {
      throw new Error('Square credentials not configured')
    }

    // Test the Square API connection by calling a simple endpoint
    const response = await fetch('https://connect.squareupsandbox.com/v2/locations', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Square-Version': '2024-01-18',
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Square API error: ${response.status}`)
    }

    const data = await response.json()
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Square API connection successful',
        locations: data.locations?.length || 0
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})