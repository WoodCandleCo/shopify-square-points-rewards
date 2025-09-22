// Shopify Loyalty Widget - Cart Drawer Integration
// This file is hosted and injected into Shopify stores via theme.liquid

(function() {
  'use strict';

  // Configuration - Update this domain to match your deployment
  const API_BASE_URL = 'https://shopify-square-points-rewards.lovable.app';
  
  // Widget state
  let isWidgetLoaded = false;
  let currentCustomerData = null;
  let loyaltyData = null;

  // Constants for injection strategy
  const SLOT_ID = 'cart-loyalty-slot';
  const DIVIDER_CLASS = 'cart-actions__divider';

  // Widget CSS - scoped to cart drawer summary
  const WIDGET_CSS = `
    /* Cart Loyalty slot — scoped to cart drawer */
    .cart-drawer__summary .cart-actions .cart-loyalty {
      display: block;
      width: 100%;
      margin: 0;
      padding: 0;
    }

    .cart-drawer__summary .cart-actions .cart-loyalty__mount * {
      max-width: 100%;
      box-sizing: border-box;
    }

    /* Widget styling within cart drawer context */
    .cart-drawer__summary .cart-actions .cart-loyalty #loyalty-widget { 
      display: block; 
      width: 100%; 
      margin: 0 0 12px 0;
      padding: 0;
      font-family: inherit;
      font-size: inherit;
      line-height: inherit;
      position: relative;
      z-index: 1;
      flex-shrink: 0;
    }

    .cart-drawer__summary .cart-actions .cart-loyalty #loyalty-widget * { 
      box-sizing: border-box; 
      font-family: inherit;
    }

    .cart-drawer__summary .cart-actions .cart-loyalty #loyalty-header { 
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding: 12px 0 8px 0;
    }

    .cart-drawer__summary .cart-actions .cart-loyalty #loyalty-widget button:hover { 
      background-color: rgba(255, 255, 255, 0.8) !important; 
    }

    .cart-drawer__summary .cart-actions .cart-loyalty #loyalty-widget input:focus {
      outline: none;
      background: rgba(255, 255, 255, 1);
    }

    .cart-drawer__summary .cart-actions .cart-loyalty #loyalty-widget input::placeholder {
      color: rgba(0, 0, 0, 0.5);
    }

    .cart-drawer__summary .cart-actions .cart-loyalty #loyalty-widget .reward-item {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 8px;
      margin: 6px 0;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      transition: border-color 0.2s;
    }

    .cart-drawer__summary .cart-actions .cart-loyalty #loyalty-widget .reward-item:hover { 
      border-color: rgba(255, 255, 255, 0.3); 
    }

    .cart-drawer__summary .cart-actions .cart-loyalty #loyalty-widget .reward-item button {
      padding: 8px 14px;
      background: #059669;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: background-color 0.2s;
      white-space: nowrap;
      margin-left: 12px;
    }

    .cart-drawer__summary .cart-actions .cart-loyalty #loyalty-widget .reward-item button:hover { 
      background: #047857 !important; 
    }

    .cart-drawer__summary .cart-actions .cart-loyalty #loyalty-widget .reward-item button:disabled { 
      background: #9ca3af; 
      cursor: not-allowed; 
    }

    .cart-drawer__summary .cart-actions .cart-loyalty #loyalty-widget .reward-info { 
      flex: 1; 
      min-width: 0; 
    }

    .cart-drawer__summary .cart-actions .cart-loyalty #loyalty-widget .reward-name { 
      font-weight: 500; 
      color: white; 
      font-size: 14px; 
      margin: 0 0 4px 0; 
    }

    .cart-drawer__summary .cart-actions .cart-loyalty #loyalty-widget .reward-points { 
      color: rgba(255, 255, 255, 0.7); 
      font-size: 13px; 
      margin: 0; 
    }

    /* Spinning animation */
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;

  // Widget HTML template
  const WIDGET_HTML = `
    <div id="loyalty-widget" style="margin: 0 0 12px 0; padding: 0; border: none; background: none;">
      <div id="loyalty-header" style="padding: 12px 0 8px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
        <span style="display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; letter-spacing: 0.1em; text-transform: uppercase; color: white; font-family: inherit;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20,12 20,22 4,22 4,12"></polyline>
            <rect width="20" height="5" x="2" y="7"></rect>
            <line x1="12" x2="12" y1="22" y2="7"></line>
            <path d="m12 7 3-3H9l3 3z"></path>
          </svg>
          Loyalty Rewards
        </span>
      </div>
      <div id="loyalty-content" style="padding: 12px 0 0 0;">
        <div id="loyalty-loading" style="text-align: center; padding: 16px 0;">
          <div style="display: inline-block; width: 20px; height: 20px; border: 2px solid rgba(255, 255, 255, 0.3); border-top: 2px solid white; border-radius: 50%; animation: spin 1s linear infinite;"></div>
          <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.7); font-size: 14px;">Loading your rewards...</p>
        </div>
        <div id="loyalty-login" style="display: none;">
          <p style="margin: 0 0 8px 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">Enter phone to access rewards</p>
          <div style="display: flex; gap: 8px; margin-bottom: 8px;">
            <input type="tel" id="loyalty-phone" placeholder="Phone number" style="flex: 1; padding: 12px 16px; border: none; border-radius: 15px; font-size: 14px; background: rgba(255, 255, 255, 0.9); color: #333; outline: none;">
            <button id="loyalty-connect-btn" style="padding: 12px 20px; background: rgba(255, 255, 255, 0.9); color: #333; border: none; border-radius: 15px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background-color 0.2s; white-space: nowrap;">Search</button>
          </div>
          <div id="loyalty-error" style="display: none; color: #fca5a5; font-size: 13px; margin-top: 4px;"></div>
        </div>
        <div id="loyalty-account" style="display: none;">
          <div style="margin-bottom: 12px; padding: 10px; background: rgba(255, 255, 255, 0.1); border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.2);">
            <p style="margin: 0; font-weight: 500; color: white; font-size: 14px;">Points Balance: <span id="loyalty-balance" style="color: #10b981;">0</span></p>
          </div>
          <div id="loyalty-rewards">
            <p style="margin: 0 0 8px 0; font-weight: 500; color: white; font-size: 14px;">Available Rewards:</p>
            <div id="loyalty-rewards-list"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Create loyalty section element
  function createLoyaltySection() {
    const section = document.createElement('section');
    section.id = SLOT_ID;
    section.className = 'cart-loyalty';
    section.setAttribute('aria-label', 'Loyalty');

    const mount = document.createElement('div');
    mount.className = 'cart-loyalty__mount';
    mount.id = 'cart-loyalty-mount';
    mount.innerHTML = WIDGET_HTML;
    section.appendChild(mount);
    
    return section;
  }

  // Create divider element
  function createDivider() {
    const div = document.createElement('div');
    div.className = DIVIDER_CLASS;
    div.setAttribute('aria-hidden', 'true');
    return div;
  }

  // Insert loyalty slot into cart drawer
  function insertSlot() {
    const cartActions = document.querySelector('.cart-drawer__summary .cart-actions');
    if (!cartActions) return;

    const cartNote = cartActions.querySelector('cart-note');
    if (!cartNote) return;

    // Prevent duplicates
    if (cartActions.querySelector('#' + SLOT_ID)) return;

    const loyalty = createLoyaltySection();
    cartActions.insertBefore(loyalty, cartNote);
    cartActions.insertBefore(createDivider(), cartNote);

    // Initialize widget functionality
    bindEvents();
    loadCustomerData();
    isWidgetLoaded = true;
    
    console.log('Loyalty widget injected successfully into cart drawer');
  }

  // Initialize widget
  function initLoyaltyWidget() {
    if (isWidgetLoaded) return;
    
    // Add CSS
    const style = document.createElement('style');
    style.textContent = WIDGET_CSS;
    document.head.appendChild(style);

    // Insert the slot
    insertSlot();
  }


  // Bind event listeners (no toggle functionality since it's always visible)
  function bindEvents() {
    const connectBtn = document.getElementById('loyalty-connect-btn');
    const phoneInput = document.getElementById('loyalty-phone');

    if (connectBtn) {
      connectBtn.addEventListener('click', connectLoyalty);
    }

    if (phoneInput) {
      phoneInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          connectLoyalty();
        }
      });
    }
  }

  // Load customer data from Shopify and show appropriate content
  function loadCustomerData() {
    if (window.Shopify && window.Shopify.customer) {
      currentCustomerData = window.Shopify.customer;
      checkExistingLoyaltyAccount();
    } else {
      // Customer not logged in, show login form
      showLoyaltyLogin();
    }
  }

  // Check for existing loyalty account
  async function checkExistingLoyaltyAccount() {
    if (!currentCustomerData) {
      showLoyaltyLogin();
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/loyalty/account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_id: currentCustomerData.id.toString(),
          email: currentCustomerData.email
        })
      });

      const data = await response.json();
      
      if (data.loyalty_account) {
        loyaltyData = data;
        showLoyaltyAccount();
      } else {
        showLoyaltyLogin();
      }
    } catch (error) {
      console.error('Error checking loyalty account:', error);
      showLoyaltyLogin();
    }
  }

  // Connect loyalty account via phone
  async function connectLoyalty() {
    const phoneInput = document.getElementById('loyalty-phone');
    const errorDiv = document.getElementById('loyalty-error');
    const connectBtn = document.getElementById('loyalty-connect-btn');
    
    if (!phoneInput || !connectBtn) return;

    const phone = phoneInput.value.trim();
    if (!phone) {
      showError('Please enter a phone number');
      return;
    }

    connectBtn.disabled = true;
    connectBtn.textContent = 'Connecting...';
    hideError();

    try {
      const response = await fetch(`${API_BASE_URL}/api/loyalty/lookup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: phone,
          customer_id: currentCustomerData?.id?.toString(),
          email: currentCustomerData?.email
        })
      });

      const data = await response.json();
      
      if (response.ok && data.loyalty_account) {
        loyaltyData = data;
        showLoyaltyAccount();
      } else {
        showError(data.error || 'No loyalty account found for this phone number');
      }
    } catch (error) {
      console.error('Error connecting loyalty account:', error);
      showError('Failed to connect loyalty account');
    } finally {
      connectBtn.disabled = false;
      connectBtn.textContent = 'Search';
    }
  }

  // Redeem reward
  async function redeemReward(rewardId, rewardName) {
    if (!loyaltyData?.loyalty_account) return;

    const button = document.querySelector(`[data-reward-id="${rewardId}"]`);
    if (button) {
      button.disabled = true;
      button.textContent = 'Redeeming...';
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/loyalty/redeem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          loyalty_account_id: loyaltyData.loyalty_account.id,
          reward_id: rewardId
        })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        // Update balance
        loyaltyData.loyalty_account.balance = data.new_balance;
        document.getElementById('loyalty-balance').textContent = data.new_balance;
        
        // Apply discount code to cart
        if (data.discount_code) {
          await applyDiscountCode(data.discount_code);
          alert(`Reward redeemed! Discount code ${data.discount_code} has been applied to your cart.`);
        } else {
          alert(`Reward "${rewardName}" redeemed successfully!`);
        }
        
        // Refresh rewards list
        refreshRewardsList();
      } else {
        alert(data.error || 'Failed to redeem reward');
      }
    } catch (error) {
      console.error('Error redeeming reward:', error);
      alert('Failed to redeem reward');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'Redeem';
      }
    }
  }

  // Apply discount code to Shopify cart
  async function applyDiscountCode(code) {
    try {
      // Method 1: Try to apply via AJAX if available
      if (window.Shopify && window.Shopify.onCartUpdate) {
        const response = await fetch('/cart/update.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            attributes: {
              discount_code: code
            }
          })
        });
        
        if (response.ok) {
          // Trigger cart update
          window.Shopify.onCartUpdate(await response.json());
          return;
        }
      }

      // Method 2: Redirect to checkout with discount code
      const currentUrl = new URL(window.location);
      currentUrl.searchParams.set('discount', code);
      
      // If we're on cart page, redirect to checkout
      if (window.location.pathname.includes('/cart')) {
        window.location.href = `/checkout?discount=${code}`;
      } else {
        // Update current page URL with discount
        window.history.replaceState(null, '', currentUrl);
      }
    } catch (error) {
      console.error('Error applying discount code:', error);
    }
  }

  // UI helper functions
  function showLoyaltyLogin() {
    hideAll();
    const loginDiv = document.getElementById('loyalty-login');
    if (loginDiv) loginDiv.style.display = 'block';
  }

  function showLoyaltyAccount() {
    hideAll();
    const accountDiv = document.getElementById('loyalty-account');
    const balanceSpan = document.getElementById('loyalty-balance');
    
    if (accountDiv && loyaltyData?.loyalty_account) {
      accountDiv.style.display = 'block';
      if (balanceSpan) {
        balanceSpan.textContent = loyaltyData.loyalty_account.balance || 0;
      }
      refreshRewardsList();
    }
  }

  function showLoyaltyLoading() {
    hideAll();
    const loadingDiv = document.getElementById('loyalty-loading');
    if (loadingDiv) loadingDiv.style.display = 'block';
  }

  function hideAll() {
    const sections = ['loyalty-loading', 'loyalty-login', 'loyalty-account'];
    sections.forEach(id => {
      const element = document.getElementById(id);
      if (element) element.style.display = 'none';
    });
  }

  function refreshRewardsList() {
    const rewardsList = document.getElementById('loyalty-rewards-list');
    if (!rewardsList || !loyaltyData?.available_rewards) return;

    if (loyaltyData.available_rewards.length === 0) {
      rewardsList.innerHTML = '<p style="margin: 0; color: #7f8c8d; font-style: italic;">No rewards available at your current points level.</p>';
      return;
    }

    rewardsList.innerHTML = loyaltyData.available_rewards.map(reward => `
      <div class="reward-item">
        <div class="reward-info">
          <p class="reward-name">${reward.name}</p>
          <p class="reward-points">${reward.points_required} points</p>
        </div>
        <button data-reward-id="${reward.id}" onclick="window.redeemLoyaltyReward('${reward.id}', '${reward.name}')">
          Redeem
        </button>
      </div>
    `).join('');
  }

  function showError(message) {
    const errorDiv = document.getElementById('loyalty-error');
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
    }
  }

  function hideError() {
    const errorDiv = document.getElementById('loyalty-error');
    if (errorDiv) {
      errorDiv.style.display = 'none';
    }
  }

  // Expose redeem function globally for button clicks
  window.redeemLoyaltyReward = redeemReward;

  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', initLoyaltyWidget);

  // MutationObserver for re-render resilience
  const observer = new MutationObserver(insertSlot);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Listen for cart events
  window.addEventListener('cart:open', insertSlot);
  document.addEventListener('cart:updated', insertSlot);
  document.addEventListener('cart:ready', insertSlot);
  document.addEventListener('cart:refresh', insertSlot);

})();