import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import Index from "@/pages/Index";
import Admin from "@/pages/Admin";
import Auth from "@/pages/Auth";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => {
  const [shopifyParams, setShopifyParams] = useState<{
    shop?: string;
    embedded?: boolean;
    accessToken?: string;
  }>({});

  useEffect(() => {
    try {
      // Parse Shopify app parameters from URL
      const urlParams = new URLSearchParams(window.location.search);
      const shop = urlParams.get('shop');
      const embedded = urlParams.get('embedded') === '1';
      const accessToken = urlParams.get('access_token');

      if (shop || embedded) {
        setShopifyParams({ shop: shop || undefined, embedded, accessToken: accessToken || undefined });
        
        // Store shop info for the session
        if (shop) {
          sessionStorage.setItem('shopify_shop', shop);
        }
        if (accessToken) {
          sessionStorage.setItem('shopify_access_token', accessToken);
        }
      }

      // Check for stored shop info
      const storedShop = sessionStorage.getItem('shopify_shop');
      const storedToken = sessionStorage.getItem('shopify_access_token');
      if (storedShop || storedToken) {
        setShopifyParams(prev => ({
          ...prev,
          shop: prev.shop || storedShop || undefined,
          accessToken: prev.accessToken || storedToken || undefined,
          embedded: prev.embedded || true
        }));
      }
    } catch (error) {
      console.warn('Error parsing URL parameters:', error);
    }
  }, []);

  // If this is a Shopify embedded app, add Shopify App Bridge styles
  useEffect(() => {
    if (shopifyParams.embedded && shopifyParams.shop) {
      document.body.classList.add('shopify-embedded');
      
      // Add embedded app styles
      const style = document.createElement('style');
      style.textContent = `
        .shopify-embedded {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .shopify-embedded .app-content {
          padding: 20px;
          max-width: 100%;
        }
      `;
      document.head.appendChild(style);
    }
  }, [shopifyParams]);

  const isShopifyApp = shopifyParams.embedded && shopifyParams.shop;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <div className={isShopifyApp ? 'shopify-embedded' : ''}>
            <BrowserRouter>
              <Routes>
                <Route 
                  path="/" 
                  element={
                    <div className={isShopifyApp ? 'app-content' : ''}>
                      {isShopifyApp ? <Admin /> : <Index />}
                    </div>
                  } 
                />
                <Route 
                  path="/admin" 
                  element={
                    <div className={isShopifyApp ? 'app-content' : ''}>
                      <Admin />
                    </div>
                  } 
                />
                <Route path="/auth" element={<Auth />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </div>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
