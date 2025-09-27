/*
  # Fix existing schema conflicts

  This migration safely handles existing tables and columns by using proper conditional checks.
  It will only add missing columns and tables without conflicting with existing ones.

  1. Tables handled:
    - profiles (add missing columns if they don't exist)
    - loyalty_accounts (ensure proper structure)
    - loyalty_rewards (add new columns safely)
    - loyalty_transactions (verify structure)
    - loyalty_redemptions (add if missing)
    - app_settings (add if missing)
    - product_mappings (add if missing)

  2. Functions and triggers:
    - Add missing functions
    - Add missing triggers
    - Add missing RLS policies
*/

-- Create extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Helper function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to promote user to admin
CREATE OR REPLACE FUNCTION promote_user_to_admin(user_email text)
RETURNS boolean AS $$
BEGIN
  UPDATE profiles 
  SET role = 'admin' 
  WHERE email = user_email;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add missing columns to profiles table if they don't exist
DO $$
BEGIN
  -- Add shopify_customer_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'shopify_customer_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN shopify_customer_id text;
  END IF;

  -- Add phone if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'phone'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone text;
  END IF;

  -- Add role if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE profiles ADD COLUMN role text DEFAULT 'user';
  END IF;

  -- Add square_customer_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'square_customer_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN square_customer_id text;
  END IF;
END $$;

-- Create loyalty_accounts table if it doesn't exist
CREATE TABLE IF NOT EXISTS loyalty_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  square_loyalty_account_id text UNIQUE NOT NULL,
  balance integer DEFAULT 0 NOT NULL,
  points_earned_lifetime integer DEFAULT 0 NOT NULL,
  program_id text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create loyalty_rewards table if it doesn't exist
CREATE TABLE IF NOT EXISTS loyalty_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  square_reward_id text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  points_required integer NOT NULL,
  discount_amount integer,
  discount_type text,
  max_discount_amount integer,
  shopify_product_id text,
  shopify_product_handle text,
  shopify_sku text,
  applicable_product_names text[],
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Add missing columns to loyalty_rewards if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'loyalty_rewards' AND column_name = 'max_discount_amount'
  ) THEN
    ALTER TABLE loyalty_rewards ADD COLUMN max_discount_amount integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'loyalty_rewards' AND column_name = 'shopify_product_id'
  ) THEN
    ALTER TABLE loyalty_rewards ADD COLUMN shopify_product_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'loyalty_rewards' AND column_name = 'shopify_product_handle'
  ) THEN
    ALTER TABLE loyalty_rewards ADD COLUMN shopify_product_handle text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'loyalty_rewards' AND column_name = 'shopify_sku'
  ) THEN
    ALTER TABLE loyalty_rewards ADD COLUMN shopify_sku text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'loyalty_rewards' AND column_name = 'applicable_product_names'
  ) THEN
    ALTER TABLE loyalty_rewards ADD COLUMN applicable_product_names text[];
  END IF;
END $$;

-- Create loyalty_transactions table if it doesn't exist
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  loyalty_account_id uuid NOT NULL,
  square_transaction_id text,
  transaction_type text NOT NULL CHECK (transaction_type IN ('EARN', 'REDEEM')),
  points integer NOT NULL,
  description text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create loyalty_redemptions table if it doesn't exist
CREATE TABLE IF NOT EXISTS loyalty_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loyalty_account_id uuid,
  reward_id uuid,
  points_redeemed integer DEFAULT 0 NOT NULL,
  discount_code text,
  square_redemption_id text,
  shopify_order_id text,
  status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create app_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create product_mappings table if it doesn't exist
