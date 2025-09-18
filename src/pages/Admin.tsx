import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Settings, Eye, Gift } from "lucide-react";
import MockCheckoutPreview from "@/components/MockCheckoutPreview";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const AdminDashboard = () => {
  const { settings, loading, updateSetting, testSquareConnection } = useAppSettings();
  const { toast } = useToast();
  const [rewards, setRewards] = useState([]);
  const [loadingRewards, setLoadingRewards] = useState(false);

  useEffect(() => {
    loadRewards();
  }, []);

  const loadRewards = async () => {
    try {
      const { data, error } = await supabase
        .from('loyalty_rewards')
        .select('*')
        .order('points_required', { ascending: true });

      if (error) throw error;
      setRewards(data || []);
    } catch (error) {
      console.error('Error loading rewards:', error);
      toast({
        title: "Error loading rewards",
        description: "Could not load loyalty rewards.",
        variant: "destructive"
      });
    }
  };

  const syncRewardsFromSquare = async () => {
    setLoadingRewards(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-square-rewards');

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Rewards synced",
          description: `Successfully synced ${data.count} rewards from Square.`
        });
        loadRewards(); // Reload the rewards table
      } else {
        throw new Error(data?.error || 'Sync failed');
      }
    } catch (error) {
      console.error('Error syncing rewards:', error);
      toast({
        title: "Sync failed",
        description: "Could not sync rewards from Square. Check your API connection.",
        variant: "destructive"
      });
    } finally {
      setLoadingRewards(false);
    }
  };

  const handleTestConnection = async () => {
    await testSquareConnection();
  };

  const handleSettingChange = (key: string, value: any) => {
    updateSetting(key as any, value);
  };

  const formatDiscount = (reward: any) => {
    if (reward.discount_type === 'FIXED_AMOUNT') {
      return `$${(reward.discount_amount / 100).toFixed(2)} off`;
    } else if (reward.discount_type === 'PERCENTAGE') {
      return `${reward.discount_amount}% off`;
    }
    return 'N/A';
  };

  const formatMaxDiscount = (reward: any) => {
    if (reward.discount_type === 'PERCENTAGE' && reward.max_discount_amount) {
      return `up to $${(reward.max_discount_amount / 100).toFixed(2)}`;
    }
    return '-';
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Square Loyalty Admin</h1>
          <p className="text-muted-foreground">Manage your Square loyalty program integration</p>
        </div>

        <Tabs defaultValue="settings" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="rewards" className="flex items-center gap-2">
              <Gift className="w-4 h-4" />
              Rewards
            </TabsTrigger>
            <TabsTrigger value="mappings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Product Mapping
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Preview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Loyalty Extension Settings</CardTitle>
                <CardDescription>
                  Configure your loyalty program behavior and Square API connection
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6">
                  <div className="border-b pb-6">
                    <h3 className="text-lg font-medium mb-4">Square API Configuration</h3>
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="environment">Environment</Label>
                        <select 
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={settings.square_environment}
                          onChange={(e) => handleSettingChange('square_environment', e.target.value)}
                        >
                          <option value="sandbox">Sandbox</option>
                          <option value="production">Production</option>
                        </select>
                        <p className="text-sm text-muted-foreground">
                          Square credentials are managed via Supabase secrets
                        </p>
                      </div>
                      <Button variant="outline" onClick={handleTestConnection}>
                        Test Square Connection
                      </Button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium mb-4">Widget Settings</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-base">Enable Loyalty Extension</Label>
                          <div className="text-sm text-muted-foreground">
                            Show loyalty program in cart
                          </div>
                        </div>
                        <Switch 
                          checked={settings.loyalty_widget_enabled}
                          onCheckedChange={(checked) => handleSettingChange('loyalty_widget_enabled', checked)}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-base">Show Points Balance</Label>
                          <div className="text-sm text-muted-foreground">
                            Display customer's current points balance
                          </div>
                        </div>
                        <Switch 
                          checked={settings.show_points_balance}
                          onCheckedChange={(checked) => handleSettingChange('show_points_balance', checked)}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-base">Allow Phone Number Lookup</Label>
                          <div className="text-sm text-muted-foreground">
                            Let customers find their account by phone number
                          </div>
                        </div>
                        <Switch 
                          checked={settings.allow_phone_lookup}
                          onCheckedChange={(checked) => handleSettingChange('allow_phone_lookup', checked)}
                        />
                      </div>
                      
                      <div className="grid gap-2">
                        <Label htmlFor="widget-title">Extension Title</Label>
                        <Input 
                          id="widget-title" 
                          value={settings.widget_title}
                          onChange={(e) => handleSettingChange('widget_title', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rewards" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Loyalty Rewards</CardTitle>
                <CardDescription>
                  Sync and manage rewards from your Square loyalty program
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center mb-6">
                  <Button 
                    onClick={syncRewardsFromSquare} 
                    disabled={loadingRewards}
                  >
                    {loadingRewards ? 'Syncing...' : 'Sync from Square'}
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    {rewards.length} rewards loaded
                  </p>
                </div>
                
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reward Name</TableHead>
                      <TableHead>Points Required</TableHead>
                      <TableHead>Discount</TableHead>
                      <TableHead>Max Discount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rewards.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No rewards found. Click "Sync from Square" to load rewards.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rewards.map((reward: any) => (
                        <TableRow key={reward.id}>
                          <TableCell className="font-medium">{reward.name}</TableCell>
                          <TableCell>{reward.points_required}</TableCell>
                          <TableCell>{formatDiscount(reward)}</TableCell>
                          <TableCell>{formatMaxDiscount(reward)}</TableCell>
                          <TableCell>
                            <Badge variant={reward.is_active ? "default" : "secondary"}>
                              {reward.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mappings" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Product Mappings</CardTitle>
                <CardDescription>
                  Map Square catalog items to Shopify products for precise free product rewards
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2">Setup Instructions:</h4>
                    <ol className="text-sm text-muted-foreground space-y-1">
                      <li>1. Tag your Shopify products with the corresponding loyalty tags:</li>
                      <li className="ml-4">• Tag matches with: <code>loyalty-matches</code></li>
                      <li className="ml-4">• Tag wick trimmers with: <code>loyalty-wick-trimmer</code></li>
                      <li className="ml-4">• Tag 7oz candles with: <code>loyalty-7oz-candle</code></li>
                      <li className="ml-4">• Tag wax melts with: <code>loyalty-wax-melt</code></li>
                      <li>2. Free product discounts will apply only to products with these tags</li>
                      <li>3. Discounts are limited to $25 maximum to prevent abuse</li>
                    </ol>
                  </div>
                  
                  <div className="p-4 border border-orange-200 bg-orange-50 rounded-lg">
                    <div className="flex items-center gap-2 text-orange-800">
                      <div className="w-4 h-4 rounded-full bg-orange-500"></div>
                      <span className="font-medium">Important</span>
                    </div>
                    <p className="text-sm text-orange-700 mt-2">
                      You must manually configure Shopify discount codes to target specific products using tags or collections. 
                      The system creates the discount codes, but Shopify admin configuration is required for product-specific targeting.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preview" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Cart Loyalty Widget Preview</CardTitle>
                  <CardDescription>
                    See how your loyalty widget appears in the cart drawer
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <MockCheckoutPreview />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Implementation Notes</CardTitle>
                  <CardDescription>
                    How the loyalty widget integrates with your store
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Customer Flow</p>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>1. Customer enters phone number in cart</p>
                      <p>2. System finds loyalty account via Square API</p>
                      <p>3. Shows current points balance</p>
                      <p>4. Displays available rewards</p>
                      <p>5. Customer redeems points for discount</p>
                      <p>6. Discount applies to cart total</p>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-2">Integration Details:</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Widget appears in cart drawer/page</li>
                      <li>• Works with all Shopify plans</li>
                      <li>• Real-time Square API integration</li>
                      <li>• Automatic discount code generation</li>
                      <li>• Mobile responsive design</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;