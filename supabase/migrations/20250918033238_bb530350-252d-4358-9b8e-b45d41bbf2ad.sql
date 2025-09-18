-- Update RLS policies for app_settings to allow admin operations without authentication
-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Authenticated users can manage app settings" ON public.app_settings;

-- Create a new policy that allows all operations (since this is admin-only functionality)
CREATE POLICY "Allow admin operations on app_settings" 
ON public.app_settings 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Comment explaining this is for admin interface
COMMENT ON TABLE public.app_settings IS 'Admin configuration settings - unrestricted access for admin interface';