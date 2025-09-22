// Shopify Loyalty Widget - Script Injection Version
// This file is hosted and injected into Shopify stores via theme.liquid

(function() {
  'use strict';

  // Configuration - Update this domain to match your deployment
  const API_BASE_URL = 'https://shopify-square-points-rewards.lovable.app';
  
  // Widget state
  let isWidgetLoaded = false;
  let currentCustomerData = null;
  let loyaltyData = null;

  // Widget HTML template - styled to match Admin preview verbiage
  const WIDGET_HTML = `
    <div id="loyalty-widget" style="margin: 16px 0; padding: 0; border: none; background: none;">
      <div id="loyalty-header" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; padding: 16px 0; border-bottom: 1px solid #e5e7eb; font-weight: 500;">
        <span style="display: flex; align-items: center; gap: 8px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20,12 20,22 4,22 4,12"></polyline>
            <rect width="20" height="5" x="2" y="7"></rect>
            <line x1="12" x2="12" y1="22" y2="7"></line>
            <path d="m12 7 3-3H9l3 3z"></path>
          </svg>
          Loyalty Rewards
        </span>
        <span id="loyalty-toggle" style="font-size: 20px; color: #6b7280; transition: transform 0.2s;">+</span>
      </div>
      <div id="loyalty-content" style="display: none; padding: 16px 0 0 0;">
        <div id="loyalty-loading" style="text-align: center; padding: 24px 0;">
          <div style="display: inline-block; width: 20px; height: 20px; border: 2px solid #e5e7eb; border-top: 2px solid #3b82f6; border-radius: 50%; animation: spin 1s linear infinite;"></div>
          <p style="margin: 12px 0 0 0; color: #6b7280; font-size: 14px;">Loading your rewards...</p>
        </div>
        <div id="loyalty-login" style="display: none;">
          <p style="margin: 0 0 12px 0; color: #374151; font-size: 14px;">Enter phone to access rewards</p>
          <div style="display: flex; gap: 8px; margin-bottom: 12px;">
            <input type="tel" id="loyalty-phone" placeholder="+1 (555) 123-4567" style="flex: 1; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; background: white;">
            <button id="loyalty-connect-btn" style="padding: 10px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background-color 0.2s;">Connect Account</button>
          </div>
          <div id="loyalty-error" style="display: none; color: #dc2626; font-size: 13px; margin-top: 8px;"></div>
        </div>
        <div id="loyalty-account" style="display: none;">
          <div style="margin-bottom: 16px; padding: 12px; background: #f3f4f6; border-radius: 6px; border: 1px solid #e5e7eb;">
            <p style="margin: 0; font-weight: 500; color: #111827; font-size: 14px;">Points Balance: <span id="loyalty-balance" style="color: #059669;">0</span></p>
          </div>
          <div id="loyalty-rewards">
            <p style="margin: 0 0 12px 0; font-weight: 500; color: #111827; font-size: 14px;">Available Rewards:</p>
            <div id="loyalty-rewards-list"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  // CSS animations and styling to inherit page fonts
  const WIDGET_CSS = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    /* Ensure the widget is its own row even inside flex parents */
    #loyalty-widget { 
      display: block; 
      width: 100%; 
      flex: 0 0 100%; 
      font-family: inherit;
      font-size: inherit;
      line-height: inherit;
    }
    #loyalty-widget * { 
      box-sizing: border-box; 
      font-family: inherit;
    }

    #loyalty-header { user-select: none; }
    #loyalty-widget button:hover { background-color: #2563eb !important; }
    #loyalty-widget input:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
    #loyalty-widget .reward-item {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 12px;
      margin: 8px 0;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      transition: border-color 0.2s;
    }
    #loyalty-widget .reward-item:hover { border-color: #d1d5db; }
    #loyalty-widget .reward-item button {
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
    #loyalty-widget .reward-item button:hover { background: #047857 !important; }
    #loyalty-widget .reward-item button:disabled { background: #9ca3af; cursor: not-allowed; }
    #loyalty-widget .reward-info { flex: 1; min-width: 0; }
    #loyalty-widget .reward-name { font-weight: 500; color: #111827; font-size: 14px; margin: 0 0 4px 0; }
    #loyalty-widget .reward-points { color: #6b7280; font-size: 13px; margin: 0; }
  `;

  // Initialize widget
  function initLoyaltyWidget() {
    if (isWidgetLoaded) return;
    
    // Add CSS
    const style = document.createElement('style');
    style.textContent = WIDGET_CSS;
    document.head.appendChild(style);

    // Find cart container and inject widget in the optimal position
    const cartContainer = findCartContainer();
    if (cartContainer) {
      const insertionPoint = findInsertionPoint(cartContainer);
      insertionPoint.element.insertAdjacentHTML(insertionPoint.position, WIDGET_HTML);
      
      bindEvents();
      loadCustomerData();
      isWidgetLoaded = true;
    }
  }

  // Find appropriate cart container to insert loyalty widget
  function findCartContainer() {
    // First try to find specific Shopify cart action areas
    const cartActions = document.querySelector('.cart-actions');
    if (cartActions) {
      return cartActions;
    }

    // Try to find cart summary areas
    const cartSummary = document.querySelector('.cart-drawer__summary, .cart__summary-totals');
    if (cartSummary) {
      return cartSummary;
    }

    // Fallback to general cart containers
    const selectors = [
      '.cart__items',
      '.cart-items',
      '.cart-drawer__items',
      '.drawer__cart-items',
      '#cart-items',
      '[data-cart-items]',
      '.cart__content',
      '.cart-content',
      '.cart'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }

    return document.querySelector('form[action="/cart"]') || document.querySelector('.cart');
  }

  // Find the best insertion point within cart actions
  function findInsertionPoint(container) {
    // Prefer to insert BEFORE the outer <cart-note> (Special instructions)
    let outerCartNote = container.querySelector('cart-note');

    // If we only find an inner .cart-note (accordion), try to climb to its <cart-note> ancestor
    if (!outerCartNote) {
      const inner = container.querySelector('.cart-note');
      if (inner && inner.closest) {
        const ancestor = inner.closest('cart-note');
        if (ancestor) outerCartNote = ancestor;
      }
    }

    if (outerCartNote) {
      return { element: outerCartNote, position: 'beforebegin' };
    }

    // Otherwise, optionally place it directly AFTER the Discount section
    const discountSection = container.querySelector('disclosure-custom.cart-discount, .cart-discount');
    if (discountSection) {
      return { element: discountSection, position: 'afterend' };
    }

    // Fallbacks
    const insertBefore = container.querySelector('[data-special-instructions], .cart__note, .special-instructions, [data-cart-note], .cart__discount, .discount-input, [data-discount], .cart__footer, .cart-footer');
    if (insertBefore) {
      return { element: insertBefore, position: 'beforebegin' };
    }
    
    return { element: container, position: 'afterbegin' };
  }

  // Bind event listeners
  function bindEvents() {
    const header = document.getElementById('loyalty-header');
    const connectBtn = document.getElementById('loyalty-connect-btn');
    const phoneInput = document.getElementById('loyalty-phone');

    if (header) {
      header.addEventListener('click', toggleLoyaltyWidget);
    }

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

  // Toggle widget visibility
  function toggleLoyaltyWidget() {
    const content = document.getElementById('loyalty-content');
    const toggle = document.getElementById('loyalty-toggle');
    
    if (content && toggle) {
      const isVisible = content.style.display !== 'none';
      content.style.display = isVisible ? 'none' : 'block';
      toggle.textContent = isVisible ? '+' : '−';
    }
  }

  // Load customer data from Shopify
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
      connectBtn.textContent = 'Connect';
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
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLoyaltyWidget);
  } else {
    initLoyaltyWidget();
  }

  // Also try to initialize on common Shopify cart events
  document.addEventListener('shopify:section:load', initLoyaltyWidget);
  document.addEventListener('cart:updated', initLoyaltyWidget);
  
  // Fallback: retry initialization periodically for dynamic carts
  let retryCount = 0;
  const retryInit = setInterval(() => {
    if (!isWidgetLoaded && retryCount < 10) {
      initLoyaltyWidget();
      retryCount++;
    } else {
      clearInterval(retryInit);
    }
  }, 1000);

})();