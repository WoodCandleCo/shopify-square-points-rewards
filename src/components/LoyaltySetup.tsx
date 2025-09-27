import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, ExternalLink, CircleCheck as CheckCircle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const LoyaltySetup = () => {
  const [domain, setDomain] = useState(window.location.hostname);
  const { toast } = useToast();

  const version = `v=${Date.now()}`;
  const scriptCode = `<!-- Loyalty Widget Script (cache-busted) -->\n<script src="https://${domain}/loyalty-widget-production.js?${version}" defer></script>`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Code copied to clipboard",
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Loyalty Widget Setup</h1>
        <p className="text-muted-foreground">Simple script injection - no Shopify app required!</p>
      </div>

      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          This setup method bypasses Shopify app installation issues. Your loyalty widget will work on any Shopify store with just a simple script tag.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Step 1: Configure Domain</CardTitle>
          <CardDescription>
            Enter your deployment domain (usually your Lovable app domain)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="domain">Your App Domain</Label>
            <Input
              id="domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="your-app.bolt.new"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 2: Add Script to Shopify Theme</CardTitle>
          <CardDescription>
            Copy the script below and paste it into your theme.liquid file, just before the closing &lt;/head&gt; tag
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Script Code</Label>
            <div className="relative">
              <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto border">
                <code>{scriptCode}</code>
              </pre>
              <Button
                size="sm"
                variant="outline"
                className="absolute top-2 right-2"
                onClick={() => copyToClipboard(scriptCode)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Instructions:</Label>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Go to your Shopify admin → Online Store → Themes</li>
              <li>Click "Actions" → "Edit code" on your active theme</li>
              <li>Open the "theme.liquid" file in the Layout folder</li>
              <li>Scroll down to find the closing &lt;/head&gt; tag</li>
              <li>Paste the script code just before &lt;/head&gt;</li>
              <li>Click "Save"</li>
            </ol>
          </div>

          <Button 
            variant="outline" 
            onClick={() => window.open('https://help.shopify.com/en/manual/online-store/themes/theme-structure/extend/edit-theme-code', '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Shopify Theme Editing Guide
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 3: Widget Behavior</CardTitle>
          <CardDescription>
            How the loyalty widget works on your store
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-foreground">For Logged-in Customers</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Automatically checks for existing loyalty account</li>
                  <li>• Shows points balance if account exists</li>
                  <li>• Displays available rewards</li>
                  <li>• Allows phone connection if no account found</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-foreground">For Guest Customers</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Shows phone number input form</li>
                  <li>• Connects to Square loyalty account</li>
                  <li>• Creates Shopify customer profile link</li>
                  <li>• Displays rewards and points balance</li>
                </ul>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h4 className="font-semibold text-foreground mb-2">Widget Placement</h4>
              <p className="text-sm text-muted-foreground">
                The widget automatically detects your cart page and injects itself at the top of the cart items. 
                It works with most Shopify themes and cart drawer implementations.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 4: Test the Widget</CardTitle>
          <CardDescription>
            Verify everything is working correctly
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Test Checklist:</Label>
              <ul className="space-y-1 text-sm">
                <li className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" />
                  <span>Script added to theme.liquid</span>
                </li>
                <li className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" />
                  <span>Widget appears on cart page</span>
                </li>
                <li className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" />
                  <span>Phone number connection works</span>
                </li>
                <li className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" />
                  <span>Points balance displays correctly</span>
                </li>
                <li className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" />
                  <span>Reward redemption creates discount codes</span>
                </li>
              </ul>
            </div>

            <Alert>
              <AlertDescription>
                <strong>Troubleshooting:</strong> If the widget doesn't appear, check your browser's developer console for errors. 
                The widget will retry loading multiple times to account for dynamic cart implementations.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      <div className="text-center">
        <Button 
          size="lg" 
          onClick={() => window.open(`https://${domain}`, '_blank')}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Open Your Loyalty Dashboard
        </Button>
      </div>
    </div>
  );
};

export default LoyaltySetup;