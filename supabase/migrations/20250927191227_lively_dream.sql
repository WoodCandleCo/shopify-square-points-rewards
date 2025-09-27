/*
  # Add loyalty redemptions tracking table

  1. New Tables
    - `loyalty_redemptions`
      - `id` (uuid, primary key)
      - `loyalty_account_id` (uuid, foreign key)
      - `reward_id` (uuid, foreign key)
      - `points_redeemed` (integer)
      - `discount_code` (text)
      - `square_redemption_id` (text)
      - `shopify_order_id` (text)
      - `status` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `loyalty_redemptions` table
    - Add policies for users to view their own redemptions
    - Add admin policies for full access

  3. Indexes
    - Index on loyalty_account_id for fast lookups
    - Index on square_redemption_id for webhook processing
    - Index on shopify_order_id for order tracking
*/

CREATE TABLE IF NOT EXISTS loyalty_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loyalty_account_id uuid REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
  reward_id uuid REFERENCES loyalty_rewards(id) ON DELETE SET NULL,
  points_redeemed integer NOT NULL DEFAULT 0,
  discount_code text,
  square_redemption_id text,
  shopify_order_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE loyalty_redemptions ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_account_id ON loyalty_redemptions(loyalty_account_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_square_id ON loyalty_redemptions(square_redemption_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_shopify_order ON loyalty_redemptions(shopify_order_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_status ON loyalty_redemptions(status);

-- RLS Policies
CREATE POLICY "Users can view their own redemptions"
  ON loyalty_redemptions
  FOR SELECT
  TO public
  USING (
    loyalty_account_id IN (
      SELECT id FROM loyalty_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their own redemptions"
  ON loyalty_redemptions
  FOR INSERT
  TO public
  WITH CHECK (
    loyalty_account_id IN (
      SELECT id FROM loyalty_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all redemptions"
  ON loyalty_redemptions
  FOR ALL
  TO public
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());

-- Add updated_at trigger
CREATE TRIGGER update_loyalty_redemptions_updated_at
  BEFORE UPDATE ON loyalty_redemptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();