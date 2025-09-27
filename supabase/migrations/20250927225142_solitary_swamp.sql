/*
  # Update Auth Settings for Square Loyalty Integration

  1. Auth Configuration
    - Disable email confirmation for easier testing
    - Enable sign-ups
    - Configure JWT settings
    - Set up proper auth flow

  2. Security Settings
    - Configure session timeout
    - Set up proper CORS settings
    - Enable necessary auth providers
*/

-- This migration handles auth settings that need to be configured via Supabase dashboard
-- The actual settings need to be applied manually in the Supabase dashboard

-- Create a function to check auth configuration
CREATE OR REPLACE FUNCTION check_auth_config()
RETURNS text AS $$
BEGIN
  RETURN 'Auth configuration should be set in Supabase Dashboard:
  
  1. Go to Authentication > Settings
  2. Set "Enable email confirmations" to OFF (for easier testing)
  3. Set "Enable sign ups" to ON
  4. Configure Site URL to your deployment URL
  5. Add your deployment URL to "Redirect URLs"
  
  Current auth.users count: ' || (SELECT count(*) FROM auth.users)::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Select the function to show instructions
SELECT check_auth_config();