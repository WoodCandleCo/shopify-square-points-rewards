import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Settings, Eye } from "lucide-react";
import MockCheckoutPreview from "@/components/MockCheckoutPreview";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useToast } from "@/hooks/use-toast";

const AdminDashboard = () => {
  const { settings, loading, updateSetting, testSquareConnection } = useAppSettings();
  const { toast } = useToast();

  const handleTestConnection = async () => {
    await testSquareConnection();
  };

  const handleSettingChange = (key: string, value: any) => {
    updateSetting(key as any, value);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Square Loyalty Admin</h1>
          <p className="text-muted-foreground">Manage your Square loyalty program integration</p>
        </div>

        <Tabs defaultValue="settings" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Settings
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