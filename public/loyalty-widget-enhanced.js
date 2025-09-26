// Enhanced loyalty widget with promotions integration
(function() {
  let loyaltyWidget = null;
  let currentCustomer = null;
  let currentLoyaltyAccount = null;

  // Enhanced customer identification with promotion support
  async function identifyCustomer(phone, email) {
    try {
      const response = await fetch(`${window.LOYALTY_API_BASE}/loyalty-identify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, email })
      });
      
      const data = await response.json();
      if (data.customerId) {
        currentCustomer = data;
        currentLoyaltyAccount = data.loyaltyAccountId;
        return data;
      }
      throw new Error('Customer identification failed');
    } catch (error) {
      console.error('Error identifying customer:', error);
      throw error;
    }
  }

  // Fetch available promotions
  async function fetchPromotions(customerId, loyaltyAccountId) {
    try {
      const params = new URLSearchParams();
      if (customerId) params.append('customerId', customerId);
      if (loyaltyAccountId) params.append('loyaltyAccountId', loyaltyAccountId);

      const response = await fetch(`${window.LOYALTY_API_BASE}/loyalty-promotions?${params}`);
      const data = await response.json();
      return data.promotions || [];
    } catch (error) {
      console.error('Error fetching promotions:', error);
      return [];
    }
  }

  // Redeem promotion
  async function redeemPromotion(promotionId, loyaltyAccountId, customerId) {
    try {
      const response = await fetch(`${window.LOYALTY_API_BASE}/loyalty-promotion-redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promotionId,
          loyaltyAccountId,
          customerId
        })
      });
      
      const data = await response.json();
      if (data.discountCode) {
        return data;
      }
      throw new Error('Promotion redemption failed');
    } catch (error) {
      console.error('Error redeeming promotion:', error);
      throw error;
    }
  }

  // Apply discount code to cart
  function applyDiscountCode(discountCode) {
    // Redirect to Shopify discount URL
    const discountUrl = `/discount/${encodeURIComponent(discountCode)}?return_to=/cart`;
    window.location.href = discountUrl;
  }

  // Enhanced widget HTML with promotions section
  function createWidgetHTML() {
    return `
      <div id="loyalty-widget" class="loyalty-widget">
        <div class="widget-header">
          <h3>🎁 Loyalty Rewards & Promotions</h3>
          <button class="close-btn" onclick="window.LoyaltyWidget.close()">×</button>
        </div>
        
        <div class="widget-content">
          <!-- Customer Identification -->
          <div id="customer-form" class="section">
            <h4>Enter Your Info</h4>
            <div class="form-group">
              <input type="tel" id="phone-input" placeholder="Phone Number" />
              <input type="email" id="email-input" placeholder="Email (optional)" />
              <button onclick="window.LoyaltyWidget.identifyCustomer()">Continue</button>
            </div>
          </div>

          <!-- Customer Dashboard -->
          <div id="customer-dashboard" class="section" style="display: none;">
            <div class="customer-info">
              <h4>Welcome Back!</h4>
              <div class="points-display">
                <span class="points-value" id="points-value">0</span>
                <span class="points-label">Points Available</span>
              </div>
            </div>

            <!-- Promotions Section -->
            <div class="promotions-section">
              <h4>🎉 Special Promotions</h4>
              <div id="promotions-list" class="promotions-list">
                <div class="loading-promotions">Loading promotions...</div>
              </div>
            </div>

            <!-- Regular Rewards Section -->
            <div class="rewards-section">
              <h4>🏆 Loyalty Rewards</h4>
              <div id="rewards-list" class="rewards-list">
                <div class="loading-rewards">Loading rewards...</div>
              </div>
            </div>
          </div>

          <!-- Error State -->
          <div id="error-state" class="section error-state" style="display: none;">
            <p>Something went wrong. Please try again.</p>
            <button onclick="window.LoyaltyWidget.reset()">Try Again</button>
          </div>
        </div>
      </div>
    `;
  }

  // Enhanced CSS with promotion styles
  function injectCSS() {
    const css = `
      .loyalty-widget {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 90%;
        max-width: 450px;
        max-height: 80vh;
        background: white;
        border-radius: 12px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.15);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        overflow: hidden;
      }

      .widget-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 16px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .widget-header h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
      }

      .close-btn {
        background: none;
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background-color 0.2s;
      }

      .close-btn:hover {
        background-color: rgba(255,255,255,0.2);
      }

      .widget-content {
        padding: 20px;
        max-height: 60vh;
        overflow-y: auto;
      }

      .section {
        margin-bottom: 20px;
      }

      .section h4 {
        margin: 0 0 12px 0;
        font-size: 16px;
        font-weight: 600;
        color: #333;
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .form-group input {
        padding: 12px;
        border: 2px solid #e1e5e9;
        border-radius: 8px;
        font-size: 14px;
        transition: border-color 0.2s;
      }

      .form-group input:focus {
        outline: none;
        border-color: #667eea;
      }

      .form-group button {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 12px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: transform 0.2s;
      }

      .form-group button:hover {
        transform: translateY(-1px);
      }

      .customer-info {
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        color: white;
        padding: 16px;
        border-radius: 10px;
        margin-bottom: 20px;
      }

      .points-display {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-top: 8px;
      }

      .points-value {
        font-size: 28px;
        font-weight: 700;
      }

      .points-label {
        font-size: 12px;
        opacity: 0.9;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      /* Promotions Styles */
      .promotions-section {
        background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
        padding: 16px;
        border-radius: 10px;
        margin-bottom: 20px;
      }

      .promotions-section h4 {
        color: #8b4513;
        margin-bottom: 12px;
      }

      .promotion-item {
        background: white;
        padding: 12px;
        border-radius: 8px;
        margin-bottom: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }

      .promotion-item:last-child {
        margin-bottom: 0;
      }

      .promotion-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 8px;
      }

      .promotion-name {
        font-weight: 600;
        color: #333;
        font-size: 14px;
      }

      .promotion-badge {
        background: #ff6b6b;
        color: white;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
      }

      .promotion-badge.birthday {
        background: #ff69b4;
      }

      .promotion-description {
        font-size: 12px;
        color: #666;
        margin-bottom: 8px;
        line-height: 1.4;
      }

      .promotion-details {
        font-size: 11px;
        color: #999;
        margin-bottom: 10px;
      }

      .promotion-button {
        background: #ff6b6b;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        width: 100%;
        transition: background-color 0.2s;
      }

      .promotion-button.birthday {
        background: #ff69b4;
      }

      .promotion-button:hover {
        opacity: 0.9;
      }

      .promotion-button:disabled {
        background: #ccc;
        cursor: not-allowed;
      }

      /* Regular Rewards Styles */
      .rewards-section {
        background: #f8f9fa;
        padding: 16px;
        border-radius: 10px;
      }

      .reward-item {
        background: white;
        padding: 12px;
        border-radius: 8px;
        margin-bottom: 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      }

      .reward-item:last-child {
        margin-bottom: 0;
      }

      .reward-info {
        flex: 1;
      }

      .reward-name {
        font-weight: 600;
        color: #333;
        font-size: 14px;
        margin-bottom: 2px;
      }

      .reward-points {
        color: #666;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .reward-button {
        background: #4ecdc4;
        color: white;
        border: none;
        padding: 8px 14px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s;
        white-space: nowrap;
        margin-left: 12px;
      }

      .reward-button:hover {
        background: #45b7b8;
      }

      .reward-button:disabled {
        background: #bdc3c7;
        cursor: not-allowed;
      }

      .loading-promotions,
      .loading-rewards {
        text-align: center;
        padding: 20px;
        color: #666;
        font-size: 14px;
      }

      .error-state {
        text-align: center;
        padding: 20px;
        color: #e74c3c;
      }

      .no-promotions,
      .no-rewards {
        text-align: center;
        padding: 16px;
        color: #999;
        font-size: 13px;
      }

      /* Animation for promotion redemption */
      @keyframes promotion-success {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
      }

      .promotion-redeemed {
        animation: promotion-success 0.3s ease;
        background: #2ecc71 !important;
      }
    `;

    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  // Enhanced widget functionality
  window.LoyaltyWidget = {
    init() {
      window.LOYALTY_API_BASE = 'https://oxsxkwrsbpcmwghfmooz.supabase.co/functions/v1';
      
      // Create widget on page load
      injectCSS();
      
      // Add widget trigger
      this.addTriggerButton();
    },

    addTriggerButton() {
      // Add floating loyalty button
      const trigger = document.createElement('div');
      trigger.innerHTML = `
        <button onclick="window.LoyaltyWidget.open()" style="
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 50%;
          width: 60px;
          height: 60px;
          font-size: 24px;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          z-index: 9999;
          transition: transform 0.2s;
        " onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
          🎁
        </button>
      `;
      document.body.appendChild(trigger);
    },

    open() {
      if (!loyaltyWidget) {
        loyaltyWidget = document.createElement('div');
        loyaltyWidget.innerHTML = createWidgetHTML();
        document.body.appendChild(loyaltyWidget);

        // Add backdrop
        const backdrop = document.createElement('div');
        backdrop.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          z-index: 9999;
        `;
        backdrop.onclick = () => this.close();
        document.body.appendChild(backdrop);
        loyaltyWidget.backdrop = backdrop;
      }
    },

    close() {
      if (loyaltyWidget) {
        loyaltyWidget.remove();
        if (loyaltyWidget.backdrop) {
          loyaltyWidget.backdrop.remove();
        }
        loyaltyWidget = null;
      }
    },

    async identifyCustomer() {
      const phone = document.getElementById('phone-input')?.value;
      const email = document.getElementById('email-input')?.value;

      if (!phone && !email) {
        alert('Please enter your phone number or email');
        return;
      }

      try {
        const customerData = await identifyCustomer(phone, email);
        document.getElementById('customer-form').style.display = 'none';
        document.getElementById('customer-dashboard').style.display = 'block';
        
        // Update points display
        document.getElementById('points-value').textContent = customerData.pointsBalance;

        // Load promotions and rewards
        await this.loadPromotions();
        await this.loadRewards();
      } catch (error) {
        document.getElementById('customer-form').style.display = 'none';
        document.getElementById('error-state').style.display = 'block';
      }
    },

    async loadPromotions() {
      try {
        const promotions = await fetchPromotions(currentCustomer.customerId, currentLoyaltyAccount);
        const promotionsList = document.getElementById('promotions-list');
        
        if (promotions.length === 0) {
          promotionsList.innerHTML = '<div class="no-promotions">No promotions available</div>';
          return;
        }

        promotionsList.innerHTML = promotions.map(promo => `
          <div class="promotion-item">
            <div class="promotion-header">
              <div class="promotion-name">${promo.name}</div>
              <div class="promotion-badge ${promo.eligibility_reason === 'birthday_month' ? 'birthday' : ''}">
                ${this.formatPromotionValue(promo)}
              </div>
            </div>
            ${promo.description ? `<div class="promotion-description">${promo.description}</div>` : ''}
            ${promo.minimum_spend ? `<div class="promotion-details">Min spend: $${(promo.minimum_spend.amount/100).toFixed(2)}</div>` : ''}
            ${promo.available_time?.end_date ? `<div class="promotion-details">Expires: ${new Date(promo.available_time.end_date).toLocaleDateString()}</div>` : ''}
            ${promo.eligibility_reason === 'birthday_month' ? '<div class="promotion-details">🎂 Happy Birthday Month!</div>' : ''}
            <button 
              class="promotion-button ${promo.eligibility_reason === 'birthday_month' ? 'birthday' : ''}"
              onclick="window.LoyaltyWidget.redeemPromotion('${promo.id}')"
              ${!promo.customer_eligible ? 'disabled' : ''}
            >
              ${promo.customer_eligible ? 'Redeem Now' : 'Not Eligible'}
            </button>
          </div>
        `).join('');
      } catch (error) {
        document.getElementById('promotions-list').innerHTML = '<div class="no-promotions">Error loading promotions</div>';
      }
    },

    async loadRewards() {
      try {
        const response = await fetch(`${window.LOYALTY_API_BASE}/loyalty-tiers?programId=${currentCustomer.programId}`);
        const data = await response.json();
        const rewardsList = document.getElementById('rewards-list');
        
        if (!data.rewardTiers || data.rewardTiers.length === 0) {
          rewardsList.innerHTML = '<div class="no-rewards">No rewards available</div>';
          return;
        }

        rewardsList.innerHTML = data.rewardTiers.map(tier => `
          <div class="reward-item">
            <div class="reward-info">
              <div class="reward-name">${tier.name}</div>
              <div class="reward-points">${tier.points} points required</div>
            </div>
            <button 
              class="reward-button"
              onclick="window.LoyaltyWidget.redeemReward('${tier.id}')"
              ${currentCustomer.pointsBalance < tier.points ? 'disabled' : ''}
            >
              ${currentCustomer.pointsBalance >= tier.points ? 'Redeem' : 'Need More Points'}
            </button>
          </div>
        `).join('');
      } catch (error) {
        document.getElementById('rewards-list').innerHTML = '<div class="no-rewards">Error loading rewards</div>';
      }
    },

    async redeemPromotion(promotionId) {
      try {
        const result = await redeemPromotion(promotionId, currentLoyaltyAccount, currentCustomer.customerId);
        
        // Show success animation
        const promotionButton = event.target;
        promotionButton.textContent = 'Applying...';
        promotionButton.classList.add('promotion-redeemed');
        
        setTimeout(() => {
          applyDiscountCode(result.discountCode);
        }, 1000);
        
      } catch (error) {
        alert('Failed to redeem promotion. Please try again.');
      }
    },

    async redeemReward(rewardTierId) {
      try {
        const response = await fetch(`${window.LOYALTY_API_BASE}/loyalty-redeem`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            loyaltyAccountId: currentLoyaltyAccount,
            rewardTierId: rewardTierId
          })
        });
        
        const result = await response.json();
        if (result.discountCode) {
          applyDiscountCode(result.discountCode);
        }
      } catch (error) {
        alert('Failed to redeem reward. Please try again.');
      }
    },

    formatPromotionValue(promo) {
      if (promo.incentive_type === 'PERCENTAGE_DISCOUNT') {
        return `${promo.incentive_value}% OFF`;
      } else if (promo.incentive_type === 'FIXED_DISCOUNT') {
        const amount = promo.incentive_value?.amount || promo.incentive_value;
        return `$${(amount/100).toFixed(0)} OFF`;
      }
      return 'SPECIAL';
    },

    reset() {
      currentCustomer = null;
      currentLoyaltyAccount = null;
      document.getElementById('customer-form').style.display = 'block';
      document.getElementById('customer-dashboard').style.display = 'none';
      document.getElementById('error-state').style.display = 'none';
      document.getElementById('phone-input').value = '';
      document.getElementById('email-input').value = '';
    }
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.LoyaltyWidget.init());
  } else {
    window.LoyaltyWidget.init();
  }
})();