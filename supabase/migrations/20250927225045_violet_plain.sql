/*
  # Complete Schema Setup for Square Loyalty Integration

  1. New Tables
    - `profiles` - User profiles with Square/Shopify customer links
    - `loyalty_accounts` - Square loyalty account data  
    - `loyalty_rewards` - Available rewards from Square
    - `loyalty_transactions` - Point earning/redemption history
    - `loyalty_redemptions` - Reward redemption tracking
    - `product_mappings` - Square-to-Shopify product mappings
    - `app_settings` - Application configuration

  2. Security
    - Enable RLS on all tables
    - Add comprehensive policies for user access control
    - Create admin management functions

  3. Functions
    - Admin check function
    - User promotion function
    - Automatic profile creation trigger
    - Updated timestamp triggers
*/

-- Create extension for UUID generation if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email text,
  first_name text,
  last_name text,
  phone text,
  role text DEFAULT 'user',
  square_customer_id text,
  shopify_customer_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for profiles
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_shopify_customer_id ON profiles(shopify_customer_id);

-- Create loyalty_accounts table
CREATE TABLE IF NOT EXISTS loyalty_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(user_id) ON DELETE CASCADE,
  square_loyalty_account_id text UNIQUE NOT NULL,
  balance integer DEFAULT 0,
  points_earned_lifetime integer DEFAULT 0,
  program_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create loyalty_rewards table
