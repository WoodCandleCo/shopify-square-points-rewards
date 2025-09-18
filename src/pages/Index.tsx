import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import LoyaltyDashboard from '@/components/LoyaltyDashboard';
import { Button } from '@/components/ui/button';
import { LogOut, Settings, Square, Gift, Users } from 'lucide-react';

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-6">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-foreground">Square Loyalty Program</h1>
            <p className="text-muted-foreground">Integrate Square loyalty into your Shopify checkout</p>
          </div>
          
          <div className="flex gap-4 justify-center">
            <Button onClick={() => navigate('/auth')}>
              Sign In
            </Button>
            <Button variant="outline" onClick={() => navigate('/admin')}>
              Admin Dashboard
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-semibold text-foreground">Square Loyalty</h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/admin')} size="sm">
              <Settings className="w-4 h-4 mr-2" />
              Admin
            </Button>
            <Button variant="outline" onClick={handleSignOut} size="sm">
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>
      <LoyaltyDashboard />
    </div>
  );
};

export default Index;
