-- First, add an admin role system to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- Create an index for better performance on role queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Create a security definer function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Drop the overly permissive policy on app_settings
DROP POLICY IF EXISTS "Allow admin operations on app_settings" ON public.app_settings;

-- Create secure policies for app_settings that require admin access
CREATE POLICY "Admins can view app_settings" 
ON public.app_settings FOR SELECT 
USING (public.is_current_user_admin());

CREATE POLICY "Admins can create app_settings" 
ON public.app_settings FOR INSERT 
WITH CHECK (public.is_current_user_admin());

CREATE POLICY "Admins can update app_settings" 
ON public.app_settings FOR UPDATE 
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

CREATE POLICY "Admins can delete app_settings" 
ON public.app_settings FOR DELETE 
USING (public.is_current_user_admin());

-- Update loyalty_rewards policies to also require admin for modifications
-- The current SELECT policy allows anyone to view active rewards, which is good for the cart widget
-- But we need admin-only policies for INSERT, UPDATE, DELETE

CREATE POLICY "Admins can create loyalty_rewards" 
ON public.loyalty_rewards FOR INSERT 
WITH CHECK (public.is_current_user_admin());

CREATE POLICY "Admins can update loyalty_rewards" 
ON public.loyalty_rewards FOR UPDATE 
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

CREATE POLICY "Admins can delete loyalty_rewards" 
ON public.loyalty_rewards FOR DELETE 
USING (public.is_current_user_admin());

-- Update product_mappings policies to be more specific
DROP POLICY IF EXISTS "Allow admin operations on product_mappings" ON public.product_mappings;

CREATE POLICY "Admins can view product_mappings" 
ON public.product_mappings FOR SELECT 
USING (public.is_current_user_admin());

CREATE POLICY "Admins can create product_mappings" 
ON public.product_mappings FOR INSERT 
WITH CHECK (public.is_current_user_admin());

CREATE POLICY "Admins can update product_mappings" 
ON public.product_mappings FOR UPDATE 
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

CREATE POLICY "Admins can delete product_mappings" 
ON public.product_mappings FOR DELETE 
USING (public.is_current_user_admin());

-- Create a function to promote a user to admin (for initial setup)
CREATE OR REPLACE FUNCTION public.promote_user_to_admin(user_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.profiles 
  SET role = 'admin' 
  WHERE email = user_email;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;