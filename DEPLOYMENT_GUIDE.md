# Square Loyalty Integration - Deployment & Testing Guide

## 🚀 Phase 1: Initial Deployment

### Step 1: Deploy to Bolt Hosting
1. Click the **"Deploy"** button in the Bolt interface
2. Choose **"Bolt Hosting"** as your deployment provider
3. Wait for the build and deployment to complete
4. Note your deployment URL (e.g., `https://your-app.bolt.new`)

### Step 2: Set Up Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to initialize (2-3 minutes)
3. Go to **Settings > API** and copy:
   - Project URL
   - `anon` public key
   - `service_role` secret key

### Step 3: Configure Environment Variables
1. In your Bolt project, go to **Settings > Environment Variables**
2. Add these frontend variables:
   ```
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

### Step 4: Set Up Supabase Backend
1. In Supabase dashboard, go to **Settings > Secrets**
2. Add these backend secrets:
   ```
   SQUARE_ACCESS_TOKEN=your_square_access_token
   SQUARE_APPLICATION_ID=your_square_application_id
   SQUARE_ENVIRONMENT=sandbox
   SHOPIFY_ACCESS_TOKEN=your_shopify_access_token
   SHOPIFY_SHOP_DOMAIN=your-shop.myshopify.com
   ```

## 🔧 Phase 2: Database Setup

### Step 1: Run Database Migrations
1. In Supabase dashboard, go to **SQL Editor**
2. Run this migration to create the core tables:

```sql
-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Create app_settings table
CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

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

-- Create RLS policies
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view active rewards" ON loyalty_rewards
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage app_settings" ON app_settings
  FOR ALL USING (is_current_user_admin());
```

### Step 2: Deploy Edge Functions
1. In your local project, use the Supabase CLI:
   ```bash
   # Install Supabase CLI if not already installed
   npm install -g supabase

   # Login to Supabase
   supabase login

   # Link to your project
   supabase link --project-ref your_project_ref

   # Deploy all functions
   supabase functions deploy
   ```

## 🧪 Phase 3: Testing Framework

### Step 1: Create Admin Account
1. Visit your deployed app: `https://your-app.bolt.new`
2. Click **"Sign In"** → **"Sign Up"**
3. Create an account with your email
4. In Supabase dashboard, go to **Table Editor > profiles**
5. Find your profile and change `role` from `user` to `admin`

### Step 2: Access Admin Dashboard
1. Refresh your app and go to `/admin`
2. You should now see the full admin dashboard

## 🔍 Phase 4: Integration Testing

### Test 1: Square API Connection
```markdown
**Location**: Admin Dashboard > Settings tab
**Steps**:
1. Set Square Environment to "sandbox"
2. Click "Test Square Connection"
**Expected**: Success message with location count
**Troubleshooting**: Check SQUARE_ACCESS_TOKEN in Supabase secrets
```

### Test 2: Shopify API Connection
```markdown
**Location**: Admin Dashboard > Product Tags tab
**Steps**:
1. Click "Test Shopify" button
**Expected**: Shows store URL and token status
**Troubleshooting**: Check SHOPIFY_ACCESS_TOKEN and SHOPIFY_SHOP_DOMAIN
```

### Test 3: Rewards Sync
```markdown
**Location**: Admin Dashboard > Rewards tab
**Steps**:
1. Click "Sync from Square"
**Expected**: Rewards appear in table
**Troubleshooting**: Ensure Square loyalty program exists
```

### Test 4: Product Auto-Tagging
```markdown
**Location**: Admin Dashboard > Product Tags tab
**Steps**:
1. Click "Refresh" to load products
2. Click "Auto-Tag" button
**Expected**: Products get loyalty tags
**Troubleshooting**: Check Shopify product access
```

### Test 5: Loyalty Widget Preview
```markdown
**Location**: Admin Dashboard > Preview tab
**Steps**:
1. Enter a phone number in the widget
2. Click "Connect Account"
**Expected**: Mock account connects with points balance
**Troubleshooting**: Check browser console for errors
```

## 🛠 Phase 5: Shopify Integration

### Step 1: Add Widget to Shopify Theme
1. In Shopify admin, go to **Online Store > Themes**
2. Click **Actions > Edit code**
3. Open `theme.liquid`
4. Add before `</head>`:
   ```html
   <script src="https://your-app.bolt.new/loyalty-widget-production.js" defer></script>
   ```

### Step 2: Test Widget in Shopify
1. Add items to cart in your Shopify store
2. Open cart page or cart drawer
3. Look for "🎁 Loyalty Rewards" section
4. Test phone number lookup

## 📊 Phase 6: Monitoring & Debugging

### Debug Checklist
- [ ] App loads without console errors
- [ ] Admin dashboard accessible
- [ ] Square connection test passes
- [ ] Shopify connection test passes
- [ ] Rewards sync successfully
- [ ] Product tagging works
- [ ] Widget preview functions
- [ ] Shopify widget appears in cart

### Common Issues & Solutions

**Issue**: "Function not found" errors
**Solution**: Redeploy Edge Functions with `supabase functions deploy`

**Issue**: Square connection fails
**Solution**: Verify SQUARE_ACCESS_TOKEN and SQUARE_ENVIRONMENT in Supabase secrets

**Issue**: Shopify products don't load
**Solution**: Check SHOPIFY_ACCESS_TOKEN has correct permissions (read_products)

**Issue**: Widget doesn't appear in Shopify
**Solution**: Verify script URL and check browser network tab

**Issue**: Admin access denied
**Solution**: Update profile role to 'admin' in Supabase table editor

## 🎯 Success Criteria

Your deployment is successful when:
- ✅ App loads without errors
- ✅ Admin can sign in and access dashboard
- ✅ Square API connection test passes
- ✅ Shopify API connection test passes
- ✅ Rewards can be synced from Square
- ✅ Products can be auto-tagged
- ✅ Widget preview shows mock loyalty account
- ✅ Shopify widget appears in cart
- ✅ Phone lookup returns mock account data

## 📞 Support

If you encounter issues:
1. Check browser console for JavaScript errors
2. Check Supabase logs in dashboard
3. Verify all environment variables are set
4. Ensure API credentials have correct permissions
5. Test individual components in isolation

Remember: This is a comprehensive loyalty integration system. Start with basic functionality and gradually enable advanced features as you confirm each component works correctly.