CREATE TABLE IF NOT EXISTS loyalty_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  square_reward_id text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  points_required integer NOT NULL,
  discount_amount integer,
  discount_type text CHECK (discount_type IN ('FIXED_AMOUNT', 'PERCENTAGE')),
  max_discount_amount integer,
  shopify_product_id text,
  shopify_product_handle text,
  shopify_sku text,
  applicable_product_names text[],
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for loyalty_rewards
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_shopify_product_id ON loyalty_rewards(shopify_product_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_shopify_sku ON loyalty_rewards(shopify_sku);

-- Create loyalty_transactions table
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(user_id) ON DELETE CASCADE,
  loyalty_account_id uuid REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
  square_transaction_id text,
  transaction_type text CHECK (transaction_type IN ('EARN', 'REDEEM')),
  points integer NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Create loyalty_redemptions table
CREATE TABLE IF NOT EXISTS loyalty_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loyalty_account_id uuid REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
  reward_id uuid REFERENCES loyalty_rewards(id) ON DELETE SET NULL,
  points_redeemed integer DEFAULT 0,
  discount_code text,
  square_redemption_id text,
  shopify_order_id text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for loyalty_redemptions
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_account_id ON loyalty_redemptions(loyalty_account_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_shopify_order ON loyalty_redemptions(shopify_order_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_square_id ON loyalty_redemptions(square_redemption_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_status ON loyalty_redemptions(status);

-- Create product_mappings table
CREATE TABLE IF NOT EXISTS product_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  square_catalog_object_id text UNIQUE NOT NULL,
  shopify_product_id text,
  shopify_product_handle text,
  shopify_collection_id text,
  product_name text NOT NULL,
  mapping_type text CHECK (mapping_type IN ('PRODUCT', 'COLLECTION', 'TAG')),
  shopify_tag text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create app_settings table
CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_loyalty_accounts_updated_at ON loyalty_accounts;
CREATE TRIGGER update_loyalty_accounts_updated_at
  BEFORE UPDATE ON loyalty_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_loyalty_rewards_updated_at ON loyalty_rewards;
CREATE TRIGGER update_loyalty_rewards_updated_at
  BEFORE UPDATE ON loyalty_rewards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_loyalty_redemptions_updated_at ON loyalty_redemptions;
CREATE TRIGGER update_loyalty_redemptions_updated_at
  BEFORE UPDATE ON loyalty_redemptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_product_mappings_updated_at ON product_mappings;
CREATE TRIGGER update_product_mappings_updated_at
  BEFORE UPDATE ON product_mappings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_app_settings_updated_at ON app_settings;
CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create admin check function
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to promote user to admin
CREATE OR REPLACE FUNCTION promote_user_to_admin(user_email text)
RETURNS boolean AS $$
DECLARE
  target_user_id uuid;
BEGIN
  -- Find user by email
  SELECT id INTO target_user_id 
  FROM auth.users 
  WHERE email = user_email;
  
  IF target_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Update or insert profile with admin role
  INSERT INTO profiles (user_id, email, role)
  VALUES (target_user_id, user_email, 'admin')
  ON CONFLICT (user_id) 
  DO UPDATE SET role = 'admin', email = user_email;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (user_id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON profiles;
DROP POLICY IF EXISTS "Allow profile creation during signup" ON profiles;

DROP POLICY IF EXISTS "Users can view their own loyalty accounts" ON loyalty_accounts;
DROP POLICY IF EXISTS "Users can update their own loyalty accounts" ON loyalty_accounts;
DROP POLICY IF EXISTS "Users can create their own loyalty accounts" ON loyalty_accounts;

DROP POLICY IF EXISTS "Anyone can view active rewards" ON loyalty_rewards;
DROP POLICY IF EXISTS "Admins can create loyalty_rewards" ON loyalty_rewards;
DROP POLICY IF EXISTS "Admins can update loyalty_rewards" ON loyalty_rewards;
DROP POLICY IF EXISTS "Admins can delete loyalty_rewards" ON loyalty_rewards;

DROP POLICY IF EXISTS "Users can view their own transactions" ON loyalty_transactions;
DROP POLICY IF EXISTS "Users can create their own transactions" ON loyalty_transactions;

DROP POLICY IF EXISTS "Users can view their own redemptions" ON loyalty_redemptions;
DROP POLICY IF EXISTS "Users can create their own redemptions" ON loyalty_redemptions;
DROP POLICY IF EXISTS "Admins can manage all redemptions" ON loyalty_redemptions;

DROP POLICY IF EXISTS "Admins can view product_mappings" ON product_mappings;
DROP POLICY IF EXISTS "Admins can create product_mappings" ON product_mappings;
DROP POLICY IF EXISTS "Admins can update product_mappings" ON product_mappings;
DROP POLICY IF EXISTS "Admins can delete product_mappings" ON product_mappings;

DROP POLICY IF EXISTS "Admins can view app_settings" ON app_settings;
DROP POLICY IF EXISTS "Admins can create app_settings" ON app_settings;
DROP POLICY IF EXISTS "Admins can update app_settings" ON app_settings;
DROP POLICY IF EXISTS "Admins can delete app_settings" ON app_settings;
DROP POLICY IF EXISTS "Allow admin operations on app_settings" ON app_settings;

-- Create RLS policies for profiles
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow profile creation during signup" ON profiles
  FOR INSERT WITH CHECK (true);

-- Create RLS policies for loyalty_accounts
CREATE POLICY "Users can view their own loyalty accounts" ON loyalty_accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own loyalty accounts" ON loyalty_accounts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own loyalty accounts" ON loyalty_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for loyalty_rewards
CREATE POLICY "Anyone can view active rewards" ON loyalty_rewards
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can create loyalty_rewards" ON loyalty_rewards
  FOR INSERT WITH CHECK (is_current_user_admin());

CREATE POLICY "Admins can update loyalty_rewards" ON loyalty_rewards
  FOR UPDATE USING (is_current_user_admin()) WITH CHECK (is_current_user_admin());

CREATE POLICY "Admins can delete loyalty_rewards" ON loyalty_rewards
  FOR DELETE USING (is_current_user_admin());

-- Create RLS policies for loyalty_transactions
CREATE POLICY "Users can view their own transactions" ON loyalty_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own transactions" ON loyalty_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for loyalty_redemptions
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

-- Create RLS policies for product_mappings
CREATE POLICY "Admins can view product_mappings" ON product_mappings
  FOR SELECT USING (is_current_user_admin());

CREATE POLICY "Admins can create product_mappings" ON product_mappings
  FOR INSERT WITH CHECK (is_current_user_admin());

CREATE POLICY "Admins can update product_mappings" ON product_mappings
  FOR UPDATE USING (is_current_user_admin()) WITH CHECK (is_current_user_admin());

CREATE POLICY "Admins can delete product_mappings" ON product_mappings
  FOR DELETE USING (is_current_user_admin());

-- Create RLS policies for app_settings
CREATE POLICY "Admins can view app_settings" ON app_settings
  FOR SELECT USING (is_current_user_admin());

CREATE POLICY "Admins can create app_settings" ON app_settings
  FOR INSERT WITH CHECK (is_current_user_admin());

CREATE POLICY "Admins can update app_settings" ON app_settings
  FOR UPDATE USING (is_current_user_admin()) WITH CHECK (is_current_user_admin());

CREATE POLICY "Admins can delete app_settings" ON app_settings
  FOR DELETE USING (is_current_user_admin());

-- Allow unrestricted access to app_settings for admin interface
CREATE POLICY "Allow admin operations on app_settings" ON app_settings
  FOR ALL USING (true) WITH CHECK (true);

-- Insert default app settings
INSERT INTO app_settings (key, value) VALUES
  ('square_environment', '"sandbox"'),
  ('loyalty_widget_enabled', 'true'),
  ('show_points_balance', 'true'),
  ('allow_phone_lookup', 'true'),
  ('widget_title', '"Loyalty Program"')
ON CONFLICT (key) DO NOTHING;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;