CREATE TABLE IF NOT EXISTS product_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  square_catalog_object_id text UNIQUE NOT NULL,
  shopify_product_id text,
  shopify_product_handle text,
  shopify_collection_id text,
  product_name text NOT NULL,
  mapping_type text NOT NULL CHECK (mapping_type IN ('PRODUCT', 'COLLECTION', 'TAG')),
  shopify_tag text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_shopify_customer_id ON profiles(shopify_customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_shopify_product_id ON loyalty_rewards(shopify_product_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_shopify_sku ON loyalty_rewards(shopify_sku);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_account_id ON loyalty_redemptions(loyalty_account_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_shopify_order ON loyalty_redemptions(shopify_order_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_square_id ON loyalty_redemptions(square_redemption_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_status ON loyalty_redemptions(status);

-- Add foreign key constraints if they don't exist
DO $$
BEGIN
  -- loyalty_accounts foreign key
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'loyalty_accounts_user_id_fkey'
  ) THEN
    ALTER TABLE loyalty_accounts 
    ADD CONSTRAINT loyalty_accounts_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE;
  END IF;

  -- loyalty_transactions foreign keys
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'loyalty_transactions_user_id_fkey'
  ) THEN
    ALTER TABLE loyalty_transactions 
    ADD CONSTRAINT loyalty_transactions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'loyalty_transactions_loyalty_account_id_fkey'
  ) THEN
    ALTER TABLE loyalty_transactions 
    ADD CONSTRAINT loyalty_transactions_loyalty_account_id_fkey 
    FOREIGN KEY (loyalty_account_id) REFERENCES loyalty_accounts(id) ON DELETE CASCADE;
  END IF;

  -- loyalty_redemptions foreign keys
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'loyalty_redemptions_loyalty_account_id_fkey'
  ) THEN
    ALTER TABLE loyalty_redemptions 
    ADD CONSTRAINT loyalty_redemptions_loyalty_account_id_fkey 
    FOREIGN KEY (loyalty_account_id) REFERENCES loyalty_accounts(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'loyalty_redemptions_reward_id_fkey'
  ) THEN
    ALTER TABLE loyalty_redemptions 
    ADD CONSTRAINT loyalty_redemptions_reward_id_fkey 
    FOREIGN KEY (reward_id) REFERENCES loyalty_rewards(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_mappings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (drop existing ones first to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON profiles;
DROP POLICY IF EXISTS "Allow profile creation during signup" ON profiles;

CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow profile creation during signup" ON profiles
  FOR INSERT WITH CHECK (true);

-- Loyalty accounts policies
DROP POLICY IF EXISTS "Users can view their own loyalty accounts" ON loyalty_accounts;
DROP POLICY IF EXISTS "Users can update their own loyalty accounts" ON loyalty_accounts;
DROP POLICY IF EXISTS "Users can create their own loyalty accounts" ON loyalty_accounts;

CREATE POLICY "Users can view their own loyalty accounts" ON loyalty_accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own loyalty accounts" ON loyalty_accounts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own loyalty accounts" ON loyalty_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Loyalty rewards policies
DROP POLICY IF EXISTS "Anyone can view active rewards" ON loyalty_rewards;
DROP POLICY IF EXISTS "Admins can create loyalty_rewards" ON loyalty_rewards;
DROP POLICY IF EXISTS "Admins can update loyalty_rewards" ON loyalty_rewards;
DROP POLICY IF EXISTS "Admins can delete loyalty_rewards" ON loyalty_rewards;

CREATE POLICY "Anyone can view active rewards" ON loyalty_rewards
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can create loyalty_rewards" ON loyalty_rewards
  FOR INSERT WITH CHECK (is_current_user_admin());

CREATE POLICY "Admins can update loyalty_rewards" ON loyalty_rewards
  FOR UPDATE USING (is_current_user_admin()) WITH CHECK (is_current_user_admin());

CREATE POLICY "Admins can delete loyalty_rewards" ON loyalty_rewards
  FOR DELETE USING (is_current_user_admin());

-- Loyalty transactions policies
DROP POLICY IF EXISTS "Users can view their own transactions" ON loyalty_transactions;
DROP POLICY IF EXISTS "Users can create their own transactions" ON loyalty_transactions;

CREATE POLICY "Users can view their own transactions" ON loyalty_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own transactions" ON loyalty_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Loyalty redemptions policies
DROP POLICY IF EXISTS "Users can view their own redemptions" ON loyalty_redemptions;
DROP POLICY IF EXISTS "Users can create their own redemptions" ON loyalty_redemptions;
DROP POLICY IF EXISTS "Admins can manage all redemptions" ON loyalty_redemptions;

CREATE POLICY "Users can view their own redemptions" ON loyalty_redemptions
  FOR SELECT USING (loyalty_account_id IN (
    SELECT id FROM loyalty_accounts WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can create their own redemptions" ON loyalty_redemptions
  FOR INSERT WITH CHECK (loyalty_account_id IN (
    SELECT id FROM loyalty_accounts WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage all redemptions" ON loyalty_redemptions
  FOR ALL USING (is_current_user_admin()) WITH CHECK (is_current_user_admin());

-- App settings policies
DROP POLICY IF EXISTS "Admins can view app_settings" ON app_settings;
DROP POLICY IF EXISTS "Admins can create app_settings" ON app_settings;
DROP POLICY IF EXISTS "Admins can update app_settings" ON app_settings;
DROP POLICY IF EXISTS "Admins can delete app_settings" ON app_settings;
DROP POLICY IF EXISTS "Allow admin operations on app_settings" ON app_settings;

CREATE POLICY "Admins can view app_settings" ON app_settings
  FOR SELECT USING (is_current_user_admin());

CREATE POLICY "Admins can create app_settings" ON app_settings
  FOR INSERT WITH CHECK (is_current_user_admin());

CREATE POLICY "Admins can update app_settings" ON app_settings
  FOR UPDATE USING (is_current_user_admin()) WITH CHECK (is_current_user_admin());

CREATE POLICY "Admins can delete app_settings" ON app_settings
  FOR DELETE USING (is_current_user_admin());

-- Product mappings policies
DROP POLICY IF EXISTS "Admins can view product_mappings" ON product_mappings;
DROP POLICY IF EXISTS "Admins can create product_mappings" ON product_mappings;
DROP POLICY IF EXISTS "Admins can update product_mappings" ON product_mappings;
DROP POLICY IF EXISTS "Admins can delete product_mappings" ON product_mappings;

CREATE POLICY "Admins can view product_mappings" ON product_mappings
  FOR SELECT USING (is_current_user_admin());

CREATE POLICY "Admins can create product_mappings" ON product_mappings
  FOR INSERT WITH CHECK (is_current_user_admin());

CREATE POLICY "Admins can update product_mappings" ON product_mappings
  FOR UPDATE USING (is_current_user_admin()) WITH CHECK (is_current_user_admin());

CREATE POLICY "Admins can delete product_mappings" ON product_mappings
  FOR DELETE USING (is_current_user_admin());

-- Create triggers for updated_at columns
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_loyalty_accounts_updated_at ON loyalty_accounts;
DROP TRIGGER IF EXISTS update_loyalty_rewards_updated_at ON loyalty_rewards;
DROP TRIGGER IF EXISTS update_loyalty_redemptions_updated_at ON loyalty_redemptions;
DROP TRIGGER IF EXISTS update_app_settings_updated_at ON app_settings;
DROP TRIGGER IF EXISTS update_product_mappings_updated_at ON product_mappings;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loyalty_accounts_updated_at
  BEFORE UPDATE ON loyalty_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loyalty_rewards_updated_at
  BEFORE UPDATE ON loyalty_rewards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loyalty_redemptions_updated_at
  BEFORE UPDATE ON loyalty_redemptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_mappings_updated_at
  BEFORE UPDATE ON product_mappings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();