# Test Scenarios for Square Loyalty Integration

## 🧪 Comprehensive Testing Checklist

### Pre-Testing Setup
- [ ] App deployed to Bolt Hosting
- [ ] Supabase project created and configured
- [ ] Environment variables set
- [ ] Database migrations run
- [ ] Admin account created
- [ ] Edge functions deployed

## 1. 🔐 Authentication & Authorization Tests

### Test 1.1: User Registration
**Objective**: Verify new users can register
**Steps**:
1. Go to `/auth`
2. Click "Sign Up" tab
3. Fill in: First Name, Last Name, Email, Password
4. Click "Sign Up"
**Expected**: Success message, email confirmation sent
**Pass/Fail**: ___

### Test 1.2: User Login
**Objective**: Verify users can log in
**Steps**:
1. Go to `/auth`
2. Enter email and password
3. Click "Sign In"
**Expected**: Redirect to home page, user authenticated
**Pass/Fail**: ___

### Test 1.3: Admin Access Control
**Objective**: Verify admin-only areas are protected
**Steps**:
1. Login as regular user (role = 'user')
2. Navigate to `/admin`
**Expected**: "Access Denied" message
**Pass/Fail**: ___

### Test 1.4: Admin Dashboard Access
**Objective**: Verify admin can access dashboard
**Steps**:
1. Login as admin user (role = 'admin')
2. Navigate to `/admin`
**Expected**: Full admin dashboard loads
**Pass/Fail**: ___

## 2. 🔧 Square API Integration Tests

### Test 2.1: Square Connection Test
**Objective**: Verify Square API connectivity
**Location**: Admin Dashboard > Settings
**Steps**:
1. Set Square Environment to "sandbox"
2. Click "Test Square Connection"
**Expected**: Success message with location count
**Actual Result**: ___
**Pass/Fail**: ___

### Test 2.2: Square Rewards Sync
**Objective**: Verify rewards can be synced from Square
**Location**: Admin Dashboard > Rewards
**Steps**:
1. Click "Sync from Square"
2. Wait for completion
**Expected**: Rewards appear in table, success toast
**Actual Result**: ___
**Pass/Fail**: ___

### Test 2.3: Reward Status Toggle
**Objective**: Verify rewards can be activated/deactivated
**Location**: Admin Dashboard > Rewards
**Steps**:
1. Find a reward in the table
2. Click "Activate" or "Deactivate"
**Expected**: Status changes, success toast
**Pass/Fail**: ___

## 3. 🛒 Shopify API Integration Tests

### Test 3.1: Shopify Connection Test
**Objective**: Verify Shopify API connectivity
**Location**: Admin Dashboard > Product Tags
**Steps**:
1. Click "Test Shopify" button
**Expected**: Shows store URL and token status
**Actual Result**: ___
**Pass/Fail**: ___

### Test 3.2: Product Loading
**Objective**: Verify products can be loaded from Shopify
**Location**: Admin Dashboard > Product Tags
**Steps**:
1. Click "Refresh" button
2. Wait for loading to complete
**Expected**: Products appear in table
**Actual Result**: ___
**Pass/Fail**: ___

### Test 3.3: Auto-Tagging
**Objective**: Verify products can be auto-tagged
**Location**: Admin Dashboard > Product Tags
**Steps**:
1. Ensure products are loaded
2. Click "Auto-Tag" button
**Expected**: Products get loyalty tags, success message
**Actual Result**: ___
**Pass/Fail**: ___

### Test 3.4: Manual Tag Management
**Objective**: Verify manual tag addition/removal
**Location**: Admin Dashboard > Product Tags
**Steps**:
1. Select a product
2. Add a tag using dropdown
3. Remove a tag by clicking it
**Expected**: Tags update correctly
**Pass/Fail**: ___

## 4. 🎁 Loyalty Widget Tests

### Test 4.1: Widget Preview - Phone Lookup
**Objective**: Verify widget phone lookup functionality
**Location**: Admin Dashboard > Preview
**Steps**:
1. Enter phone number in widget
2. Click "Connect Account"
**Expected**: Mock account connects, shows points balance
**Actual Result**: ___
**Pass/Fail**: ___

### Test 4.2: Widget Preview - Reward Redemption
**Objective**: Verify reward redemption in preview
**Location**: Admin Dashboard > Preview
**Steps**:
1. Connect account (from Test 4.1)
2. Click "Redeem" on available reward
**Expected**: Points deducted, success message
**Pass/Fail**: ___

