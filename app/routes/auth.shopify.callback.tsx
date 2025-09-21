import type { LoaderFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const shop = url.searchParams.get("state");
  
  if (!code || !shop) {
    throw new Response("Missing code or shop parameter", { status: 400 });
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch(`https://${shop}.myshopify.com/admin/oauth/access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();
    
    if (!tokenResponse.ok) {
      throw new Error(tokenData.error_description || "Failed to get access token");
    }

    // Store the shop and access token (you might want to save this to your database)
    const accessToken = tokenData.access_token;
    
    // Redirect to the app with shop parameter for embedded experience
    return redirect(`/?shop=${shop}&embedded=1&access_token=${accessToken}`);
  } catch (error) {
    console.error("OAuth callback error:", error);
    throw new Response("Authentication failed", { status: 500 });
  }
};