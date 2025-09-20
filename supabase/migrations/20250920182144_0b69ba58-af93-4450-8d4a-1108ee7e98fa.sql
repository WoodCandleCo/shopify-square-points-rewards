-- Fix the handle_new_user function to work with RLS policies
-- The function needs to be SECURITY DEFINER to bypass RLS during profile creation
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Also create a policy to allow profile creation during signup
-- This ensures the system can create profiles even with RLS enabled
CREATE POLICY "Allow profile creation during signup" 
ON public.profiles 
FOR INSERT 
WITH CHECK (true);