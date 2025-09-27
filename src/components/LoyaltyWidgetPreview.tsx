import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Gift, Minus, Plus, Trash2 } from "lucide-react";

const LoyaltyWidgetPreview = () => {
  // Add Europa font to preview
  useEffect(() => {
    const europaFont = document.createElement('link');
    europaFont.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap';
    europaFont.rel = 'stylesheet';
    document.head.appendChild(europaFont);
    
    // Add custom CSS for Europa-like styling in preview
    const previewStyle = document.createElement('style');
    previewStyle.textContent = `
      .loyalty-preview-europa {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-weight: 500;
        letter-spacing: 0.02em;
      }
      .loyalty-preview-europa * {
        text-transform: uppercase;
      }
      .loyalty-preview-europa input {
        text-transform: none !important;
      }
    `;
    document.head.appendChild(previewStyle);
    
    return () => {
      document.head.removeChild(europaFont);
      document.head.removeChild(previewStyle);
    };
  }, []);
  const { toast } = useToast();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loyaltyAccount, setLoyaltyAccount] = useState<any>(null);
  const [rewards, setRewards] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadRewards();
  }, []);

  const loadRewards = async () => {
    try {
      const { data } = await supabase
        .from('loyalty_rewards')
        .select('*')
        .eq('is_active', true)
        .order('points_required', { ascending: true });
      
      if (data) {
        setRewards(data);
      }
    } catch (error) {
      console.error('Error loading rewards:', error);
    }
  };

  const connectAccount = async () => {
    if (!phoneNumber) return;
    
    setIsLoading(true);
    
    try {
      // Use actual loyalty lookup function
      const response = await fetch(`${window.location.origin}/api/loyalty/lookup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: phoneNumber,
          customer_id: 'demo_customer_123',
          email: 'demo@example.com'
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.loyalty_account) {
          setLoyaltyAccount({
            id: data.loyalty_account.id,
            balance: data.loyalty_account.balance,
            lifetime_points: data.loyalty_account.points_earned_lifetime
          });
          toast({
            title: "Account Connected",
            description: `Connected with ${data.loyalty_account.balance} points balance`
          });
        } else {
          throw new Error('No loyalty account found');
        }
      } else {
        // Fallback to demo data for preview
        const mockAccount = {
          id: 'demo_account',
          balance: 785,
          lifetime_points: 1250
        };
        setLoyaltyAccount(mockAccount);
        toast({
          title: "Demo Account Connected",
          description: `Demo mode - ${mockAccount.balance} points balance`
        });
      }
    } catch (error) {
      console.error('Error connecting account:', error);
      // Fallback to demo data
      const mockAccount = {
        id: 'demo_account',
        balance: 785,
        lifetime_points: 1250
      };
      setLoyaltyAccount(mockAccount);
      toast({
        title: "Demo Account Connected",
        description: `Demo mode - ${mockAccount.balance} points balance`
      });
    } finally {
      setIsLoading(false);
    }
  };

  const redeemReward = (reward: any) => {
    if (!loyaltyAccount || loyaltyAccount.balance < reward.points_required) return;
    
    setLoyaltyAccount({
      ...loyaltyAccount,
      balance: loyaltyAccount.balance - reward.points_required
    });

    toast({
      title: "Reward Redeemed!",
      description: `${reward.name} has been applied to your cart.`
    });
  };

  const getEligibleRewards = () => {
    if (!loyaltyAccount) return [];
    return rewards.filter(reward => reward.points_required <= loyaltyAccount.balance);
  };

  return (
    <div className="space-y-6">
      {/* Shopify Cart Page Layout Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Cart Page Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-slate-700 text-white rounded-lg p-6 max-w-4xl mx-auto loyalty-preview-europa">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Cart Items Section */}
              <div className="lg:col-span-2">
                <div className="flex items-center gap-3 mb-6">
                  <h1 className="text-2xl font-semibold">Cart</h1>
                  <Badge variant="secondary" className="bg-slate-600">4</Badge>
                </div>

                {/* Sample Cart Items */}
                <div className="space-y-6">
                  <div className="flex gap-4 pb-6 border-b border-slate-600">
                    <div className="w-20 h-20 bg-slate-600 rounded-lg"></div>
                    <div className="flex-1">
                      <h3 className="font-medium">Camp | 3oz Melt</h3>
                      <p className="text-slate-400 text-sm">$8.00</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0 bg-slate-600 border-slate-500">
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center">1</span>
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0 bg-slate-600 border-slate-500">
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">$8.00</p>
                    </div>
                  </div>

                  <div className="flex gap-4 pb-6 border-b border-slate-600">
                    <div className="w-20 h-20 bg-slate-600 rounded-lg"></div>
                    <div className="flex-1">
                      <h3 className="font-medium">Apple Harvest</h3>
                      <p className="text-slate-400 text-sm">$16.00</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0 bg-slate-600 border-slate-500">
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center">1</span>
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0 bg-slate-600 border-slate-500">
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">$16.00</p>
                    </div>
                  </div>

                  <div className="flex gap-4 pb-6 border-b border-slate-600">
                    <div className="w-20 h-20 bg-slate-600 rounded-lg"></div>
                    <div className="flex-1">
                      <h3 className="font-medium">Amber + Sandalwood | 3oz Melt</h3>
                      <p className="text-slate-400 text-sm">$8.00</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0 bg-slate-600 border-slate-500">
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center">2</span>
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0 bg-slate-600 border-slate-500">
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">$16.00</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cart Summary Section */}
              <div className="lg:col-span-1">
                {/* Loyalty Widget - This is the key preview */}
                <div className="bg-slate-600 border border-slate-500 rounded-xl p-4 mb-6 loyalty-preview-europa" style={{textTransform: 'uppercase'}}>
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-500">
                    <Gift className="h-4 w-4 text-white" />
                    <span className="font-bold text-sm uppercase tracking-wider text-white">
                      Loyalty Rewards
                    </span>
                  </div>

                  <div className="space-y-3">
                    {!loyaltyAccount ? (
                      <div>
                        <p className="text-sm text-slate-300 mb-2">Enter phone to access rewards</p>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Phone number"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            className="flex-1 bg-slate-200 text-slate-900 border-0 text-sm"
                            disabled={isLoading}
                          />
                          <Button 
                            onClick={connectAccount}
                            disabled={isLoading || !phoneNumber}
                            className="bg-slate-200 text-slate-900 hover:bg-slate-300 text-sm px-4"
                          >
                            {isLoading ? '...' : 'Search'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="bg-slate-500 border border-slate-400 rounded-lg p-3 mb-3">
                          <p className="text-sm font-medium text-white">
                            Points Balance: <span className="text-green-400">{loyaltyAccount.balance}</span>
                          </p>
                        </div>

                        <div>
                          <p className="text-sm font-medium text-white mb-2">Available Rewards:</p>
                          <div className="space-y-2">
                            {getEligibleRewards().length > 0 ? (
                              getEligibleRewards().map(reward => (
                                <div key={reward.id} className="flex items-center justify-between p-2 bg-slate-500 border border-slate-400 rounded-lg">
                                  <div className="flex items-baseline justify-between flex-1 mr-3">
                                    <div className="text-sm font-medium text-white flex-1">
                                      {reward.name}
                                    </div>
                                    <div className="text-xs text-slate-300 whitespace-nowrap ml-2">
                                      {reward.points_required} points
                                    </div>
                                  </div>
                                  <Button
                                    size="sm"
                                    onClick={() => redeemReward(reward)}
                                    className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 h-auto"
                                  >
                                    Redeem
                                  </Button>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-slate-400 italic">
                                No rewards available at your current points level
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Special Instructions */}
                <div className="border border-slate-600 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium">Special Instructions</span>
                    <span className="text-slate-400">+</span>
                  </div>
                </div>

                {/* Discount */}
                <div className="border border-slate-600 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium">Discount</span>
                    <span className="text-slate-400">+</span>
                  </div>
                </div>

                {/* Cart Totals */}
                <div className="space-y-3">
                  <div className="flex justify-between text-white">
                    <span>Estimated total</span>
                    <span className="font-medium">$40.00 USD</span>
                  </div>
                  <p className="text-sm text-slate-400">
                    Taxes and shipping calculated at checkout.
                  </p>
                  <Button className="w-full bg-white text-slate-900 hover:bg-slate-100 font-medium">
                    Check out
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Design Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Widget Design Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 text-sm">
            <div>
              <strong>Layout:</strong> The widget appears at the top of the cart summary column, above Special Instructions and Discount sections.
            </div>
            <div>
              <strong>Styling:</strong> Enhanced contrast background with subtle border to stand out from other cart elements.
            </div>
            <div>
              <strong>Responsive:</strong> Adapts to both cart drawer (mobile) and cart page (desktop) layouts.
            </div>
            <div>
              <strong>Rewards Display:</strong> Description and points are now on the same line with proper alignment.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoyaltyWidgetPreview;