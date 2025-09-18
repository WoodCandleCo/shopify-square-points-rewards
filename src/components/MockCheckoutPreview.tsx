import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ChevronDown, ChevronUp } from "lucide-react";

interface MockCheckoutPreviewProps {
  showLoyaltyWidget?: boolean;
}

const MockCheckoutPreview: React.FC<MockCheckoutPreviewProps> = ({ 
  showLoyaltyWidget = true 
}) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loyaltyAccount, setLoyaltyAccount] = useState<any>(null);
  const [showRewards, setShowRewards] = useState(false);

  const mockLoyaltyAccount = {
    balance: 1250,
    points_earned_lifetime: 5430
  };

  const mockRewards = [
    { id: '1', name: '$5 Off Purchase', points_required: 500, discount_amount: 500, discount_type: 'FIXED_AMOUNT' },
    { id: '2', name: '10% Off Order', points_required: 1000, discount_amount: 10, discount_type: 'PERCENTAGE' },
    { id: '3', name: 'Free Shipping', points_required: 750, discount_amount: 0, discount_type: 'FREE_SHIPPING' }
  ];

  const availableRewards = mockRewards.filter(r => r.points_required <= (loyaltyAccount?.balance || 0));

  const handlePhoneSubmit = () => {
    if (phoneNumber) {
      setLoyaltyAccount(mockLoyaltyAccount);
    }
  };

  const redeemReward = (reward: any) => {
    if (loyaltyAccount) {
      setLoyaltyAccount({
        ...loyaltyAccount,
        balance: loyaltyAccount.balance - reward.points_required
      });
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white border rounded-lg shadow-sm">
      {/* Mock Shopify Checkout Header */}
      <div className="p-4 bg-gray-50 border-b">
        <h3 className="font-medium text-gray-900">Checkout</h3>
        <p className="text-sm text-gray-600">Complete your purchase</p>
      </div>

      {/* Mock Cart Items */}
      <div className="p-4 border-b">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium">Wireless Headphones</span>
          <span className="text-sm">$99.99</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Qty: 1</span>
        </div>
      </div>

      {/* Loyalty Extension Preview */}
      {showLoyaltyWidget && (
        <div className="p-4 border-b bg-blue-50">
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Loyalty Program</h4>
            
            {!loyaltyAccount ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">Enter your phone number to access your loyalty points</p>
                <Input
                  placeholder="+1 (555) 123-4567"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="text-sm"
                />
                <Button 
                  onClick={handlePhoneSubmit}
                  disabled={!phoneNumber}
                  className="w-full"
                  size="sm"
                >
                  Connect Loyalty Account
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-600">Current Balance</p>
                    <p className="text-lg font-bold text-blue-600">{loyaltyAccount.balance} points</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-600">Lifetime Earned</p>
                    <p className="text-lg font-bold text-gray-900">{loyaltyAccount.points_earned_lifetime} points</p>
                  </div>
                </div>

                {availableRewards.length > 0 && (
                  <div className="space-y-2">
                    <button
                      onClick={() => setShowRewards(!showRewards)}
                      className="flex items-center justify-between w-full text-left"
                    >
                      <span className="text-sm font-medium">Available Rewards ({availableRewards.length})</span>
                      {showRewards ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {showRewards && (
                      <div className="space-y-2">
                        {availableRewards.map((reward) => (
                          <div key={reward.id} className="border rounded p-3 bg-white">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-sm font-medium">{reward.name}</p>
                                <p className="text-xs text-gray-600">
                                  {reward.discount_type === 'PERCENTAGE' 
                                    ? `${reward.discount_amount}% off` 
                                    : reward.discount_type === 'FREE_SHIPPING'
                                    ? 'Free shipping'
                                    : `$${(reward.discount_amount / 100).toFixed(2)} off`}
                                </p>
                                <p className="text-xs text-gray-500">{reward.points_required} points required</p>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => redeemReward(reward)}
                                disabled={loyaltyAccount.balance < reward.points_required}
                                className="text-xs"
                              >
                                Redeem
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mock Checkout Summary */}
      <div className="p-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <span>$99.99</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Shipping</span>
            <span>$5.99</span>
          </div>
          <Separator />
          <div className="flex justify-between font-medium">
            <span>Total</span>
            <span>$105.98</span>
          </div>
        </div>
        
        <Button className="w-full mt-4">
          Complete Purchase
        </Button>
      </div>
    </div>
  );
};

export default MockCheckoutPreview;