import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Gift, Calendar, Percent, DollarSign, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Promotion {
  id: string;
  name: string;
  status: string;
  description: string;
  incentive_type: string;
  incentive_value: any;
  available_time: {
    start_date?: string;
    end_date?: string;
  };
  customer_eligible: boolean;
  eligibility_reason: string | null;
  minimum_spend: any;
  maximum_discount: any;
}

interface LoyaltyPromotionsWidgetProps {
  customerId?: string;
  loyaltyAccountId?: string;
  onDiscountGenerated?: (discountCode: string, promotion: Promotion) => void;
  className?: string;
}

export default function LoyaltyPromotionsWidget({
  customerId,
  loyaltyAccountId,
  onDiscountGenerated,
  className = ''
}: LoyaltyPromotionsWidgetProps) {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(false);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (customerId || loyaltyAccountId) {
      fetchPromotions();
    }
  }, [customerId, loyaltyAccountId]);

  const fetchPromotions = async () => {
    if (!customerId && !loyaltyAccountId) return;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (customerId) params.append('customerId', customerId);
      if (loyaltyAccountId) params.append('loyaltyAccountId', loyaltyAccountId);

      const { data, error } = await supabase.functions.invoke('loyalty-promotions', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (error) throw error;

      setPromotions(data.promotions || []);
    } catch (error: any) {
      console.error('Error fetching promotions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load promotions. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const redeemPromotion = async (promotion: Promotion) => {
    if (!loyaltyAccountId) {
      toast({
        title: 'Error',
        description: 'Loyalty account required to redeem promotions.',
        variant: 'destructive',
      });
      return;
    }

    setRedeeming(promotion.id);
    try {
      const { data, error } = await supabase.functions.invoke('loyalty-promotion-redeem', {
        body: {
          loyaltyAccountId,
          promotionId: promotion.id,
          customerId
        }
      });

      if (error) throw error;

      toast({
        title: 'Promotion Redeemed!',
        description: `Your discount code: ${data.discountCode}`,
      });

      // Call the callback with the discount code
      if (onDiscountGenerated && data.discountCode) {
        onDiscountGenerated(data.discountCode, promotion);
      }

      // Auto-apply the discount by redirecting to Shopify discount URL
      if (data.discountCode) {
        const discountUrl = `/discount/${encodeURIComponent(data.discountCode)}?return_to=/cart`;
        window.location.href = discountUrl;
      }

    } catch (error: any) {
      console.error('Error redeeming promotion:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to redeem promotion. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setRedeeming(null);
    }
  };

  const formatIncentiveValue = (promotion: Promotion) => {
    if (!promotion.incentive_value) return '';
    
    if (promotion.incentive_type === 'PERCENTAGE_DISCOUNT') {
      return `${promotion.incentive_value}% off`;
    } else if (promotion.incentive_type === 'FIXED_DISCOUNT') {
      const amount = promotion.incentive_value.amount || promotion.incentive_value;
      return `$${(amount / 100).toFixed(2)} off`;
    }
    return '';
  };

  const formatMinimumSpend = (promotion: Promotion) => {
    if (!promotion.minimum_spend?.amount) return '';
    return `Minimum spend: $${(promotion.minimum_spend.amount / 100).toFixed(2)}`;
  };

  const formatExpiryDate = (promotion: Promotion) => {
    if (!promotion.available_time?.end_date) return '';
    const endDate = new Date(promotion.available_time.end_date);
    return `Expires: ${endDate.toLocaleDateString()}`;
  };

  const getPromotionIcon = (promotion: Promotion) => {
    if (promotion.eligibility_reason === 'birthday_month') {
      return <Gift className="h-5 w-5 text-pink-500" />;
    }
    if (promotion.incentive_type === 'PERCENTAGE_DISCOUNT') {
      return <Percent className="h-5 w-5 text-green-500" />;
    }
    return <DollarSign className="h-5 w-5 text-blue-500" />;
  };

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (promotions.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <Gift className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No promotions available at this time.</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <Gift className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Special Promotions</h3>
      </div>

      <div className="grid gap-4">
        {promotions.map((promotion) => (
          <Card key={promotion.id} className="relative overflow-hidden">
            {promotion.customer_eligible && (
              <div className="absolute top-0 right-0 bg-gradient-to-l from-pink-500 to-purple-500 text-white px-3 py-1 text-xs font-medium">
                {promotion.eligibility_reason === 'birthday_month' ? '🎉 Birthday Special' : 'Eligible'}
              </div>
            )}
            
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {getPromotionIcon(promotion)}
                  <CardTitle className="text-base">{promotion.name}</CardTitle>
                </div>
                <Badge variant={promotion.customer_eligible ? 'default' : 'secondary'}>
                  {formatIncentiveValue(promotion)}
                </Badge>
              </div>
              {promotion.description && (
                <CardDescription>{promotion.description}</CardDescription>
              )}
            </CardHeader>

            <CardContent className="pt-0">
              <div className="space-y-2 text-sm text-muted-foreground mb-4">
                {promotion.minimum_spend && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    <span>{formatMinimumSpend(promotion)}</span>
                  </div>
                )}
                
                {promotion.available_time?.end_date && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>{formatExpiryDate(promotion)}</span>
                  </div>
                )}
                
                {promotion.eligibility_reason === 'birthday_month' && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-pink-500" />
                    <span className="text-pink-600 font-medium">Happy Birthday Month! 🎂</span>
                  </div>
                )}
              </div>

              <Button
                onClick={() => redeemPromotion(promotion)}
                disabled={redeeming === promotion.id || !promotion.customer_eligible}
                className="w-full"
                variant={promotion.customer_eligible ? 'default' : 'outline'}
              >
                {redeeming === promotion.id ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Redeeming...
                  </>
                ) : promotion.customer_eligible ? (
                  'Redeem Now'
                ) : (
                  'Not Eligible'
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-xs text-muted-foreground text-center">
        Promotions are automatically applied to your cart when redeemed
      </div>
    </div>
  );
}