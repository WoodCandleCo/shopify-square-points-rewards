-- Create a mapping table for Square catalog items to Shopify products
CREATE TABLE public.product_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  square_catalog_object_id TEXT NOT NULL,
  shopify_product_id TEXT,
  shopify_product_handle TEXT,
  shopify_collection_id TEXT,
  product_name TEXT NOT NULL,
  mapping_type TEXT NOT NULL CHECK (mapping_type IN ('PRODUCT', 'COLLECTION', 'TAG')),
  shopify_tag TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(square_catalog_object_id)
);

-- Enable RLS
ALTER TABLE public.product_mappings ENABLE ROW LEVEL SECURITY;

-- Allow admin operations (you may want to restrict this further)
CREATE POLICY "Allow admin operations on product_mappings" 
ON public.product_mappings 
FOR ALL 
USING (true);

-- Create trigger for timestamps
CREATE TRIGGER update_product_mappings_updated_at
BEFORE UPDATE ON public.product_mappings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add some example mappings based on your Square rewards
INSERT INTO public.product_mappings (square_catalog_object_id, product_name, mapping_type, shopify_tag) VALUES
('YW63RNMZNVWZV2IX5PFSCXMV', 'Matches', 'TAG', 'loyalty-matches'),
('ELVQBZTZ27USYOPFULG2GFYD', 'Wick Trimmer', 'TAG', 'loyalty-wick-trimmer'),
('BQ4SGZYS4ELZEAELYIC43OGF', '7oz Candle', 'TAG', 'loyalty-7oz-candle'),
('42P75PHDUBADXPD2U256A5H7', 'Wax Melt', 'TAG', 'loyalty-wax-melt');