### Test 4.3: Shopify Widget Integration
**Objective**: Verify widget appears in Shopify cart
**Prerequisites**: Widget script added to theme.liquid
**Steps**:
1. Go to your Shopify store
2. Add items to cart
3. View cart page or open cart drawer
**Expected**: "🎁 Loyalty Rewards" section appears
**Pass/Fail**: ___

### Test 4.4: Shopify Widget Functionality
**Objective**: Verify widget works in Shopify
**Prerequisites**: Widget visible in cart
**Steps**:
1. Enter phone number in widget
2. Click "Connect Account"
**Expected**: Account connects, rewards show
**Pass/Fail**: ___

## 5. 📊 Promotions & Advanced Features

### Test 5.1: Promotions Loading
**Objective**: Verify promotions can be loaded
**Location**: Admin Dashboard > Promotions
**Steps**:
1. Click "Refresh Promotions"
**Expected**: Promotions load or show "no promotions" message
**Pass/Fail**: ___

### Test 5.2: Customer Testing
**Objective**: Verify customer eligibility testing
**Location**: Admin Dashboard > Promotions > Customer Testing
**Steps**:
1. Enter a customer ID
2. Click "Test Eligibility"
**Expected**: Shows eligible promotions count
**Pass/Fail**: ___

## 6. ⚙️ Settings & Configuration

### Test 6.1: Widget Settings
**Objective**: Verify widget settings can be updated
**Location**: Admin Dashboard > Settings
**Steps**:
1. Toggle "Enable Loyalty Extension"
2. Change "Extension Title"
3. Toggle other settings
**Expected**: Settings save successfully
**Pass/Fail**: ___

### Test 6.2: Environment Switching
**Objective**: Verify Square environment can be changed
**Location**: Admin Dashboard > Settings
**Steps**:
1. Change from "sandbox" to "production"
2. Test connection
**Expected**: Environment changes, connection reflects new setting
**Pass/Fail**: ___

## 7. 🔍 Error Handling & Edge Cases

### Test 7.1: Invalid Phone Number
**Objective**: Verify error handling for invalid phone
**Location**: Widget Preview
**Steps**:
1. Enter invalid phone number (e.g., "123")
2. Click "Connect Account"
**Expected**: Error message or graceful handling
**Pass/Fail**: ___

### Test 7.2: Network Error Handling
**Objective**: Verify app handles network errors
**Steps**:
1. Disconnect internet
2. Try to sync rewards
**Expected**: Error message, app doesn't crash
**Pass/Fail**: ___

### Test 7.3: Insufficient Points
**Objective**: Verify handling when user has insufficient points
**Location**: Widget Preview
**Steps**:
1. Connect account with low points
2. Try to redeem high-point reward
**Expected**: Reward disabled or error message
**Pass/Fail**: ___

## 8. 📱 Responsive & UI Tests

### Test 8.1: Mobile Responsiveness
**Objective**: Verify app works on mobile
**Steps**:
1. Open app on mobile device or use browser dev tools
2. Test all major functions
**Expected**: UI adapts properly, all functions work
**Pass/Fail**: ___

### Test 8.2: Cart Drawer Integration
**Objective**: Verify widget works in cart drawer
**Prerequisites**: Shopify theme with cart drawer
**Steps**:
1. Add items to cart
2. Open cart drawer
**Expected**: Widget appears and functions in drawer
**Pass/Fail**: ___

## 9. 🔒 Security Tests

### Test 9.1: Unauthorized API Access
**Objective**: Verify API endpoints are protected
**Steps**:
1. Logout from app
2. Try to access admin functions directly
**Expected**: Access denied or redirect to login
**Pass/Fail**: ___

### Test 9.2: SQL Injection Protection
**Objective**: Verify database queries are protected
**Steps**:
1. Try entering SQL in form fields
2. Submit forms
**Expected**: No database errors, input sanitized
**Pass/Fail**: ___

## 📋 Test Summary

**Total Tests**: 25
**Passed**: ___
**Failed**: ___
**Skipped**: ___

### Critical Issues Found:
1. ________________________________
2. ________________________________
3. ________________________________

### Recommendations:
1. ________________________________
2. ________________________________
3. ________________________________

### Sign-off:
**Tester**: _________________ **Date**: _________
**Status**: ☐ Ready for Production ☐ Needs Fixes ☐ Major Issues