import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Settings, Eye, Gift, Tag, ChevronDown, ChevronRight, LogOut, ExternalLink } from "lucide-react";
import MockCheckoutPreview from "@/components/MockCheckoutPreview";
import LoyaltyWidgetPreview from "@/components/LoyaltyWidgetPreview";
import LoyaltySetup from "@/components/LoyaltySetup";
import CombinedProductManager from "@/components/CombinedProductManager";
import LoyaltyPromotionsManager from "@/components/LoyaltyPromotionsManager";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const AdminDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { settings, loading, updateSetting, testSquareConnection } = useAppSettings();
  const { toast } = useToast();
  const [rewards, setRewards] = useState([]);
  const [loadingRewards, setLoadingRewards] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    checkAdminAccess();
  }, [user]);

  useEffect(() => {
    if (isAdmin) {
      loadRewards();
    }
  }, [isAdmin]);

  const checkAdminAccess = async () => {
    if (!user) {
      setCheckingAuth(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error checking admin access:', error);
        setIsAdmin(false);
      } else {
        setIsAdmin(data?.role === 'admin');
      }
    } catch (error) {
      console.error('Error checking admin access:', error);
      setIsAdmin(false);
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (!error) {
      navigate('/auth');
    }
  };

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
      const { data, error } = await supabase.functions.invoke('sync-square-rewards', {
        body: {}
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Rewards synced",
          description: `Successfully synced ${data.count || 0} rewards from Square in ${data.environment} environment.`
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

  const toggleRewardStatus = async (rewardId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('loyalty_rewards')
        .update({ is_active: !currentStatus })
        .eq('id', rewardId);

      if (error) throw error;

      toast({
        title: "Reward updated",
        description: `Reward ${!currentStatus ? 'activated' : 'deactivated'} successfully.`
      });
      
      loadRewards(); // Reload the rewards table
    } catch (error) {
      console.error('Error updating reward:', error);
      toast({
        title: "Update failed",
        description: "Could not update reward status.",
        variant: "destructive"
      });
    }
  };

  const handleTestConnection = async () => {
    const success = await testSquareConnection();
    if (success) {
      // Also test Shopify connection
      try {
        const { data, error } = await supabase.functions.invoke('test-shopify-config');
        if (data?.success) {
          toast({
            title: "Shopify connection verified",
            description: `Store: ${data.store_url}, Token: ${data.has_access_token ? 'Valid' : 'Missing'}`
          });
        }
      } catch (shopifyError) {
        console.error('Shopify test failed:', shopifyError);
      }
    }
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

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Checking authorization...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>You must be logged in to access the admin dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => navigate('/auth')} 
              className="w-full"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You don't have admin privileges to access this dashboard</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Contact your system administrator to request admin access.
            </p>
            <Button 
              onClick={handleSignOut} 
              variant="outline" 
              className="w-full"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Square Loyalty Admin</h1>
            <p className="text-muted-foreground">Manage your Square loyalty program integration</p>
          </div>
          <Button onClick={handleSignOut} variant="outline">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>

        <Tabs defaultValue="settings" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="rewards" className="flex items-center gap-2">
              <Gift className="w-4 h-4" />
              Rewards
            </TabsTrigger>
            <TabsTrigger value="promotions" className="flex items-center gap-2">
              <Gift className="w-4 h-4" />
              Promotions
            </TabsTrigger>
            <TabsTrigger value="mappings" className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Product Tags
            </TabsTrigger>
            <TabsTrigger value="setup" className="flex items-center gap-2">
              <ExternalLink className="w-4 h-4" />
              Setup
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
                      <TableHead>Shopify Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rewards.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
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
                            {reward.applicable_product_names && reward.applicable_product_names.length > 0 ? (
                              <ProductList products={reward.applicable_product_names} discountAmount={reward.discount_amount} discountType={reward.discount_type} />
                            ) : reward.shopify_product_id ? (
                              <span className="text-xs text-muted-foreground">ID: {reward.shopify_product_id}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs">{reward.shopify_sku || '-'}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={reward.is_active ? "default" : "secondary"}>
                              {reward.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant={reward.is_active ? "destructive" : "default"}
                              size="sm"
                              onClick={() => toggleRewardStatus(reward.id, reward.is_active)}
                            >
                              {reward.is_active ? "Deactivate" : "Activate"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="promotions" className="mt-6">
            <LoyaltyPromotionsManager />
          </TabsContent>

          <TabsContent value="mappings" className="mt-6">
            <CombinedProductManager />
          </TabsContent>

          <TabsContent value="setup" className="mt-6">
            <LoyaltySetup />
          </TabsContent>

          <TabsContent value="preview" className="mt-6">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Live Loyalty Widget Preview</CardTitle>
                  <CardDescription>
                    See exactly how your loyalty widget appears in a real cart interface with current styling
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <LoyaltyWidgetPreview />
                </CardContent>
              </Card>
              
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Legacy Preview</CardTitle>
                    <CardDescription>
                      Basic cart drawer preview (kept for reference)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <MockCheckoutPreview />
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Extension Info</CardTitle>
                    <CardDescription>
                      Technical details about your loyalty extension
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm font-medium mb-2">Integration Details:</p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Widget appears in cart drawer/page</li>
                        <li>• Works with all Shopify plans</li>
                        <li>• Real-time Square API integration</li>
                        <li>• Automatic discount code generation</li>
                        <li>• Mobile responsive design</li>
                        <li>• Enhanced contrast for better visibility</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

// Component to display collapsible product list
const ProductList = ({ products, discountAmount, discountType }: { 
  products: any[], 
  discountAmount: number, 
  discountType: string 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  if (!products || products.length === 0) return <span className="text-xs text-muted-foreground">-</span>;
  
  // Check if products are objects with detailed info or just strings
  const hasDetailedInfo = products.length > 0 && typeof products[0] === 'object';
  
  const formatDiscount = (price: string | null) => {
    if (!price) return '-';
    const priceNum = parseFloat(price);
    if (discountType === 'PERCENTAGE') {
      return `$${((priceNum * discountAmount) / 100).toFixed(2)}`;
    } else {
      return `$${(discountAmount / 100).toFixed(2)}`;
    }
  };
  
  if (!hasDetailedInfo) {
    // Legacy display for simple product names
    return (
      <div className="text-xs">
        {products.slice(0, 2).join(', ')}
        {products.length > 2 && ` +${products.length - 2} more`}
      </div>
    );
  }
  
  if (products.length === 1) {
    const product = products[0];
    return (
      <div className="text-xs">
        <div className="font-medium">{product.title}</div>
        <div className="text-muted-foreground">SKU: {product.sku || 'N/A'}</div>
        <div className="text-muted-foreground">Price: ${product.price || 'N/A'}</div>
        <div className="text-muted-foreground">Discount: {formatDiscount(product.price)}</div>
      </div>
    );
  }
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="h-auto p-0 text-xs">
          {isOpen ? <ChevronDown className="h-3 w-3 mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
          {products.length} products
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <div className="space-y-2">
          {products.map((product, index) => (
            <div key={index} className="text-xs border-l-2 border-muted pl-2">
              <div className="font-medium">{product.title}</div>
              <div className="text-muted-foreground">SKU: {product.sku || 'N/A'}</div>
              <div className="text-muted-foreground">Price: ${product.price || 'N/A'}</div>
              <div className="text-muted-foreground">Discount: {formatDiscount(product.price)}</div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
export default AdminDashboard;