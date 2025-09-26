import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Square, Gift, Users, Settings } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Load the production loyalty widget
    const script = document.createElement('script');
    script.src = '/loyalty-widget-production.js';
    script.async = true;
    document.head.appendChild(script);

    return () => {
      // Cleanup
      document.head.removeChild(script);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-foreground">Square Loyalty Program</h1>
            <p className="text-muted-foreground">Integrate Square loyalty into your Shopify checkout</p>
          </div>
          
          <div className="flex gap-4 justify-center">
            <Button onClick={() => navigate('/admin')}>
              <Settings className="w-4 h-4 mr-2" />
              Admin Dashboard
            </Button>
            <Button onClick={() => navigate('/auth')} variant="outline">
              Sign In
            </Button>
          </div>
          
          <div className="grid gap-6 md:grid-cols-3 max-w-3xl mx-auto mt-12">
            <div className="text-center space-y-2">
              <Square className="w-8 h-8 mx-auto text-primary" />
              <h3 className="font-semibold">Square Integration</h3>
              <p className="text-sm text-muted-foreground">Connect your existing Square loyalty program</p>
            </div>
            <div className="text-center space-y-2">
              <Gift className="w-8 h-8 mx-auto text-primary" />
              <h3 className="font-semibold">Checkout Rewards</h3>
              <p className="text-sm text-muted-foreground">Customers redeem points during Shopify checkout</p>
            </div>
            <div className="text-center space-y-2">
              <Users className="w-8 h-8 mx-auto text-primary" />
              <h3 className="font-semibold">Customer Lookup</h3>
              <p className="text-sm text-muted-foreground">Find accounts by phone number or login</p>
            </div>
          </div>
          
          <div className="mt-12 p-6 bg-card rounded-lg border max-w-2xl mx-auto">
            <h3 className="text-lg font-semibold mb-2">How it works:</h3>
            <ol className="text-left text-sm text-muted-foreground space-y-1">
              <li>1. Configure your Square API credentials in the admin dashboard</li>
              <li>2. Deploy the checkout extension to your Shopify store</li>
              <li>3. Customers can access loyalty points during checkout</li>
              <li>4. Points are redeemed automatically with discounts applied</li>
            </ol>
          </div>

          <div className="mt-8 p-6 bg-card rounded-lg border max-w-2xl mx-auto">
            <h3 className="text-lg font-semibold mb-4">Test Customer Widget</h3>
            <div id="square-loyalty-widget"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
