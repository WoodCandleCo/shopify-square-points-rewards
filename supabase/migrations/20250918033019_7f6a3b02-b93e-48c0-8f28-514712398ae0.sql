-- Add max_discount_amount column to loyalty_rewards table
ALTER TABLE public.loyalty_rewards 
ADD COLUMN max_discount_amount integer;

-- Add comment to clarify the column purpose
COMMENT ON COLUMN public.loyalty_rewards.max_discount_amount IS 'Maximum discount amount in cents for percentage-based discounts';