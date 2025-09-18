-- Create table for storing app configuration settings
CREATE TABLE public.app_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access (for now, any authenticated user can manage settings)
-- In production, you'd want to restrict this to admin users only
CREATE POLICY "Authenticated users can manage app settings" 
ON public.app_settings 
FOR ALL 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Create trigger for updated_at
CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings
INSERT INTO public.app_settings (key, value) VALUES 
  ('square_environment', '"sandbox"'),
  ('loyalty_widget_enabled', 'true'),
  ('show_points_balance', 'true'),
  ('allow_phone_lookup', 'true'),
  ('widget_title', '"Loyalty Program"');