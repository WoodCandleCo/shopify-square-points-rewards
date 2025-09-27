/*
  # Initial Square Loyalty Integration Schema

  1. New Tables
    - `profiles`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `email` (text)
      - `first_name` (text)
      - `last_name` (text)
      - `square_customer_id` (text)
      - `shopify_customer_id` (text)
      - `phone` (text)
      - `role` (text, default 'user')
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `loyalty_accounts`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles.user_id)
      - `square_loyalty_account_id` (text, unique)
      - `balance` (integer, default 0)
      - `points_earned_lifetime` (integer, default 0)
      - `program_id` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `loyalty_rewards`
      - `id` (uuid, primary key)
      - `square_reward_id` (text, unique)
      - `name` (text)
      - `description` (text)
      - `points_required` (integer)
      - `discount_amount` (integer)
      - `discount_type` (text, check constraint)
      - `max_discount_amount` (integer)
      - `shopify_product_id` (text)
      - `shopify_product_handle` (text)
      - `shopify_sku` (text)
      - `applicable_product_names` (text array)
      - `is_active` (boolean, default true)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `loyalty_transactions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles.user_id)
      - `loyalty_account_id` (uuid, references loyalty_accounts.id)
      - `square_transaction_id` (text)
      - `transaction_type` (text, check constraint)
      - `points` (integer)
      - `description` (text)
      - `created_at` (timestamp)
    
    - `loyalty_redemptions`
      - `id` (uuid, primary key)
      - `loyalty_account_id` (uuid, references loyalty_accounts.id)
      - `reward_id` (uuid, references loyalty_rewards.id)
      - `points_redeemed` (integer, default 0)
      - `discount_code` (text)
      - `square_redemption_id` (text)
      - `shopify_order_id` (text)
      - `status` (text, default 'pending')
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `app_settings`
      - `id` (uuid, primary key)
      - `key` (text, unique)
      - `value` (jsonb)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `product_mappings`
      - `id` (uuid, primary key)
      - `square_catalog_object_id` (text, unique)
      - `shopify_product_id` (text)
      - `shopify_product_handle` (text)
      - `shopify_collection_id` (text)
      - `product_name` (text)
      - `mapping_type` (text, check constraint)
      - `shopify_tag` (text)
      - `is_active` (boolean, default true)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add appropriate policies for user access
    - Add admin function for elevated permissions

  3. Functions & Triggers
    - Auto-update timestamps
    - Handle new user signup
    - Admin permission checking
*/

-- Create user profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text,
  first_name text,
  last_name text,
  square_customer_id text,
  shopify_customer_id text,
  phone text,
  role text DEFAULT 'user'::text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create loyalty accounts table
CREATE TABLE IF NOT EXISTS public.loyalty_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  square_loyalty_account_id text NOT NULL UNIQUE,
  balance integer DEFAULT 0,
  points_earned_lifetime integer DEFAULT 0,
  program_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.loyalty_accounts ENABLE ROW LEVEL SECURITY;

-- Create loyalty rewards table
CREATE TABLE IF NOT EXISTS public.loyalty_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  square_reward_id text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  points_required integer NOT NULL,
  discount_amount integer,
  discount_type text CHECK (discount_type = ANY (ARRAY['FIXED_AMOUNT'::text, 'PERCENTAGE'::text])),
  max_discount_amount integer,
  shopify_product_id text,
  shopify_product_handle text,
  shopify_sku text,
  applicable_product_names text[],
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;

-- Create loyalty transactions table
CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  loyalty_account_id uuid NOT NULL REFERENCES public.loyalty_accounts(id) ON DELETE CASCADE,
  square_transaction_id text,
  transaction_type text NOT NULL CHECK (transaction_type = ANY (ARRAY['EARN'::text, 'REDEEM'::text])),
  points integer NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- Create loyalty redemptions table
CREATE TABLE IF NOT EXISTS public.loyalty_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loyalty_account_id uuid REFERENCES public.loyalty_accounts(id) ON DELETE CASCADE,
  reward_id uuid REFERENCES public.loyalty_rewards(id) ON DELETE SET NULL,
  points_redeemed integer DEFAULT 0,
  discount_code text,
  square_redemption_id text,
  shopify_order_id text,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.loyalty_redemptions ENABLE ROW LEVEL SECURITY;

-- Create app settings table
CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Create product mappings table
CREATE TABLE IF NOT EXISTS public.product_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  square_catalog_object_id text NOT NULL UNIQUE,
  shopify_product_id text,
  shopify_product_handle text,
  shopify_collection_id text,
  product_name text NOT NULL,
  mapping_type text NOT NULL CHECK (mapping_type = ANY (ARRAY['PRODUCT'::text, 'COLLECTION'::text, 'TAG'::text])),
  shopify_tag text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.product_mappings ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles USING btree (phone);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles USING btree (role);
