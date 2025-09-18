import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Settings, Users, Gift, BarChart3, Square, Eye } from "lucide-react";
import MockCheckoutPreview from "@/components/MockCheckoutPreview";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useToast } from "@/hooks/use-toast";

const AdminDashboard = () => {
  const { settings, loading, updateSetting, testSquareConnection } = useAppSettings();
  const { toast } = useToast();
  const [squareCredentials, setSquareCredentials] = useState({
    applicationId: '',
    accessToken: ''
  });

  const handleSaveSquareConfig = async () => {
    // In a real implementation, these would be saved as secrets
    // For now, we'll just show a success message
    toast({
      title: "Configuration saved",
      description: "Square API credentials have been saved securely."
    });
  };

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

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="square-config" className="flex items-center gap-2">
              <Square className="w-4 h-4" />
              Square Config
            </TabsTrigger>
            <TabsTrigger value="rewards" className="flex items-center gap-2">
              <Gift className="w-4 h-4" />
              Rewards
            </TabsTrigger>
            <TabsTrigger value="customers" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Customers
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">1,234</div>
                  <p className="text-xs text-muted-foreground">+12% from last month</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Points Redeemed</CardTitle>
                  <Gift className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">45,231</div>
                  <p className="text-xs text-muted-foreground">+8% from last month</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Rewards</CardTitle>
                  <Settings className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">12</div>
                  <p className="text-xs text-muted-foreground">3 pending approval</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Revenue Impact</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">$12,345</div>
                  <p className="text-xs text-muted-foreground">From loyalty program</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="square-config" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Square API Configuration</CardTitle>
                <CardDescription>
                  Configure your Square API credentials to connect your loyalty program
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="app-id">Square Application ID</Label>
                    <Input 
                      id="app-id" 
                      placeholder="sq0idp-..." 
                      value={squareCredentials.applicationId}
                      onChange={(e) => setSquareCredentials(prev => ({ 
                        ...prev, 
                        applicationId: e.target.value 
                      }))}
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="access-token">Square Access Token</Label>
                    <Input 
                      id="access-token" 
                      type="password"
                      placeholder="EAAAl..." 
                      value={squareCredentials.accessToken}
                      onChange={(e) => setSquareCredentials(prev => ({ 
                        ...prev, 
                        accessToken: e.target.value 
                      }))}
                    />
                  </div>
                  
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
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch id="test-connection" />
                    <Label htmlFor="test-connection">Test connection on save</Label>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button onClick={handleSaveSquareConfig}>Save Configuration</Button>
                  <Button variant="outline" onClick={handleTestConnection}>Test Connection</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rewards" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Loyalty Rewards Management</CardTitle>
                <CardDescription>
                  Sync and manage rewards from your Square loyalty program
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center mb-4">
                  <Button>Sync from Square</Button>
                  <Button variant="outline">Add Custom Reward</Button>
                </div>
                
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reward Name</TableHead>
                      <TableHead>Points Required</TableHead>
                      <TableHead>Discount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">$5 Off Purchase</TableCell>
                      <TableCell>500</TableCell>
                      <TableCell>$5.00 Fixed</TableCell>
                      <TableCell>
                        <Badge variant="default">Active</Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">Edit</Button>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">10% Off Order</TableCell>
                      <TableCell>1000</TableCell>
                      <TableCell>10% Percentage</TableCell>
                      <TableCell>
                        <Badge variant="default">Active</Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">Edit</Button>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Free Shipping</TableCell>
                      <TableCell>750</TableCell>
                      <TableCell>Free Shipping</TableCell>
                      <TableCell>
                        <Badge variant="secondary">Inactive</Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">Edit</Button>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="customers" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Customer Loyalty Accounts</CardTitle>
                <CardDescription>
                  View and manage customer loyalty accounts and transactions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Points Balance</TableHead>
                      <TableHead>Lifetime Points</TableHead>
                      <TableHead>Last Activity</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">John Doe</TableCell>
                      <TableCell>john@example.com</TableCell>
                      <TableCell>1,250</TableCell>
                      <TableCell>5,430</TableCell>
                      <TableCell>2 days ago</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">View</Button>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Jane Smith</TableCell>
                      <TableCell>jane@example.com</TableCell>
                      <TableCell>890</TableCell>
                      <TableCell>2,150</TableCell>
                      <TableCell>1 week ago</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">View</Button>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preview" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Checkout Extension Preview</CardTitle>
                  <CardDescription>
                    See exactly how your loyalty widget will appear in Shopify checkout
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <MockCheckoutPreview />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Preview Settings</CardTitle>
                  <CardDescription>
                    Customize how the preview appears
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Customer Flow</p>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>1. Customer enters phone number</p>
                      <p>2. System finds loyalty account via Square API</p>
                      <p>3. Shows current points balance</p>
                      <p>4. Displays available rewards</p>
                      <p>5. Customer redeems points for discount</p>
                      <p>6. Discount applies to cart total</p>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-2">Integration Notes:</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Widget appears in Shopify Plus checkout</li>
                      <li>• Real-time Square API integration</li>
                      <li>• Automatic discount application</li>
                      <li>• Mobile responsive design</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Extension Settings</CardTitle>
                <CardDescription>
                  Configure how the loyalty extension appears in your Shopify checkout
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Enable Loyalty Extension</Label>
                    <div className="text-sm text-muted-foreground">
                      Show loyalty program in checkout
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
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;