-- Add Shopify product reference fields to loyalty_rewards table
ALTER TABLE loyalty_rewards ADD COLUMN shopify_product_id text;
ALTER TABLE loyalty_rewards ADD COLUMN shopify_product_handle text;
ALTER TABLE loyalty_rewards ADD COLUMN shopify_sku text;
ALTER TABLE loyalty_rewards ADD COLUMN applicable_product_names text[];

-- Add index for better query performance
CREATE INDEX idx_loyalty_rewards_shopify_product_id ON loyalty_rewards(shopify_product_id);
CREATE INDEX idx_loyalty_rewards_shopify_sku ON loyalty_rewards(shopify_sku);