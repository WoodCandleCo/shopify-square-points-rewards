# Square Loyalty Integration for Shopify

A comprehensive loyalty program integration that connects Square's loyalty system with Shopify stores.

## Features

- **Square API Integration**: Connect to existing Square loyalty programs
- **Shopify Compatibility**: Works with all Shopify plans (including Basic)
- **Real-time Rewards**: Customers can redeem points during checkout
- **Phone Lookup**: Find loyalty accounts by phone number
- **Admin Dashboard**: Manage rewards, settings, and product mappings
- **Auto-tagging**: Automatically tag products for loyalty eligibility

## Setup Instructions

### 1. Environment Variables

Set up your environment variables in Supabase:

1. **Frontend Environment Variables** (in your deployment platform):
   - `VITE_SUPABASE_URL`: Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key

2. **Backend Environment Variables** (in Supabase Secrets):
   - `SQUARE_ACCESS_TOKEN`: Your Square API access token
   - `SQUARE_APPLICATION_ID`: Your Square application ID
   - `SQUARE_ENVIRONMENT`: Either 'sandbox' or 'production'
   - `SHOPIFY_ACCESS_TOKEN`: Your Shopify Admin API access token
   - `SHOPIFY_SHOP_DOMAIN`: Your shop domain (e.g., `your-shop.myshopify.com`)

### 2. Supabase Setup

1. Create a new Supabase project
2. Run the database migrations
3. Configure the environment variables as described above

### 3. Development

Install dependencies and start the development server:

```sh
npm install
npm i
npm run dev
```

### 4. Shopify Integration

Add the loyalty widget script to your Shopify theme:

```html
<script src="https://your-domain.com/loyalty-widget-production.js" defer></script>
```

## Architecture

### Tech Stack

- **Frontend**: React + TypeScript + Vite
- **UI Components**: shadcn/ui + Tailwind CSS
- **Backend**: Supabase (Database + Edge Functions)
- **Authentication**: Supabase Auth
- **APIs**: Square API, Shopify Admin API

### Database Schema

- `profiles`: User profiles with Square/Shopify customer links
- `loyalty_accounts`: Square loyalty account data
- `loyalty_rewards`: Available rewards from Square
- `loyalty_transactions`: Point earning/redemption history
- `app_settings`: Application configuration
- `product_mappings`: Square-to-Shopify product mappings

## Deployment

1. Build the project: `npm run build`
2. Deploy to your preferred hosting platform
3. Set up environment variables on the hosting platform
4. Configure Supabase edge functions

## Admin Features

- **Settings**: Configure Square API and widget behavior
- **Rewards Management**: Sync and manage Square loyalty rewards
- **Product Tagging**: Auto-tag products for loyalty eligibility
- **Promotions**: Manage Square loyalty promotions
- **Preview**: Test the loyalty widget appearance

## License

MIT License - see LICENSE file for details.