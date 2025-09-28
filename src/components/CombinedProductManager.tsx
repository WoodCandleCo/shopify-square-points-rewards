import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader as Loader2, X, RefreshCw, Zap, User, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

const LOYALTY_TAGS = [
  'loyalty-matches',
  'loyalty-wick-trimmer', 
  'loyalty-7oz-candle',
  'loyalty-wax-melt'
];

interface Product {
  id: string;
  title: string;
  handle: string;
  tags: string[];
  loyaltyTags: string[];
  autoTagged?: boolean;
}

interface AutoTagResult {
  product_name: string;
  product_id: string;
  tag_added: string;
  success: boolean;
  already_tagged?: boolean;
}

const CombinedProductManager = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [loadingAutoTag, setLoadingAutoTag] = useState(false);
  const [taggedProducts, setTaggedProducts] = useState<AutoTagResult[]>([]);
  const { toast } = useToast();

  const loadProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-shopify-products');
      
      if (error) throw error;
      
      if (data?.success) {
        // Transform products to include loyalty tags separately
        const transformedProducts = data.products.map((product: any) => {
          const allTags = product.tags ? product.tags.split(', ') : [];
          const loyaltyTags = allTags.filter((tag: string) => tag.startsWith('loyalty-'));
          
          return {
            id: product.id,
            title: product.title,
            handle: product.handle,
            tags: allTags,
            loyaltyTags,
            autoTagged: false // Will be updated after auto-tagging
          };
        });
        
        setProducts(transformedProducts);
        toast({
          title: "Products loaded",
          description: `Loaded ${transformedProducts.length} products from Shopify.`
        });
      } else {
        throw new Error(data?.error || 'Failed to load products');
      }
    } catch (error) {
      console.error('Error loading products:', error);
      
      let errorMessage = "Could not load products from Shopify.";
      
      // Check if it's a Shopify API authentication error
      if (error.message && error.message.includes('Invalid API key or access token')) {
        errorMessage = "Shopify API credentials are invalid. Please check your SHOPIFY_ACCESS_TOKEN and SHOPIFY_SHOP_DOMAIN in Supabase secrets.";
      } else if (error.message && error.message.includes('Shopify credentials not configured')) {
        errorMessage = "Shopify credentials are not configured. Please set SHOPIFY_ACCESS_TOKEN and SHOPIFY_SHOP_DOMAIN in your Supabase project secrets.";
      }
      
      toast({
        title: "Error loading products",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const autoTagProducts = async () => {
    setLoadingAutoTag(true);
    try {
      const { data, error } = await supabase.functions.invoke('auto-tag-products');

      if (error) throw error;

      if (data?.success) {
        setTaggedProducts(data.results || []);
        
        // Update products to mark which ones were auto-tagged
        setProducts(prevProducts => 
          prevProducts.map(product => {
            const autoTagResult = data.results?.find((result: AutoTagResult) => 
              result.product_id === product.id
            );
            
            if (autoTagResult && autoTagResult.success) {
              const updatedTags = product.tags.includes(autoTagResult.tag_added) 
                ? product.tags 
                : [...product.tags, autoTagResult.tag_added];
              
              const updatedLoyaltyTags = updatedTags.filter(tag => tag.startsWith('loyalty-'));
              
              return {
                ...product,
                tags: updatedTags,
                loyaltyTags: updatedLoyaltyTags,
                autoTagged: true
              };
            }
            
            return product;
          })
        );
        
        toast({
          title: "Products auto-tagged",
          description: `Tagged ${data.tagged_count} products with loyalty tags.`
        });
      } else {
        throw new Error(data?.error || 'Auto-tagging failed');
      }
    } catch (error) {
      console.error('Error auto-tagging products:', error);
      toast({
        title: "Auto-tagging failed",
        description: "Could not automatically tag products.",
        variant: "destructive"
      });
    } finally {
      setLoadingAutoTag(false);
    }
  };

  const updateProductTag = async (productId: string, action: 'add' | 'remove', tag?: string) => {
    setUpdating(productId);
    try {
      const { data, error } = await supabase.functions.invoke('update-product-tags', {
        body: {
          productId,
          action,
          tag
        }
      });
      
      if (error) throw error;
      
      if (data?.success) {
        // Update local state
        setProducts(products.map(product => {
          if (product.id === productId) {
            let newLoyaltyTags = [...product.loyaltyTags];
            let newAllTags = [...product.tags];
            
            if (action === 'add' && tag) {
              if (!newLoyaltyTags.includes(tag)) {
                newLoyaltyTags.push(tag);
                newAllTags.push(tag);
              }
            } else if (action === 'remove') {
              if (tag) {
                newLoyaltyTags = newLoyaltyTags.filter(t => t !== tag);
                newAllTags = newAllTags.filter(t => t !== tag);
              } else {
                // Remove all loyalty tags
                newAllTags = newAllTags.filter(t => !t.startsWith('loyalty-'));
                newLoyaltyTags = [];
              }
            }
            
            return {
              ...product,
              loyaltyTags: newLoyaltyTags,
              tags: newAllTags,
              autoTagged: false // Mark as manually modified
            };
          }
          return product;
        }));
        
        toast({
          title: "Tag updated",
          description: `Successfully ${action === 'add' ? 'added' : 'removed'} tag.`
        });
      } else {
        throw new Error(data?.error || 'Failed to update tag');
      }
    } catch (error) {
      console.error('Error updating tag:', error);
      toast({
        title: "Error updating tag",
        description: "Could not update product tag.",
        variant: "destructive"
      });
    } finally {
      setUpdating(null);
    }
  };

  const testShopifyConfig = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('test-shopify-config');
      
      if (error) throw error;
      
      toast({
        title: "Shopify Configuration Test",
        description: `Store URL: ${data.store_url}, Token: ${data.has_access_token ? 'Present' : 'Missing'}`
      });
    } catch (error) {
      console.error('Test failed:', error);
      toast({
        title: "Configuration test failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const removeTag = (productId: string, tag: string) => {
    updateProductTag(productId, 'remove', tag);
  };

  const removeAllTags = (productId: string) => {
    updateProductTag(productId, 'remove');
  };

  const addTag = (productId: string, tag: string) => {
    updateProductTag(productId, 'add', tag);
  };

  useEffect(() => {
    loadProducts();
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Product Tag Management</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Automatically tag products and manually override as needed
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={testShopifyConfig} 
              variant="outline"
              size="sm"
            >
              <Settings className="w-4 h-4 mr-2" />
              Test Shopify
            </Button>
            <Button 
              onClick={loadProducts} 
              disabled={loading}
              variant="outline"
              size="sm"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Refresh
            </Button>
            <Button 
              onClick={autoTagProducts} 
              disabled={loadingAutoTag}
              size="sm"
            >
              {loadingAutoTag ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Zap className="w-4 h-4 mr-2" />
              )}
              Auto-Tag
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Loading products...
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No products found. Make sure your Shopify connection is configured.
          </div>
        ) : (
          <>
            <div className="mb-4 p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  Auto-tagged
                </div>
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  Manual override
                </div>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Current Tags</TableHead>
                  <TableHead>Add Tag</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">
                      {product.title}
                      <div className="text-xs text-muted-foreground">
                        ID: {product.id}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {product.loyaltyTags.length === 0 ? (
                          <span className="text-sm text-muted-foreground">No loyalty tags</span>
                        ) : (
                          product.loyaltyTags.map((tag) => (
                            <Badge 
                              key={tag} 
                              variant={product.autoTagged ? "default" : "secondary"}
                              className="text-xs cursor-pointer hover:opacity-80"
                              onClick={() => removeTag(product.id, tag)}
                            >
                              {product.autoTagged ? (
                                <Zap className="w-3 h-3 mr-1" />
                              ) : (
                                <User className="w-3 h-3 mr-1" />
                              )}
                              {tag}
                              <X className="w-3 h-3 ml-1" />
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select 
                        onValueChange={(tag) => addTag(product.id, tag)}
                        disabled={updating === product.id}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Add tag..." />
                        </SelectTrigger>
                        <SelectContent className="bg-background border shadow-md z-50">
                          {LOYALTY_TAGS.filter(tag => !product.loyaltyTags.includes(tag)).map((tag) => (
                            <SelectItem key={tag} value={tag}>
                              {tag}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button
                        onClick={() => removeAllTags(product.id)}
                        disabled={updating === product.id || product.loyaltyTags.length === 0}
                        variant="destructive"
                        size="sm"
                      >
                        {updating === product.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Remove All'
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {taggedProducts.length > 0 && (
              <div className="mt-6 p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Last Auto-Tag Results</h4>
                <div className="text-sm text-muted-foreground">
                  Tagged {taggedProducts.filter(r => r.success).length} products successfully
                </div>
              </div>
            )}

            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">How it works:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Click "Auto-Tag" to automatically tag products based on their names and collections</li>
                <li>• Auto-tagged items show a ⚡ icon and use blue badges</li>
                <li>• Click any tag badge to remove it, or use the dropdown to add new tags</li>
                <li>• Manual changes show a 👤 icon and use gray badges</li>
                <li>• Use "Remove All" to clear all loyalty tags from a product</li>
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default CombinedProductManager;