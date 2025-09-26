import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Gift, Calendar, Percent, DollarSign, Users, Clock, Plus } from 'lucide-react';
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
  minimum_spend: any;
  maximum_discount: any;
  loyalty_program_id: string;
}

export default function LoyaltyPromotionsManager() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(false);
  const [testCustomerId, setTestCustomerId] = useState('');
  const [testResults, setTestResults] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchPromotions();
  }, []);

  const fetchPromotions = async () => {
    setLoading(true);
    try {
      // For admin view, we'll fetch all promotions without customer filter
      const { data, error } = await supabase.functions.invoke('loyalty-promotions', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (error) throw error;

      setPromotions(data.promotions || []);
      toast({
        title: 'Success',
        description: `Loaded ${data.promotions?.length || 0} promotions`,
      });
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

  const testPromotionsForCustomer = async () => {
    if (!testCustomerId) {
      toast({
        title: 'Error',
        description: 'Please enter a customer ID to test',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('loyalty-promotions', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (error) throw error;

      setTestResults(data);
      toast({
        title: 'Test Complete',
        description: `Found ${data.customer_specific_count} eligible promotions for customer`,
      });
    } catch (error: any) {
      console.error('Error testing promotions:', error);
      toast({
        title: 'Error',
        description: 'Failed to test promotions. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const formatIncentiveValue = (promotion: Promotion) => {
    if (!promotion.incentive_value) return 'Special Offer';
    
    if (promotion.incentive_type === 'PERCENTAGE_DISCOUNT') {
      return `${promotion.incentive_value}% off`;
    } else if (promotion.incentive_type === 'FIXED_DISCOUNT') {
      const amount = promotion.incentive_value.amount || promotion.incentive_value;
      return `$${(amount / 100).toFixed(2)} off`;
    }
    return 'Special Offer';
  };

  const formatDateRange = (promotion: Promotion) => {
    if (!promotion.available_time) return 'No date restrictions';
    
    const start = promotion.available_time.start_date 
      ? new Date(promotion.available_time.start_date).toLocaleDateString() 
      : 'No start date';
    const end = promotion.available_time.end_date 
      ? new Date(promotion.available_time.end_date).toLocaleDateString() 
      : 'No end date';
    
    return `${start} - ${end}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'default';
      case 'INACTIVE': return 'secondary';
      case 'ENDED': return 'destructive';
      default: return 'outline';
    }
  };

  const getPromotionIcon = (promotion: Promotion) => {
    if (promotion.name?.toLowerCase().includes('birthday')) {
      return <Gift className="h-5 w-5 text-pink-500" />;
    }
    if (promotion.incentive_type === 'PERCENTAGE_DISCOUNT') {
      return <Percent className="h-5 w-5 text-green-500" />;
    }
    return <DollarSign className="h-5 w-5 text-blue-500" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Loyalty Promotions Manager</h2>
          <p className="text-muted-foreground">
            Manage Square loyalty promotions and test customer eligibility
          </p>
        </div>
        <Button onClick={fetchPromotions} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh Promotions'}
        </Button>
      </div>

      <Tabs defaultValue="promotions" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="promotions">All Promotions</TabsTrigger>
          <TabsTrigger value="testing">Customer Testing</TabsTrigger>
        </TabsList>

        <TabsContent value="promotions" className="space-y-4">
          <div className="grid gap-4">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-32 bg-muted rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : promotions.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <Gift className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No promotions configured in Square</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Create promotions in your Square Dashboard to see them here
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              promotions.map((promotion) => (
                <Card key={promotion.id} className="relative overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {getPromotionIcon(promotion)}
                        <div>
                          <CardTitle className="text-lg">{promotion.name}</CardTitle>
                          <CardDescription className="mt-1">
                            ID: {promotion.id}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={getStatusColor(promotion.status)}>
                          {promotion.status}
                        </Badge>
                        <Badge variant="outline">
                          {formatIncentiveValue(promotion)}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Duration:</span>
                          <span className="text-muted-foreground">
                            {formatDateRange(promotion)}
                          </span>
                        </div>
                        
                        {promotion.minimum_spend && (
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">Min Spend:</span>
                            <span className="text-muted-foreground">
                              ${(promotion.minimum_spend.amount / 100).toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Gift className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Type:</span>
                          <span className="text-muted-foreground">
                            {promotion.incentive_type?.replace('_', ' ').toLowerCase() || 'Special'}
                          </span>
                        </div>

                        {promotion.name?.toLowerCase().includes('birthday') && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-pink-500" />
                            <span className="font-medium text-pink-600">Birthday Promotion</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {promotion.description && (
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm">{promotion.description}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="testing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Test Customer Eligibility</CardTitle>
              <CardDescription>
                Test which promotions a specific customer is eligible for
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customer-id">Customer ID</Label>
                  <Input
                    id="customer-id"
                    placeholder="Enter Square customer ID"
                    value={testCustomerId}
                    onChange={(e) => setTestCustomerId(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={testPromotionsForCustomer} className="w-full">
                    Test Eligibility
                  </Button>
                </div>
              </div>

              {testResults && (
                <div className="mt-6 space-y-4">
                  <h4 className="font-semibold">Test Results</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {(testResults as any).total_active_promotions}
                          </div>
                          <div className="text-sm text-muted-foreground">Total Active</div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {(testResults as any).customer_specific_count}
                          </div>
                          <div className="text-sm text-muted-foreground">Customer Eligible</div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-600">
                            {(testResults as any).environment}
                          </div>
                          <div className="text-sm text-muted-foreground">Environment</div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {(testResults as any).promotions && (
                    <div className="space-y-2">
                      <h5 className="font-medium">Eligible Promotions:</h5>
                      <div className="space-y-2">
                        {(testResults as any).promotions
                          .filter((p: any) => p.customer_eligible)
                          .map((promo: any) => (
                            <div key={promo.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                              <div>
                                <div className="font-medium">{promo.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {promo.eligibility_reason}
                                </div>
                              </div>
                              <Badge variant="default">Eligible</Badge>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}