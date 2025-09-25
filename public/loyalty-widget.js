// Shopify Loyalty Widget - Cart Drawer Integration
// This file is hosted and injected into Shopify stores via theme.liquid

(function() {
  'use strict';

  // Configuration - Update this domain to match your deployment
  const API_BASE_URL = 'https://oxsxkwrsbpcmwghfmooz.supabase.co';
  
  // Widget state
  let isWidgetLoaded = false;
  let currentCustomerData = null;
  let loyaltyData = null;

  // Constants for injection strategy
  const SLOT_ID = 'cart-loyalty-slot';
  const DIVIDER_CLASS = 'cart-actions__divider';

  // Widget CSS - works for both cart drawer and cart page, inherits Shopify fonts
  const WIDGET_CSS = `
    /* Cart Loyalty slot — scoped to both cart drawer and cart page */
    .cart-drawer__summary .cart-actions .cart-loyalty,
    .cart .cart-loyalty,
    .cart-form .cart-loyalty,
    .cart__content .cart-loyalty {
      display: block;
      width: 100%;
      margin: 0;
      padding: 0;
    }

    .cart-drawer__summary .cart-actions .cart-loyalty__mount *,
    .cart .cart-loyalty__mount *,
    .cart-form .cart-loyalty__mount *,
    .cart__content .cart-loyalty__mount * {
      max-width: 100%;
      box-sizing: border-box;
    }

    /* Widget styling within cart contexts */
    .cart-drawer__summary .cart-actions .cart-loyalty #loyalty-widget,
    .cart .cart-loyalty #loyalty-widget,
    .cart-form .cart-loyalty #loyalty-widget,
    .cart__content .cart-loyalty #loyalty-widget { 
      display: block; 
      width: 100%; 
      margin: 0;
      padding: 0;
      font-family: inherit;
      font-size: inherit;
      line-height: inherit;
      position: relative;
      z-index: 1;
      flex-shrink: 0;
      text-transform: uppercase;
      font-family: var(--font-body-family, inherit);
    }

    .cart-drawer__summary .cart-actions .cart-loyalty #loyalty-widget *,
    .cart .cart-loyalty #loyalty-widget *,
    .cart-form .cart-loyalty #loyalty-widget *,
    .cart__content .cart-loyalty #loyalty-widget * { 
      box-sizing: border-box; 
      font-family: var(--font-body-family, var(--font-stack-body, var(--font-family-primary, inherit)));
    }

    .cart-drawer__summary .cart-actions .cart-loyalty #loyalty-header,
    .cart .cart-loyalty #loyalty-header,
    .cart-form .cart-loyalty #loyalty-header,
    .cart__content .cart-loyalty #loyalty-header { 
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding: 8px 0 6px 0;
    }

    .cart-drawer__summary .cart-actions .cart-loyalty #loyalty-widget button:hover,
    .cart .cart-loyalty #loyalty-widget button:hover,
    .cart-form .cart-loyalty #loyalty-widget button:hover,
    .cart__content .cart-loyalty #loyalty-widget button:hover { 
      background-color: rgba(255, 255, 255, 0.8) !important; 
    }

    .cart-drawer__summary .cart-actions .cart-loyalty #loyalty-widget input:focus,
    .cart .cart-loyalty #loyalty-widget input:focus,
    .cart-form .cart-loyalty #loyalty-widget input:focus,
    .cart__content .cart-loyalty #loyalty-widget input:focus {
      outline: none;
      background: rgba(255, 255, 255, 1);
    }

    .cart-drawer__summary .cart-actions .cart-loyalty #loyalty-widget input::placeholder,
    .cart .cart-loyalty #loyalty-widget input::placeholder,
    .cart-form .cart-loyalty #loyalty-widget input::placeholder,
    .cart__content .cart-loyalty #loyalty-widget input::placeholder {
      color: rgba(0, 0, 0, 0.5);
      text-transform: none;
    }

    .cart-drawer__summary .cart-actions .cart-loyalty #loyalty-widget .reward-item,
    .cart .cart-loyalty #loyalty-widget .reward-item,
    .cart-form .cart-loyalty #loyalty-widget .reward-item,
    .cart__content .cart-loyalty #loyalty-widget .reward-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 12px;
      margin: 4px 0;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      transition: border-color 0.2s;
      min-height: auto;
    }

    .cart-drawer__summary .cart-actions .cart-loyalty #loyalty-widget .reward-item:hover,
    .cart .cart-loyalty #loyalty-widget .reward-item:hover,
    .cart-form .cart-loyalty #loyalty-widget .reward-item:hover,
    .cart__content .cart-loyalty #loyalty-widget .reward-item:hover { 
      border-color: rgba(255, 255, 255, 0.3); 
    }

    .cart-drawer__summary .cart-actions .cart-loyalty #loyalty-widget .reward-item button,
    .cart .cart-loyalty #loyalty-widget .reward-item button,
    .cart-form .cart-loyalty #loyalty-widget .reward-item button,
    .cart__content .cart-loyalty #loyalty-widget .reward-item button {
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
      text-transform: uppercase;
    }

    .cart-drawer__summary .cart-actions .cart-loyalty #loyalty-widget .reward-item button:hover,
    .cart .cart-loyalty #loyalty-widget .reward-item button:hover,
    .cart-form .cart-loyalty #loyalty-widget .reward-item button:hover,
    .cart__content .cart-loyalty #loyalty-widget .reward-item button:hover { 
      background: #047857 !important; 
    }

    .cart-drawer__summary .cart-actions .cart-loyalty #loyalty-widget .reward-item button:disabled,
    .cart .cart-loyalty #loyalty-widget .reward-item button:disabled,
    .cart-form .cart-loyalty #loyalty-widget .reward-item button:disabled,
    .cart__content .cart-loyalty #loyalty-widget .reward-item button:disabled { 
      background: #9ca3af; 
      cursor: not-allowed; 
    }

     .cart-drawer__summary .cart-actions .cart-loyalty #loyalty-widget .reward-info,
     .cart .cart-loyalty #loyalty-widget .reward-info,
     .cart-form .cart-loyalty #loyalty-widget .reward-info,
     .cart__content .cart-loyalty #loyalty-widget .reward-info { 
       display: flex; 
       justify-content: space-between;
       align-items: baseline;
       flex: 1; 
       min-width: 0; 
       margin-right: 12px;
     }

     .cart-drawer__summary .cart-actions .cart-loyalty #loyalty-widget .reward-name,
     .cart .cart-loyalty #loyalty-widget .reward-name,
     .cart-form .cart-loyalty #loyalty-widget .reward-name,
     .cart__content .cart-loyalty #loyalty-widget .reward-name { 
       font-weight: 500; 
       color: white; 
       font-size: 13px; 
       margin: 0; 
       line-height: 1.2;
       flex: 1;
       text-transform: uppercase;
     }

     .cart-drawer__summary .cart-actions .cart-loyalty #loyalty-widget .reward-points,
     .cart .cart-loyalty #loyalty-widget .reward-points,
     .cart-form .cart-loyalty #loyalty-widget .reward-points,
     .cart__content .cart-loyalty #loyalty-widget .reward-points { 
       color: rgba(255, 255, 255, 0.6); 
       font-size: 11px; 
       margin: 0; 
       line-height: 1.2;
       white-space: nowrap;
       margin-left: 8px;
       text-transform: uppercase;
     }

    /* Spinning animation */
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;

  // Widget HTML template
  const WIDGET_HTML = `
    <div id="loyalty-widget" style="margin: 0; padding: 0; border: none; background: none;">
      <div id="loyalty-header" style="padding: 8px 0 6px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
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
      <div id="loyalty-content" style="padding: 8px 0 0 0;">
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
        <div id="loyalty-signup" style="display: none;">
          <p style="margin: 0 0 8px 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">Create a loyalty account to start earning rewards</p>
          <div style="margin-bottom: 8px;">
            <input type="email" id="loyalty-email" placeholder="Email address" style="width: 100%; padding: 12px 16px; border: none; border-radius: 15px; font-size: 14px; background: rgba(255, 255, 255, 0.9); color: #333; outline: none; margin-bottom: 8px;">
            <input type="tel" id="loyalty-signup-phone" placeholder="Phone number" style="width: 100%; padding: 12px 16px; border: none; border-radius: 15px; font-size: 14px; background: rgba(255, 255, 255, 0.9); color: #333; outline: none;">
          </div>
          <div style="display: flex; gap: 8px; margin-bottom: 8px;">
            <button id="loyalty-signup-btn" style="flex: 1; padding: 12px 20px; background: #059669; color: white; border: none; border-radius: 15px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background-color 0.2s;">Create Account</button>
            <button id="loyalty-back-btn" style="padding: 12px 20px; background: rgba(255, 255, 255, 0.2); color: white; border: none; border-radius: 15px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background-color 0.2s;">Back</button>
          </div>
          <div id="loyalty-signup-error" style="display: none; color: #fca5a5; font-size: 13px; margin-top: 4px;"></div>
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
    section.style.cssText = 'margin: 20px 0; max-width: 100%;';

    const mount = document.createElement('div');
    mount.className = 'cart-loyalty__mount';
    mount.id = 'cart-loyalty-mount';
    mount.style.cssText = 'padding: 16px 18px; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 12px; width: 100%; max-width: 720px;';
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

  // Insert loyalty slot into cart (both drawer and page)
function insertSlot() {
    // Prevent duplicate injection across strategies
    if (document.getElementById(SLOT_ID)) return;
    // Strategy 1: Cart drawer
    const cartDrawerActions = document.querySelector('.cart-drawer__summary .cart-actions');
    if (cartDrawerActions) {
      // Enhanced selectors for special instructions/cart note
      const noteSelectors = [
        '.cart-note', 'cart-note', '[data-cart-note]', 'textarea[name="note"]',
        '#CartSpecialInstructions', '.cart__note', '.cart__note-container', 
        '.cart__note-wrapper', '.order-special-instructions', '[id*="CartNote"]', 
        '[id*="SpecialInstructions"]', '.cart-drawer__note', '[data-testid="cart-note"]',
        'input[name="note"]', '.field[data-cart-note]', '.cart__attribute[data-cart-note]'
      ];
      
      let specialInstructions = null;
      for (const selector of noteSelectors) {
        const element = cartDrawerActions.querySelector(selector);
        if (element) {
          specialInstructions = element;
          break;
        }
      }
      
      if (specialInstructions && !cartDrawerActions.querySelector('#' + SLOT_ID)) {
        // Find the container/wrapper around the special instructions
        const noteContainer = specialInstructions.closest('.cart__block, .cart__row, .cart-drawer__note, .cart-note, .cart__note, .field, .cart__blocks > *') || specialInstructions;
        
        const loyalty = createLoyaltySection();
        noteContainer.parentNode.insertBefore(loyalty, noteContainer);
        noteContainer.parentNode.insertBefore(createDivider(), noteContainer);
        
        bindEvents();
        loadCustomerData();
        isWidgetLoaded = true;
        console.log('Loyalty widget injected into cart drawer above special instructions');
        return;
      }
      
      // Fallback: if no special instructions found, insert before first child
      if (!cartDrawerActions.querySelector('#' + SLOT_ID) && cartDrawerActions.firstElementChild) {
        const loyalty = createLoyaltySection();
        cartDrawerActions.insertBefore(loyalty, cartDrawerActions.firstElementChild);
        cartDrawerActions.insertBefore(createDivider(), cartDrawerActions.firstElementChild.nextElementSibling);
        
        bindEvents();
        loadCustomerData();
        isWidgetLoaded = true;
        console.log('Loyalty widget injected into cart drawer at top');
        return;
      }
    }

    // Strategy 2: Cart page - inject at TOP of the cart-actions section
    const cartActions = document.querySelector('.cart-actions');

    if (cartActions && !document.getElementById(SLOT_ID)) {
      const loyalty = createLoyaltySection();
      // Style to match the action elements
      loyalty.style.cssText = 'margin: 0 0 12px 0; padding: 0; background: transparent; border: none;';
      const mountEl = loyalty.querySelector('#cart-loyalty-mount');
      if (mountEl) {
        // Enhanced contrast for better visibility
        mountEl.style.cssText = 'padding: 16px 18px; background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 12px; width: 100%;';
      }

      // Insert at the very top of cart-actions (before Special instructions)
      cartActions.insertBefore(loyalty, cartActions.firstElementChild);
      
      // Add a divider after our widget to match the existing pattern
      const divider = document.createElement('div');
      divider.className = 'cart-actions__divider';
      cartActions.insertBefore(divider, loyalty.nextElementSibling);

      bindEvents();
      loadCustomerData();
      isWidgetLoaded = true;
      console.log('Loyalty widget injected at top of cart-actions');
      return;
    }

    // Fallback: place at top of summary container if cart-actions not found
    const summaryContainer = document.querySelector(
      '.cart-page__summary, .cart__summary, .cart__aside, .cart-right, .cart__right, .cart-summary, [data-cart-summary]'
    );

    if (summaryContainer && !document.getElementById(SLOT_ID)) {
      const loyalty = createLoyaltySection();
      loyalty.style.cssText = 'margin: 0 0 16px 0; padding: 0; background: transparent; border: none;';
      summaryContainer.insertBefore(loyalty, summaryContainer.firstChild);

      bindEvents();
      loadCustomerData();
      isWidgetLoaded = true;
      console.log('Loyalty widget injected at top of cart summary container (fallback)');
      return;
    }

    // Strategy 3: Cart page - various possible selectors
    const cartPageSelectors = [
      '.cart .cart__content',
      '.cart-form',
      '.cart',
      '.page-cart .cart',
      '[data-cart-contents]'
    ];

    for (const selector of cartPageSelectors) {
      const cartContainer = document.querySelector(selector);
      if (cartContainer && !cartContainer.querySelector('#' + SLOT_ID)) {
        // Try to find a good insertion point on cart page
        const insertionPoints = [
          cartContainer.querySelector('.cart__note, .cart-note, [data-cart-note]'),
          cartContainer.querySelector('.cart-discount, .discount-form, [data-discount-form]'),
          cartContainer.querySelector('.cart__footer, .cart-footer'),
          cartContainer.querySelector('.cart__buttons, .cart-buttons'),
          cartContainer.querySelector('.cart__totals, .cart-totals')
        ];

        const insertionPoint = insertionPoints.find(el => el !== null);
        
        if (insertionPoint) {
          const loyalty = createLoyaltySection();
          insertionPoint.parentNode.insertBefore(loyalty, insertionPoint);
          
          bindEvents();
          loadCustomerData();
          isWidgetLoaded = true;
          console.log(`Loyalty widget injected into cart page using selector: ${selector}`);
          return;
        } else {
          // Fallback: append to cart container
          const loyalty = createLoyaltySection();
          cartContainer.appendChild(loyalty);
          
          bindEvents();
          loadCustomerData();
          isWidgetLoaded = true;
          console.log(`Loyalty widget appended to cart page: ${selector}`);
          return;
        }
      }
    }
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
      const response = await fetch(`${API_BASE_URL}/functions/v1/loyalty-account`, {
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
    connectBtn.textContent = 'Searching...';
    hideError();

    try {
      const response = await fetch(`${API_BASE_URL}/functions/v1/loyalty-lookup`, {
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
        // No account found, offer to create one
        showLoyaltySignup();
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
    const errorDiv = document.getElementById('loyalty-signup-error');
    
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
      const response = await fetch(`${API_BASE_URL}/functions/v1/loyalty-create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          phone: phone
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
  async function redeemReward(rewardId, rewardName) {
    if (!loyaltyData?.loyalty_account) return;

    const button = document.querySelector(`[data-reward-id="${rewardId}"]`);
    if (button) {
      button.disabled = true;
      button.textContent = 'Redeeming...';
    }

    try {
      const response = await fetch(`${API_BASE_URL}/functions/v1/loyalty-redeem`, {
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

  function showLoyaltySignup() {
    hideAll();
    const signupDiv = document.getElementById('loyalty-signup');
    if (signupDiv) signupDiv.style.display = 'block';
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
      rewardsList.innerHTML = '<p style="margin: 0; color: #7f8c8d; font-style: italic;">No rewards available at your current points level.</p>';
      return;
    }

     rewardsList.innerHTML = loyaltyData.available_rewards.map(reward => `
       <div class="reward-item">
         <div class="reward-info">
           <div class="reward-name">${reward.name}</div>
           <div class="reward-points">${reward.points_required} points</div>
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

  // Expose redeem function globally for button clicks
  window.redeemLoyaltyReward = redeemReward;

  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', initLoyaltyWidget);

  // MutationObserver for re-render resilience
  const observer = new MutationObserver(insertSlot);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Listen for cart events (both drawer and page)
  window.addEventListener('cart:open', insertSlot);
  document.addEventListener('cart:updated', insertSlot);
  document.addEventListener('cart:ready', insertSlot);
  document.addEventListener('cart:refresh', insertSlot);
  document.addEventListener('page:loaded', insertSlot);
  window.addEventListener('load', insertSlot);

})();