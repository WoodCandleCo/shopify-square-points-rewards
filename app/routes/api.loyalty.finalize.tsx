import type { ActionFunction } from "@remix-run/node";
import { supabase } from "@/integrations/supabase/client";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const action: ActionFunction = async ({ request }) => {
  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const { rewardId, success, shopifyOrderId } = await request.json();

    if (!rewardId || typeof success !== 'boolean') {
      return new Response(
        JSON.stringify({ error: 'rewardId and success (boolean) are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Call the loyalty-finalize edge function
    const { data, error } = await supabase.functions.invoke('loyalty-finalize', {
      body: { rewardId, success, shopifyOrderId }
    });

    if (error) {
      console.error('Loyalty finalize error:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, ...data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('API loyalty finalize error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
};