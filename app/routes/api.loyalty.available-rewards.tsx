import type { LoaderFunction } from "@remix-run/node";
import { supabase } from "@/integrations/supabase/client";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const accountId = url.searchParams.get('accountId');

  if (!accountId) {
    return new Response(
      JSON.stringify({ error: 'accountId parameter is required' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }

  try {
    // Call the loyalty-lookup edge function to get available rewards
    const { data, error } = await supabase.functions.invoke('loyalty-lookup', {
      body: { customer_id: null, phone: null, email: null, accountId }
    });

    if (error) {
      console.error('Loyalty available rewards error:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Return the available rewards (issued but not redeemed)
    const availableRewards = data.available_rewards || [];

    return new Response(
      JSON.stringify(availableRewards),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('API loyalty available rewards error:', error);
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