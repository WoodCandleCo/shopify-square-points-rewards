import type { LoaderFunction } from "@remix-run/node";
import { supabase } from "@/integrations/supabase/client";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const programId = url.searchParams.get('programId');

  try {
    // Call the loyalty-tiers edge function
    const { data, error } = await supabase.functions.invoke('loyalty-tiers', {
      body: { programId }
    });

    if (error) {
      console.error('Loyalty tiers error:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('API loyalty tiers error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
};

export const action: LoaderFunction = async ({ request }) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return loader({ request });
};