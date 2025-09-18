-- Add Shopify-specific columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN shopify_customer_id text,
ADD COLUMN phone text;

-- Create index for faster Shopify customer lookups
CREATE INDEX idx_profiles_shopify_customer_id ON public.profiles(shopify_customer_id);
CREATE INDEX idx_profiles_phone ON public.profiles(phone);