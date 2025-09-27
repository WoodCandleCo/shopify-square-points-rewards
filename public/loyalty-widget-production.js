/**
 * Production Square Loyalty Widget for Shopify Basic Plan
 * Optimized for cart drawer and cart page integration
 */

(function() {
  'use strict';

  // Configuration
  const API_BASE_URL = 'https://oxsxkwrsbpcmwghfmooz.supabase.co/functions/v1';
  const WIDGET_ID = 'square-loyalty-widget';
  
  // Widget state
  let isWidgetLoaded = false;
  let currentCustomerData = null;
  let loyaltyData = null;
  let isProcessingRedemption = false;

  // Utility function to normalize phone to E.164 format
  function normalizePhoneToE164(phone) {
    if (!phone) return null;
    
    const digits = phone.replace(/\D/g, '');
    
    if (digits.length === 11 && digits.startsWith('1')) {
      return '+' + digits;
    }
    
    if (digits.length === 10) {
      return '+1' + digits;
    }
    
    if (phone.startsWith('+')) {
      return phone;
    }
    
    return '+' + digits;
  }

  // Enhanced CSS for better Shopify integration
  const WIDGET_CSS = `
    .square-loyalty-widget {
      font-family: var(--font-body-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 12px;
      padding: 16px 18px;
      margin: 16px 0;
      color: white;
      width: 100%;
      box-sizing: border-box;
    }

    .loyalty-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 700;
      font-size: 14px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: white;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .loyalty-content {
      padding-top: 8px;
    }

    .loyalty-loading {
      text-align: center;
      padding: 16px 0;
      color: rgba(255, 255, 255, 0.7);
    }

    .loyalty-loading .spinner {
      display: inline-block;
      width: 20px;
      height: 20px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top: 2px solid white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 8px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .loyalty-form {
      margin-bottom: 12px;
    }

    .loyalty-form p {
      margin: 0 0 8px 0;
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
    }

    .loyalty-input-group {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
    }

    .loyalty-input {
      flex: 1;
      padding: 12px 16px;
      border: none;
      border-radius: 15px;
      font-size: 14px;
      background: rgba(255, 255, 255, 0.9);
      color: #333;
      outline: none;
      text-transform: none;
    }

    .loyalty-input::placeholder {
      color: rgba(0, 0, 0, 0.5);
      text-transform: none;
    }

    .loyalty-button {
      padding: 12px 20px;
      background: rgba(255, 255, 255, 0.9);
      color: #333;
      border: none;
      border-radius: 15px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: background-color 0.2s;
      white-space: nowrap;
      min-width: 90px;
      text-transform: uppercase;
    }

    .loyalty-button:hover {
      background: rgba(255, 255, 255, 0.8);
    }

    .loyalty-button:disabled {
      background: rgba(255, 255, 255, 0.5);
      cursor: not-allowed;
    }

    .loyalty-button.primary {
      background: #059669;
      color: white;
    }

    .loyalty-button.primary:hover {
      background: #047857;
    }

    .loyalty-button.secondary {
      background: rgba(255, 255, 255, 0.2);
      color: white;
    }

    .loyalty-error {
      color: #fca5a5;
      font-size: 13px;
      margin-top: 4px;
      display: none;
    }

    .loyalty-account {
      display: none;
    }

    .loyalty-balance {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 12px;
      padding: 10px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .loyalty-balance-item {
      text-align: center;
    }

    .loyalty-balance-label {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.7);
      text-transform: uppercase;
      margin-bottom: 2px;
    }

    .loyalty-balance-value {
      font-size: 16px;
      font-weight: 700;
      color: #10b981;
    }

    .loyalty-section {
      margin-bottom: 16px;
    }

    .loyalty-section-title {
      font-size: 14px;
      font-weight: 500;
      color: white;
      margin-bottom: 8px;
      text-transform: uppercase;
    }

    .loyalty-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 12px;
      margin: 4px 0;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      transition: border-color 0.2s;
    }

    .loyalty-item:hover {
      border-color: rgba(255, 255, 255, 0.3);
    }

    .loyalty-item-info {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      flex: 1;
      min-width: 0;
      margin-right: 12px;
    }

    .loyalty-item-name {
      font-weight: 500;
      color: white;
      font-size: 13px;
      margin: 0;
      line-height: 1.2;
      flex: 1;
      text-transform: uppercase;
    }

    .loyalty-item-points {
      color: rgba(255, 255, 255, 0.6);
      font-size: 11px;
      margin: 0;
      line-height: 1.2;
      white-space: nowrap;
      margin-left: 8px;
      text-transform: uppercase;
    }

    .loyalty-item-button {
      padding: 8px 14px;
      background: #FFC857;
      color: #333;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: background-color 0.2s;
      white-space: nowrap;
      margin-left: 12px;
      text-transform: uppercase;
    }

    .loyalty-item-button:hover {
      background: #E6B649;
    }

    .loyalty-item-button:disabled {
      background: #9ca3af;
      cursor: not-allowed;
    }

    .loyalty-item-button.promotion {
      background: #ff6b6b;
      color: white;
    }

    .loyalty-item-button.promotion:hover {
      background: #ff5252;
    }

    .loyalty-item-button.birthday {
      background: #ff69b4;
      color: white;
    }

    .loyalty-item-button.birthday:hover {
      background: #ff1493;
    }

    .loyalty-no-items {
      text-align: center;
      color: rgba(255, 255, 255, 0.6);
      font-size: 13px;
      padding: 12px;
      font-style: italic;
    }

    .loyalty-signup {
      display: none;
    }

    .loyalty-signup p {
      margin: 0 0 8px 0;
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
    }

    .loyalty-signup-form {
      margin-bottom: 8px;
    }

    .loyalty-signup-form input {
      width: 100%;
      padding: 12px 16px;
      border: none;
      border-radius: 15px;
      font-size: 14px;
      background: rgba(255, 255, 255, 0.9);
      color: #333;
      outline: none;
      margin-bottom: 8px;
      text-transform: none;
    }

    .loyalty-signup-buttons {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
    }
  `;

  // Widget HTML template
  const WIDGET_HTML = `
    <div class="square-loyalty-widget">
      <div class="loyalty-header">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20,12 20,22 4,22 4,12"></polyline>
          <rect width="20" height="5" x="2" y="7"></rect>
          <line x1="12" x2="12" y1="22" y2="7"></line>
          <path d="m12 7 3-3H9l3 3z"></path>
        </svg>
        Loyalty Rewards
      </div>
      <div class="loyalty-content">
        <div class="loyalty-loading" id="loyalty-loading">
          <div class="spinner"></div>
          <p>Loading your rewards...</p>
        </div>
        <div class="loyalty-form" id="loyalty-login" style="display: none;">
          <p>Enter phone to access rewards</p>
          <div class="loyalty-input-group">
            <input type="tel" id="loyalty-phone" class="loyalty-input" placeholder="Phone number">
            <button id="loyalty-connect-btn" class="loyalty-button">Search</button>
          </div>
          <div class="loyalty-error" id="loyalty-error"></div>
        </div>
        <div class="loyalty-signup" id="loyalty-signup">
          <p>Create a loyalty account to start earning rewards</p>
          <div class="loyalty-signup-form">
            <input type="email" id="loyalty-email" placeholder="Email address">
            <input type="tel" id="loyalty-signup-phone" placeholder="Phone number">
          </div>
          <div class="loyalty-signup-buttons">
            <button id="loyalty-signup-btn" class="loyalty-button primary">Create Account</button>
            <button id="loyalty-back-btn" class="loyalty-button secondary">Back</button>
          </div>
          <div class="loyalty-error" id="loyalty-signup-error"></div>
        </div>
        <div class="loyalty-account" id="loyalty-account">
          <div class="loyalty-balance">
            <div class="loyalty-balance-item">
              <div class="loyalty-balance-label">Balance</div>
              <div class="loyalty-balance-value" id="loyalty-balance">0</div>
            </div>
            <div class="loyalty-balance-item">
              <div class="loyalty-balance-label">Lifetime</div>
              <div class="loyalty-balance-value" id="loyalty-lifetime">0</div>
            </div>
          </div>
          <div class="loyalty-section" id="promotions-section" style="display: none;">
            <div class="loyalty-section-title">🎉 Special Promotions</div>
            <div id="loyalty-promotions-list"></div>
          </div>
          <div class="loyalty-section">
            <div class="loyalty-section-title">🏆 Available Rewards</div>
            <div id="loyalty-rewards-list"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Initialize widget
  function initLoyaltyWidget() {
    if (isWidgetLoaded) return;
    
    // Add CSS
    const style = document.createElement('style');
    style.textContent = WIDGET_CSS;
    document.head.appendChild(style);

    // Find and inject widget
    insertWidget();
  }

  // Find cart container and inject widget
  function insertWidget() {
    if (document.getElementById(WIDGET_ID)) return;

    const containerSelectors = [
      '.cart-drawer__summary .cart-actions',
      '.cart-actions',
      '.cart__summary',
      '.cart__footer',
      '.cart-footer',
      '.cart__content',
      '.cart-form',
      '.cart'
    ];

    let container = null;
    for (const selector of containerSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        container = element;
        console.log(`Found cart container: ${selector}`);
        break;
      }
    }

    if (!container) {
      console.log('No suitable cart container found');
      return;
    }

    // Create widget element
    const widget = document.createElement('div');
    widget.id = WIDGET_ID;
    widget.innerHTML = WIDGET_HTML;

    // Insert widget at appropriate position
    const insertionPoints = [
      container.querySelector('.cart-note, .cart__note, [data-cart-note]'),
      container.querySelector('.cart-discount, .discount-form'),
      container.querySelector('.cart__footer, .cart-footer'),
      container.querySelector('.cart__buttons, .cart-buttons')
    ];

    const insertionPoint = insertionPoints.find(el => el !== null);
    
    if (insertionPoint) {
      insertionPoint.parentNode.insertBefore(widget, insertionPoint);
    } else {
      // Fallback: insert at beginning of container
      container.insertBefore(widget, container.firstChild);
    }

    // Bind events and load data
    bindEvents();
    loadCustomerData();
    isWidgetLoaded = true;
    
    console.log('Square loyalty widget loaded successfully');
  }

  // Bind event listeners
  function bindEvents() {
    const connectBtn = document.getElementById('loyalty-connect-btn');
    const phoneInput = document.getElementById('loyalty-phone');
    const signupBtn = document.getElementById('loyalty-signup-btn');
    const backBtn = document.getElementById('loyalty-back-btn');
    const emailInput = document.getElementById('loyalty-email');
    const signupPhoneInput = document.getElementById('loyalty-signup-phone');

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

    if (signupBtn) {
      signupBtn.addEventListener('click', createLoyaltyAccount);
    }

    if (backBtn) {
      backBtn.addEventListener('click', showLoyaltyLogin);
    }

    if (emailInput) {
      emailInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          createLoyaltyAccount();
        }
      });
    }

    if (signupPhoneInput) {
      signupPhoneInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          createLoyaltyAccount();
        }
      });
    }
  }

  // Load customer data from Shopify
  function loadCustomerData() {
    if (window.Shopify && window.Shopify.customer) {
      currentCustomerData = window.Shopify.customer;
      checkExistingLoyaltyAccount();
    } else {
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
      const response = await fetch(`${API_BASE_URL}/loyalty-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94c3hrd3JzYnBjbXdnaGZtb296Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxNjE2MzksImV4cCI6MjA3MzczNzYzOX0.re0nwcRGwcvwl8F3Eu1C1g-P3QEwOtNFpK6MGrlL7ek'
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
    connectBtn.textContent = 'Searching...';
    hideError();

    try {
      const response = await fetch(`${API_BASE_URL}/loyalty-lookup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94c3hrd3JzYnBjbXdnaGZtb296Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxNjE2MzksImV4cCI6MjA3MzczNzYzOX0.re0nwcRGwcvwl8F3Eu1C1g-P3QEwOtNFpK6MGrlL7ek'
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
      } else if (data.enrollment_available) {
        // Pre-fill signup form with the phone number
        const signupPhoneInput = document.getElementById('loyalty-signup-phone');
        if (signupPhoneInput) {
          signupPhoneInput.value = phone;
        }
        showLoyaltySignup();
      } else {
        showError('No loyalty account found for this phone number');
      }
    } catch (error) {
      console.error('Error connecting loyalty account:', error);
      showError('Failed to connect loyalty account');
    } finally {
      connectBtn.disabled = false;
      connectBtn.textContent = 'Search';
    }
  }

  // Create loyalty account
  async function createLoyaltyAccount() {
    const emailInput = document.getElementById('loyalty-email');
    const phoneInput = document.getElementById('loyalty-signup-phone');
    const signupBtn = document.getElementById('loyalty-signup-btn');
    
    if (!emailInput || !phoneInput || !signupBtn) return;

    const email = emailInput.value.trim();
    const phone = phoneInput.value.trim();
    
    if (!email || !phone) {
      showSignupError('Please enter both email and phone number');
      return;
    }

    signupBtn.disabled = true;
    signupBtn.textContent = 'Creating...';
    hideSignupError();

    try {
      const response = await fetch(`${API_BASE_URL}/loyalty-create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94c3hrd3JzYnBjbXdnaGZtb296Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxNjE2MzksImV4cCI6MjA3MzczNzYzOX0.re0nwcRGwcvwl8F3Eu1C1g-P3QEwOtNFpK6MGrlL7ek'
        },
        body: JSON.stringify({
          email: email,
          phone: phone,
          first_name: currentCustomerData?.first_name,
          last_name: currentCustomerData?.last_name
        })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        loyaltyData = data;
        showLoyaltyAccount();
      } else {
        showSignupError(data.error || 'Failed to create loyalty account');
      }
    } catch (error) {
      console.error('Error creating loyalty account:', error);
      showSignupError('Failed to create loyalty account');
    } finally {
      signupBtn.disabled = false;
      signupBtn.textContent = 'Create Account';
    }
  }

  // Redeem reward
  async function redeemReward(rewardId, rewardName, isPromotion = false) {
    if (!loyaltyData?.loyalty_account || isProcessingRedemption) return;

    isProcessingRedemption = true;
    const button = document.querySelector(`[data-reward-id="${rewardId}"]`);
    if (button) {
      button.disabled = true;
      button.textContent = 'Redeeming...';
    }

    try {
      const endpoint = isPromotion ? 'loyalty-promotion-redeem' : 'loyalty-redeem';
      const payload = isPromotion ? {
        loyaltyAccountId: loyaltyData.loyalty_account.square_loyalty_account_id,
        promotionId: rewardId,
        customerId: loyaltyData.square_customer_id
      } : {
        loyalty_account_id: loyaltyData.loyalty_account.square_loyalty_account_id,
        reward_id: rewardId
      };

      const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94c3hrd3JzYnBjbXdnaGZtb296Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxNjE2MzksImV4cCI6MjA3MzczNzYzOX0.re0nwcRGwcvwl8F3Eu1C1g-P3QEwOtNFpK6MGrlL7ek'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      
      if (response.ok && data.discount_code) {
        // Apply discount code to cart
        await applyDiscountCode(data.discount_code);
        
        // Show success message
        alert(`${rewardName} redeemed! Discount code ${data.discount_code} has been applied to your cart.`);
        
        // Refresh the widget to show updated balance
        setTimeout(() => {
          loadCustomerData();
        }, 1000);
      } else {
        throw new Error(data.error || 'Failed to redeem reward');
      }
    } catch (error) {
      console.error('Error redeeming reward:', error);
      alert(`Failed to redeem ${rewardName}. Please try again.`);
    } finally {
      isProcessingRedemption = false;
      if (button) {
        button.disabled = false;
        button.textContent = 'Redeem';
      }
    }
  }

  // Apply discount code to Shopify cart
  async function applyDiscountCode(code) {
    try {
      // Method 1: Try Shopify's discount URL (works on all plans)
      const discountUrl = `/discount/${encodeURIComponent(code)}?return_to=${encodeURIComponent(window.location.pathname)}`;
      window.location.href = discountUrl;
    } catch (error) {
      console.error('Error applying discount code:', error);
      // Fallback: show the code to the user
      prompt('Use this discount code at checkout:', code);
    }
  }

  // UI helper functions
  function showLoyaltyLogin() {
    hideAll();
    const loginDiv = document.getElementById('loyalty-login');
    if (loginDiv) loginDiv.style.display = 'block';
  }

  function showLoyaltySignup() {
    hideAll();
    const signupDiv = document.getElementById('loyalty-signup');
    if (signupDiv) signupDiv.style.display = 'block';
  }

  function showLoyaltyAccount() {
    hideAll();
    const accountDiv = document.getElementById('loyalty-account');
    const balanceSpan = document.getElementById('loyalty-balance');
    const lifetimeSpan = document.getElementById('loyalty-lifetime');
    
    if (accountDiv && loyaltyData?.loyalty_account) {
      accountDiv.style.display = 'block';
      
      if (balanceSpan) {
        balanceSpan.textContent = loyaltyData.loyalty_account.balance || 0;
      }
      
      if (lifetimeSpan) {
        lifetimeSpan.textContent = loyaltyData.loyalty_account.points_earned_lifetime || 0;
      }
      
      refreshRewardsList();
      refreshPromotionsList();
    }
  }

  function showLoading() {
    hideAll();
    const loadingDiv = document.getElementById('loyalty-loading');
    if (loadingDiv) loadingDiv.style.display = 'block';
  }

  function hideAll() {
    const sections = ['loyalty-loading', 'loyalty-login', 'loyalty-signup', 'loyalty-account'];
    sections.forEach(id => {
      const element = document.getElementById(id);
      if (element) element.style.display = 'none';
    });
  }

  function refreshRewardsList() {
    const rewardsList = document.getElementById('loyalty-rewards-list');
    if (!rewardsList || !loyaltyData?.available_rewards) return;

    if (loyaltyData.available_rewards.length === 0) {
      rewardsList.innerHTML = '<div class="loyalty-no-items">No rewards available at your current points level</div>';
      return;
    }

    rewardsList.innerHTML = loyaltyData.available_rewards.map(reward => `
      <div class="loyalty-item">
        <div class="loyalty-item-info">
          <div class="loyalty-item-name">${reward.name}</div>
          <div class="loyalty-item-points">${reward.points_required} points</div>
        </div>
        <button 
          class="loyalty-item-button" 
          data-reward-id="${reward.id}" 
          onclick="window.redeemLoyaltyReward('${reward.id}', '${reward.name}', false)"
        >
          Redeem
        </button>
      </div>
    `).join('');
  }

  function refreshPromotionsList() {
    const promotionsSection = document.getElementById('promotions-section');
    const promotionsList = document.getElementById('loyalty-promotions-list');
    
    if (!promotionsSection || !promotionsList) return;

    const eligiblePromotions = loyaltyData?.available_promotions || [];
    
    if (eligiblePromotions.length === 0) {
      promotionsSection.style.display = 'none';
      return;
    }

    promotionsSection.style.display = 'block';
    promotionsList.innerHTML = eligiblePromotions.map(promo => {
      const buttonClass = promo.eligibility_reason === 'birthday_month' ? 'birthday' : 'promotion';
      const value = formatPromotionValue(promo);
      
      return `
        <div class="loyalty-item">
          <div class="loyalty-item-info">
            <div class="loyalty-item-name">${promo.name}</div>
            <div class="loyalty-item-points">${value}</div>
          </div>
          <button 
            class="loyalty-item-button ${buttonClass}" 
            data-reward-id="${promo.id}" 
            onclick="window.redeemLoyaltyReward('${promo.id}', '${promo.name}', true)"
          >
            Redeem
          </button>
        </div>
      `;
    }).join('');
  }

  function formatPromotionValue(promo) {
    if (promo.incentive_type === 'PERCENTAGE_DISCOUNT') {
      return `${promo.incentive_value}% OFF`;
    } else if (promo.incentive_type === 'FIXED_DISCOUNT') {
      const amount = promo.incentive_value?.amount || promo.incentive_value;
      return `$${(amount/100).toFixed(0)} OFF`;
    }
    return 'SPECIAL';
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

  function showSignupError(message) {
    const errorDiv = document.getElementById('loyalty-signup-error');
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
    }
  }

  function hideSignupError() {
    const errorDiv = document.getElementById('loyalty-signup-error');
    if (errorDiv) {
      errorDiv.style.display = 'none';
    }
  }

  // Expose redeem function globally
  window.redeemLoyaltyReward = redeemReward;

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLoyaltyWidget);
  } else {
    initLoyaltyWidget();
  }

  // Re-inject on cart updates
  const observer = new MutationObserver(() => {
    if (!document.getElementById(WIDGET_ID)) {
      setTimeout(insertWidget, 100);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Listen for cart events
  ['cart:updated', 'cart:refresh', 'cart:open', 'cart-drawer:open'].forEach(event => {
    document.addEventListener(event, () => {
      setTimeout(insertWidget, 100);
    });
  });

})();