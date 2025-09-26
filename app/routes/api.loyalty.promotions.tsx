import type { LoaderFunction } from "@remix-run/node";
import { supabase } from "@/integrations/supabase/client";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const programId = url.searchParams.get('programId');
  const customerId = url.searchParams.get('customerId');
  const loyaltyAccountId = url.searchParams.get('loyaltyAccountId');

  try {
    // Call the loyalty-promotions edge function
    const { data, error } = await supabase.functions.invoke('loyalty-promotions', {
      body: { programId, customerId, loyaltyAccountId }
    });

    if (error) {
      console.error('Loyalty promotions error:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Filter and format for the expected UI response
    const activePromotions = data.promotions?.map((promo: any) => ({
      id: promo.id,
      name: promo.name,
      summary: promo.description,
      startsAt: promo.available_time?.start_date,
      endsAt: promo.available_time?.end_date
    })) || [];

    return new Response(
      JSON.stringify(activePromotions),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('API loyalty promotions error:', error);
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