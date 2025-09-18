import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, X, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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
}

const ProductTagManager = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
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
            loyaltyTags
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
      toast({
        title: "Error loading products",
        description: "Could not load products from Shopify.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
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
              tags: newAllTags
            };
          }
          return product;
        }));
        
        toast({
          title: "Tag updated",
          description: `Successfully ${action === 'add' ? 'added' : 'removed'} tag for ${products.find(p => p.id === productId)?.title}.`
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
            <CardTitle>Manual Tag Management</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Manually manage loyalty tags for individual products
            </p>
          </div>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Name</TableHead>
                <TableHead>Current Loyalty Tags</TableHead>
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
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                            <button
                              onClick={() => removeTag(product.id, tag)}
                              disabled={updating === product.id}
                              className="ml-1 hover:text-destructive"
                            >
                              <X className="w-3 h-3" />
                            </button>
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
        )}
      </CardContent>
    </Card>
  );
};

export default ProductTagManager;