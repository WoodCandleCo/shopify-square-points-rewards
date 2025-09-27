# Troubleshooting Guide - Square Loyalty Integration

## 🚨 Common Issues & Solutions

### 1. Deployment Issues

#### Issue: Build Fails During Deployment
**Symptoms**: Deployment stops with build errors
**Solutions**:
```bash
# Check for TypeScript errors
npm run build

# Common fixes:
# 1. Missing dependencies
npm install

# 2. TypeScript strict mode issues
# Add to tsconfig.json:
"strict": false,
"noImplicitAny": false
```

#### Issue: Environment Variables Not Loading
**Symptoms**: App loads but API calls fail
**Solutions**:
1. Verify variables in Bolt Settings > Environment Variables
2. Ensure variable names start with `VITE_` for frontend
3. Restart deployment after adding variables

### 2. Supabase Integration Issues

#### Issue: "Failed to create Supabase client"
**Symptoms**: App crashes on load with Supabase error
**Solutions**:
```javascript
// Check these environment variables:
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

// Verify in browser console:
console.log(import.meta.env.VITE_SUPABASE_URL)
```

#### Issue: Edge Functions Return 404
**Symptoms**: "Function not found" errors
**Solutions**:
```bash
# Deploy functions manually:
supabase functions deploy square-test-connection
supabase functions deploy loyalty-lookup
supabase functions deploy loyalty-redeem

# Or deploy all at once:
supabase functions deploy
```

#### Issue: Database Connection Errors
**Symptoms**: RLS policy errors, permission denied
**Solutions**:
1. Check RLS policies in Supabase dashboard
2. Verify user has correct role:
```sql
-- Make user admin:
UPDATE profiles SET role = 'admin' WHERE user_id = 'user-uuid';
```

### 3. Square API Issues

#### Issue: "Square access token not configured"
**Symptoms**: Square connection test fails
**Solutions**:
1. Add to Supabase Secrets (not environment variables):
```
SQUARE_ACCESS_TOKEN=your-square-token
SQUARE_APPLICATION_ID=your-app-id
SQUARE_ENVIRONMENT=sandbox
```

#### Issue: "Invalid API key or access token"
**Symptoms**: Square API returns 401 errors
**Solutions**:
1. Verify token is for correct environment (sandbox vs production)
2. Check token permissions in Square Developer Dashboard
3. Regenerate token if necessary

#### Issue: No Loyalty Program Found
**Symptoms**: Rewards sync returns empty results
**Solutions**:
1. Create loyalty program in Square Dashboard
2. Add rewards to the program
3. Ensure program is active

### 4. Shopify Integration Issues

#### Issue: "Shopify credentials not configured"
**Symptoms**: Product loading fails
**Solutions**:
1. Add to Supabase Secrets:
```
SHOPIFY_ACCESS_TOKEN=your-shopify-token
SHOPIFY_SHOP_DOMAIN=your-shop.myshopify.com
```

#### Issue: "Invalid API key or access token" (Shopify)
**Symptoms**: Shopify API returns 401
**Solutions**:
1. Verify token has required scopes:
   - `read_products`
   - `write_products`
   - `read_customers`
   - `write_customers`
2. Check token hasn't expired

#### Issue: Widget Not Appearing in Shopify
**Symptoms**: No loyalty widget in cart
**Solutions**:
1. Verify script is added to theme.liquid:
```html
<script src="https://your-app.bolt.new/loyalty-widget-production.js" defer></script>
```
2. Check browser console for JavaScript errors
3. Verify cart selectors match your theme

### 5. Authentication Issues

#### Issue: "Access Denied" for Admin
**Symptoms**: User can't access admin dashboard
**Solutions**:
1. Check user role in Supabase:
```sql
SELECT * FROM profiles WHERE user_id = auth.uid();
```
2. Update role to admin:
```sql
UPDATE profiles SET role = 'admin' WHERE user_id = 'user-uuid';
```

#### Issue: Email Confirmation Not Working
**Symptoms**: Users can't verify email
**Solutions**:
1. Check Supabase Auth settings
2. Configure email templates
3. Verify SMTP settings

### 6. Widget & UI Issues

#### Issue: Widget Styling Broken
**Symptoms**: Widget appears but looks wrong
**Solutions**:
1. Check CSS conflicts with theme
2. Add `!important` to critical styles
3. Use more specific CSS selectors

#### Issue: Mobile Responsiveness Problems
**Symptoms**: Widget doesn't work on mobile
**Solutions**:
1. Test cart drawer vs cart page
2. Check viewport meta tag
3. Add mobile-specific CSS

### 7. Performance Issues

#### Issue: Slow Loading Times
**Symptoms**: App takes long to load
**Solutions**:
1. Optimize images and assets
2. Enable compression
3. Use CDN for static assets
4. Lazy load components

#### Issue: API Timeouts
**Symptoms**: Functions timeout after 30 seconds
**Solutions**:
1. Optimize database queries
2. Add pagination for large datasets
3. Use background jobs for heavy operations

## 🔧 Debug Tools & Commands

### Browser Console Commands
```javascript
// Check environment variables
console.log(import.meta.env)

// Test Supabase connection
console.log(window.supabase)

// Check authentication state
console.log(await supabase.auth.getUser())
```

### Supabase CLI Commands
```bash
# Check function logs
supabase functions logs loyalty-lookup

# Test function locally
supabase functions serve

# Reset database
supabase db reset
```

### Network Debugging
1. Open Browser Dev Tools > Network tab
2. Look for failed requests (red entries)
3. Check request/response details
4. Verify CORS headers

## 📊 Health Check Endpoints

Create these test URLs to verify system health:

### Frontend Health Check
Visit: `https://your-app.bolt.new/`
**Expected**: App loads without console errors

### API Health Check
```javascript
// Test in browser console:
fetch('/functions/v1/square-test-connection', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}).then(r => r.json()).then(console.log)
```

### Database Health Check
```sql
-- Run in Supabase SQL Editor:
SELECT 
  'profiles' as table_name, 
  count(*) as row_count 
FROM profiles
UNION ALL
SELECT 
  'loyalty_rewards' as table_name, 
  count(*) as row_count 
FROM loyalty_rewards;
```

## 🆘 Emergency Fixes

### Quick Reset Procedures

#### Reset User to Admin
```sql
-- In Supabase SQL Editor:
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'your-email@example.com';
```

#### Clear All Settings
```sql
-- Reset app settings:
DELETE FROM app_settings;
```

#### Recreate Edge Function
```bash
# If function is corrupted:
supabase functions delete function-name
supabase functions deploy function-name
```

## 📞 Getting Help

### Information to Collect Before Asking for Help

1. **Error Messages**: Full error text and stack trace
2. **Browser Console**: Any JavaScript errors
3. **Network Tab**: Failed API requests
4. **Environment**: Browser, device, operating system
5. **Steps to Reproduce**: Exact steps that cause the issue
6. **Expected vs Actual**: What should happen vs what actually happens

### Useful Log Locations

- **Browser Console**: F12 > Console tab
- **Supabase Logs**: Dashboard > Logs section
- **Edge Function Logs**: `supabase functions logs function-name`
- **Network Requests**: F12 > Network tab

Remember: Most issues are configuration-related. Double-check all environment variables and API credentials before diving into code debugging.