import type { LoaderFunction } from "@remix-run/node";

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  
  if (!shop) {
    throw new Response("Missing shop parameter", { status: 400 });
  }

  // Shopify OAuth URL
  const scopes = "read_customers,read_orders,write_customers,write_orders,write_products";
  const redirectUri = `${process.env.APPLICATION_URL || url.origin}/auth/shopify/callback`;
  const clientId = process.env.SHOPIFY_API_KEY;
  
  const authUrl = new URL(`https://${shop}.myshopify.com/admin/oauth/authorize`);
  authUrl.searchParams.set("client_id", clientId!);
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", shop);

  return Response.redirect(authUrl.toString());
};