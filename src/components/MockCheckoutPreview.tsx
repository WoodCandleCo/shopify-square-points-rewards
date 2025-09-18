import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, Minus, Plus, Trash2, Gift } from "lucide-react";

const MockCheckoutPreview = () => {
  const [loyaltyAccount, setLoyaltyAccount] = useState<any>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showRewards, setShowRewards] = useState(false);
  const [cartItems] = useState([
    { id: 1, name: 'Apple Harvest Candle', price: 16.00, quantity: 1, image: '/api/placeholder/80/80' },
    { id: 2, name: 'Amber + Sandalwood Wax Melt', price: 8.00, quantity: 1, image: '/api/placeholder/80/80' },
    { id: 3, name: 'Amber + Sandalwood Candle', price: 12.00, quantity: 2, image: '/api/placeholder/80/80' },
  ]);

  const mockRewards = [
    { id: '1', name: '$5 Off', points_required: 500, discount_value: 5 },
    { id: '2', name: '$10 Off', points_required: 1000, discount_value: 10 },
    { id: '3', name: 'Free Shipping', points_required: 750, discount_value: 0 },
  ];

  const connectLoyaltyAccount = () => {
    if (!phoneNumber) return;
    
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setLoyaltyAccount({
        id: 'mock_account',
        balance: 1250,
        lifetime_points: 3500
      });
      setIsLoading(false);
    }, 1000);
  };

  const redeemReward = (reward: any) => {
    if (loyaltyAccount) {
      setLoyaltyAccount({
        ...loyaltyAccount,
        balance: loyaltyAccount.balance - reward.points_required
      });
    }
  };

  const calculateTotal = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-6 w-6" />
            Cart Drawer Preview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            This preview shows how your loyalty program will appear in the Shopify cart drawer - perfect for Basic plan compatibility.
          </div>
          
          {/* Mock Cart Drawer */}
          <div className="bg-slate-800 text-white p-6 rounded-lg max-w-md mx-auto">
            {/* Cart Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2">
                CART <Badge variant="secondary" className="bg-slate-600">{cartItems.length}</Badge>
              </h3>
              <Button variant="ghost" size="sm" className="text-white hover:bg-slate-700">
                ✕
              </Button>
            </div>

            {/* Cart Items */}
            <div className="space-y-4 mb-6">
              {cartItems.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <div className="w-16 h-16 bg-slate-600 rounded-lg flex items-center justify-center">
                    <div className="w-12 h-12 bg-slate-500 rounded"></div>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{item.name}</h4>
                    <p className="text-slate-300 text-sm">${item.price.toFixed(2)}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0 bg-slate-600 border-slate-500">
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-sm w-8 text-center">{item.quantity}</span>
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0 bg-slate-600 border-slate-500">
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-white">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Loyalty Widget - The Main Feature */}
            <div className="bg-slate-700 rounded-lg p-4 mb-4">
              <div 
                className="flex items-center justify-between cursor-pointer mb-3"
                onClick={() => setShowRewards(!showRewards)}
              >
                <div className="flex items-center gap-2">
                  <Gift className="h-4 w-4 text-yellow-400" />
                  <span className="font-medium">Loyalty Rewards</span>
                </div>
                <span className="text-yellow-400">{showRewards ? '−' : '+'}</span>
              </div>
              
              {showRewards && (
                <div className="space-y-3">
                  {!loyaltyAccount ? (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-300">Enter phone to access rewards</p>
                      <Input
                        placeholder="+1 (555) 123-4567"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        disabled={isLoading}
                        className="bg-slate-600 border-slate-500 text-white placeholder:text-slate-400"
                      />
                      <Button 
                        onClick={connectLoyaltyAccount}
                        disabled={isLoading || !phoneNumber}
                        className="w-full bg-green-600 hover:bg-green-700"
                        size="sm"
                      >
                        Connect Account
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-slate-400">Balance</p>
                          <p className="text-sm font-bold text-green-400">{loyaltyAccount.balance} pts</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Lifetime</p>
                          <p className="text-sm font-bold">{loyaltyAccount.lifetime_points} pts</p>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <p className="text-xs text-slate-300">Available Rewards:</p>
                        {mockRewards
                          .filter(reward => reward.points_required <= loyaltyAccount.balance)
                          .map(reward => (
                            <div key={reward.id} className="flex items-center justify-between p-2 bg-slate-600 rounded">
                              <div>
                                <p className="text-sm font-medium">{reward.name}</p>
                                <p className="text-xs text-slate-400">{reward.points_required} points</p>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => redeemReward(reward)}
                                className="h-6 text-xs px-2 bg-blue-600 hover:bg-blue-700"
                              >
                                Redeem
                              </Button>
                            </div>
                          ))
                        }
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Discount Section */}
            <div className="border-t border-slate-600 pt-4 mb-4">
              <div className="flex items-center justify-between cursor-pointer">
                <span className="font-medium">DISCOUNT</span>
                <span>+</span>
              </div>
            </div>

            {/* Total */}
            <div className="space-y-2 mb-6">
              <div className="flex justify-between">
                <span>Estimated total</span>
                <span className="text-xl font-bold">${calculateTotal().toFixed(2)} USD</span>
              </div>
              <p className="text-xs text-slate-400">Taxes and shipping calculated at checkout.</p>
            </div>

            {/* Checkout Buttons */}
            <div className="space-y-3">
              <Button className="w-full bg-white text-black hover:bg-slate-100">
                Check out
              </Button>
              <Button className="w-full bg-purple-600 hover:bg-purple-700">
                <span className="font-bold">shop</span>
              </Button>
              <Button className="w-full bg-yellow-500 text-black hover:bg-yellow-400">
                PayPal
              </Button>
              <Button className="w-full bg-white text-black hover:bg-slate-100">
                G Pay
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Implementation Guide */}
      <Card>
        <CardHeader>
          <CardTitle>🎯 Cart Integration Benefits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium text-green-600">✅ Works with Basic Plan</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• No Shopify Plus required</li>
                <li>• Full UI control</li>
                <li>• Rich interactive experience</li>
                <li>• Custom styling freedom</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-blue-600">⚡ Customer Experience</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• See rewards before checkout</li>
                <li>• Apply discounts instantly</li>
                <li>• Connect loyalty account easily</li>
                <li>• View points balance in cart</li>
              </ul>
            </div>
          </div>
          
          <Separator />
          
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">📋 Implementation Options</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p><strong>Cart Page:</strong> Full-screen loyalty widget on cart.liquid</p>
              <p><strong>Cart Drawer:</strong> Slide-out panel integration (shown above)</p>
              <p><strong>Theme App Extension:</strong> Merchants can add via theme editor</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MockCheckoutPreview;