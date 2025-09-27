import React, { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";

interface ProductListProps {
  products: any[];
  discountAmount: number;
  discountType: string;
}

const ProductList: React.FC<ProductListProps> = ({ products, discountAmount, discountType }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  if (!products || products.length === 0) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }
  
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

export default ProductList;