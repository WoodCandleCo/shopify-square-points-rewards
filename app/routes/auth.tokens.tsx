import type { LoaderFunction } from "@remix-run/node";

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  
  // This endpoint is used by Shopify to validate the app installation
  // Return app metadata or redirect to main app
  if (shop) {
    return Response.redirect(`/?shop=${shop}&embedded=1`);
  }
  
  return Response.redirect("/");
};