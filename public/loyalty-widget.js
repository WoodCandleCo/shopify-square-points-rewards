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

  // Widget HTML template
  const WIDGET_HTML = `
    <div id="loyalty-widget" style="margin: 20px 0; padding: 15px; border: 1px solid #e1e5e9; border-radius: 8px; background: #f8f9fa;">
      <div id="loyalty-header" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
        <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #2c3e50;">🎯 Loyalty Rewards</h3>
        <span id="loyalty-toggle" style="font-size: 14px; color: #7f8c8d;">+</span>
      </div>
      <div id="loyalty-content" style="display: none; margin-top: 15px;">
        <div id="loyalty-loading" style="text-align: center; padding: 20px;">
          <div style="display: inline-block; width: 20px; height: 20px; border: 3px solid #f3f3f3; border-top: 3px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite;"></div>
          <p style="margin: 10px 0 0 0; color: #7f8c8d;">Loading your rewards...</p>
        </div>
        <div id="loyalty-login" style="display: none;">
          <p style="margin: 0 0 10px 0; color: #34495e;">Connect your phone number to access loyalty rewards:</p>
          <div style="display: flex; gap: 10px; margin-bottom: 10px;">
            <input type="tel" id="loyalty-phone" placeholder="Enter phone number" style="flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px;">
            <button id="loyalty-connect-btn" style="padding: 8px 16px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">Connect</button>
          </div>
          <div id="loyalty-error" style="display: none; color: #e74c3c; font-size: 14px; margin-top: 10px;"></div>
        </div>
        <div id="loyalty-account" style="display: none;">
          <div style="margin-bottom: 15px; padding: 10px; background: #ecf0f1; border-radius: 4px;">
            <p style="margin: 0; font-weight: 600; color: #2c3e50;">Points Balance: <span id="loyalty-balance">0</span></p>
          </div>
          <div id="loyalty-rewards">
            <p style="margin: 0 0 10px 0; font-weight: 600; color: #2c3e50;">Available Rewards:</p>
            <div id="loyalty-rewards-list"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  // CSS animations
  const WIDGET_CSS = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    #loyalty-widget button:hover {
      opacity: 0.9;
    }
    #loyalty-widget .reward-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px;
      margin: 5px 0;
      background: white;
      border: 1px solid #e1e5e9;
      border-radius: 4px;
    }
    #loyalty-widget .reward-item button {
      padding: 6px 12px;
      background: #27ae60;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }
    #loyalty-widget .reward-item button:disabled {
      background: #95a5a6;
      cursor: not-allowed;
    }
  `;

  // Initialize widget
  function initLoyaltyWidget() {
    if (isWidgetLoaded) return;
    
    // Add CSS
    const style = document.createElement('style');
    style.textContent = WIDGET_CSS;
    document.head.appendChild(style);

    // Find cart container and inject widget
    const cartContainer = findCartContainer();
    if (cartContainer) {
      cartContainer.insertAdjacentHTML('afterbegin', WIDGET_HTML);
      bindEvents();
      loadCustomerData();
      isWidgetLoaded = true;
    }
  }

  // Find appropriate cart container
  function findCartContainer() {
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
        <div>
          <strong>${reward.name}</strong><br>
          <small style="color: #7f8c8d;">${reward.points_required} points</small>
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