CREATE INDEX IF NOT EXISTS idx_profiles_shopify_customer_id ON public.profiles USING btree (shopify_customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_account_id ON public.loyalty_redemptions USING btree (loyalty_account_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_shopify_order ON public.loyalty_redemptions USING btree (shopify_order_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_square_id ON public.loyalty_redemptions USING btree (square_redemption_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_status ON public.loyalty_redemptions USING btree (status);
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_shopify_product_id ON public.loyalty_rewards USING btree (shopify_product_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_shopify_sku ON public.loyalty_rewards USING btree (shopify_sku);

-- Create functions
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.promote_user_to_admin(user_email text)
RETURNS boolean AS $$
BEGIN
  UPDATE public.profiles 
  SET role = 'admin' 
  WHERE email = user_email;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_profiles_updated_at') THEN
    CREATE TRIGGER update_profiles_updated_at
      BEFORE UPDATE ON public.profiles
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_loyalty_accounts_updated_at') THEN
    CREATE TRIGGER update_loyalty_accounts_updated_at
      BEFORE UPDATE ON public.loyalty_accounts
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_loyalty_rewards_updated_at') THEN
    CREATE TRIGGER update_loyalty_rewards_updated_at
      BEFORE UPDATE ON public.loyalty_rewards
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_loyalty_redemptions_updated_at') THEN
    CREATE TRIGGER update_loyalty_redemptions_updated_at
      BEFORE UPDATE ON public.loyalty_redemptions
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_app_settings_updated_at') THEN
    CREATE TRIGGER update_app_settings_updated_at
      BEFORE UPDATE ON public.app_settings
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_product_mappings_updated_at') THEN
    CREATE TRIGGER update_product_mappings_updated_at
      BEFORE UPDATE ON public.product_mappings
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Create RLS policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
TO public
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own profile" 
ON public.profiles 
FOR INSERT 
TO public
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow profile creation during signup" 
ON public.profiles 
FOR INSERT 
TO public
WITH CHECK (true);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
TO public
USING (auth.uid() = user_id);

-- Create RLS policies for loyalty accounts
CREATE POLICY "Users can view their own loyalty accounts" 
ON public.loyalty_accounts 
FOR SELECT 
TO public
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own loyalty accounts" 
ON public.loyalty_accounts 
FOR INSERT 
TO public
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own loyalty accounts" 
ON public.loyalty_accounts 
FOR UPDATE 
TO public
USING (auth.uid() = user_id);

-- Create RLS policies for loyalty rewards
CREATE POLICY "Anyone can view active rewards" 
ON public.loyalty_rewards 
FOR SELECT 
TO public
USING (is_active = true);

CREATE POLICY "Admins can create loyalty_rewards" 
ON public.loyalty_rewards 
FOR INSERT 
TO public
WITH CHECK (is_current_user_admin());

CREATE POLICY "Admins can update loyalty_rewards" 
ON public.loyalty_rewards 
FOR UPDATE 
TO public
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

CREATE POLICY "Admins can delete loyalty_rewards" 
ON public.loyalty_rewards 
FOR DELETE 
TO public
USING (is_current_user_admin());

-- Create RLS policies for loyalty transactions
CREATE POLICY "Users can view their own transactions" 
ON public.loyalty_transactions 
FOR SELECT 
TO public
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own transactions" 
ON public.loyalty_transactions 
FOR INSERT 
TO public
WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for loyalty redemptions
CREATE POLICY "Users can view their own redemptions" 
ON public.loyalty_redemptions 
FOR SELECT 
TO public
USING (loyalty_account_id IN (
  SELECT id FROM public.loyalty_accounts WHERE user_id = auth.uid()
));

CREATE POLICY "Users can create their own redemptions" 
ON public.loyalty_redemptions 
FOR INSERT 
TO public
WITH CHECK (loyalty_account_id IN (
  SELECT id FROM public.loyalty_accounts WHERE user_id = auth.uid()
));

CREATE POLICY "Admins can manage all redemptions" 
ON public.loyalty_redemptions 
FOR ALL 
TO public
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

-- Create RLS policies for app settings
CREATE POLICY "Admins can view app_settings" 
ON public.app_settings 
FOR SELECT 
TO public
USING (is_current_user_admin());

CREATE POLICY "Admins can create app_settings" 
ON public.app_settings 
FOR INSERT 
TO public
WITH CHECK (is_current_user_admin());

CREATE POLICY "Admins can update app_settings" 
ON public.app_settings 
FOR UPDATE 
TO public
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

CREATE POLICY "Admins can delete app_settings" 
ON public.app_settings 
FOR DELETE 
TO public
USING (is_current_user_admin());

CREATE POLICY "Allow admin operations on app_settings" 
ON public.app_settings 
FOR ALL 
TO public
USING (true)
WITH CHECK (true);

-- Create RLS policies for product mappings
CREATE POLICY "Admins can view product_mappings" 
ON public.product_mappings 
FOR SELECT 
TO public
USING (is_current_user_admin());

CREATE POLICY "Admins can create product_mappings" 
ON public.product_mappings 
FOR INSERT 
TO public
WITH CHECK (is_current_user_admin());

CREATE POLICY "Admins can update product_mappings" 
ON public.product_mappings 
FOR UPDATE 
TO public
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

CREATE POLICY "Admins can delete product_mappings" 
ON public.product_mappings 
FOR DELETE 
TO public
USING (is_current_user_admin());