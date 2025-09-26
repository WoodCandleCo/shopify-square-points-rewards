/**
 * Production Square Loyalty Widget
 * Implements the exact API structure requested for customer loyalty integration
 */

(function() {
  'use strict';

  // Utility function to normalize phone to E.164 format
  function normalizePhoneToE164(phone) {
    if (!phone) return null;
    
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // If it starts with 1 and has 11 digits, assume US/Canada
    if (digits.length === 11 && digits.startsWith('1')) {
      return '+' + digits;
    }
    
    // If it has 10 digits, assume US/Canada and add country code
    if (digits.length === 10) {
      return '+1' + digits;
    }
    
    // If it already starts with + keep as is
    if (phone.startsWith('+')) {
      return phone;
    }
    
    // Default: add + to the beginning
    return '+' + digits;
  }

  // Validate E.164 format
  function isValidE164(phone) {
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phone);
  }

  // API wrapper functions matching the specified endpoints
  const LoyaltyAPI = {
    // 1) POST /api/loyalty/identify (using Supabase edge function)
    async identify(phone, email) {
      const e164Phone = phone ? normalizePhoneToE164(phone) : null;
      
      if (e164Phone && !isValidE164(e164Phone)) {
        throw new Error('Invalid phone number format. Please use international format (e.g., +1234567890)');
      }

      const response = await fetch('https://oxsxkwrsbpcmwghfmooz.supabase.co/functions/v1/loyalty-identify', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94c3hrd3JzYnBjbXdnaGZtb296Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxNjE2MzksImV4cCI6MjA3MzczNzYzOX0.re0nwcRGwcvwl8F3Eu1C1g-P3QEwOtNFpK6MGrlL7ek'
        },
        body: JSON.stringify({ phone: e164Phone, email })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to identify customer');
      }

      return response.json();
    },

    // 2) GET /api/loyalty/balance?accountId=... (using Supabase edge function)
    async getBalance(accountId) {
      const response = await fetch(`https://oxsxkwrsbpcmwghfmooz.supabase.co/functions/v1/loyalty-balance?accountId=${encodeURIComponent(accountId)}`, {
        headers: { 
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94c3hrd3JzYnBjbXdnaGZtb296Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxNjE2MzksImV4cCI6MjA3MzczNzYzOX0.re0nwcRGwcvwl8F3Eu1C1g-P3QEwOtNFpK6MGrlL7ek'
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get balance');
      }

      return response.json();
    },

    // 3) GET /api/loyalty/tiers?programId=... (using Supabase edge function)
    async getTiers(programId) {
      const response = await fetch(`https://oxsxkwrsbpcmwghfmooz.supabase.co/functions/v1/loyalty-tiers?programId=${encodeURIComponent(programId)}`, {
        headers: { 
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94c3hrd3JzYnBjbXdnaGZtb296Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxNjE2MzksImV4cCI6MjA3MzczNzYzOX0.re0nwcRGwcvwl8F3Eu1C1g-P3QEwOtNFpK6MGrlL7ek'
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get tiers');
      }

      return response.json();
    },

    // 4) GET /api/loyalty/promotions?programId=... (using Supabase edge function)
    async getPromotions(programId, customerId, loyaltyAccountId) {
      const url = new URL('https://oxsxkwrsbpcmwghfmooz.supabase.co/functions/v1/loyalty-promotions');
      if (programId) url.searchParams.set('programId', programId);
      if (customerId) url.searchParams.set('customerId', customerId);
      if (loyaltyAccountId) url.searchParams.set('loyaltyAccountId', loyaltyAccountId);
      
      const response = await fetch(url, {
        headers: { 
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94c3hrd3JzYnBjbXdnaGZtb296Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxNjE2MzksImV4cCI6MjA3MzczNzYzOX0.re0nwcRGwcvwl8F3Eu1C1g-P3QEwOtNFpK6MGrlL7ek'
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get promotions');
      }

      return response.json();
    },

    // 5) GET /api/loyalty/available-rewards?accountId=... (using Supabase edge function)
    async getAvailableRewards(accountId) {
      const response = await fetch('https://oxsxkwrsbpcmwghfmooz.supabase.co/functions/v1/loyalty-lookup', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94c3hrd3JzYnBjbXdnaGZtb296Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxNjE2MzksImV4cCI6MjA3MzczNzYzOX0.re0nwcRGwcvwl8F3Eu1C1g-P3QEwOtNFpK6MGrlL7ek'
        },
        body: JSON.stringify({ loyaltyAccountId: accountId })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get available rewards');
      }

      const data = await response.json();
      return data.available_rewards || [];
    },

    // 6) POST /api/loyalty/redeem (using existing Supabase edge function)
    async redeem(loyaltyAccountId, rewardTierId) {
      const response = await fetch('https://oxsxkwrsbpcmwghfmooz.supabase.co/functions/v1/loyalty-redeem', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94c3hrd3JzYnBjbXdnaGZtb296Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxNjE2MzksImV4cCI6MjA3MzczNzYzOX0.re0nwcRGwcvwl8F3Eu1C1g-P3QEwOtNFpK6MGrlL7ek'
        },
        body: JSON.stringify({ loyaltyAccountId, rewardTierId })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to redeem reward');
      }

      return response.json();
    },

    // 7) POST /api/loyalty/finalize (using existing Supabase edge function)
    async finalize(rewardId, success, shopifyOrderId) {
      const response = await fetch('https://oxsxkwrsbpcmwghfmooz.supabase.co/functions/v1/loyalty-finalize', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94c3hrd3JzYnBjbXdnaGZtb296Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxNjE2MzksImV4cCI6MjA3MzczNzYzOX0.re0nwcRGwcvwl8F3Eu1C1g-P3QEwOtNFpK6MGrlL7ek'
        },
        body: JSON.stringify({ rewardId, success, shopifyOrderId })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to finalize reward');
      }

      return response.json();
    }
  };

  // Main Loyalty Widget Class
  class SquareLoyaltyWidget {
    constructor(containerId, options = {}) {
      this.container = document.getElementById(containerId);
      this.options = {
        title: options.title || 'Loyalty Rewards',
        theme: options.theme || 'light',
        autoApplyDiscounts: options.autoApplyDiscounts !== false,
        ...options
      };
      
      this.customerData = null;
      this.isLoading = false;
      
      this.init();
    }

    init() {
      if (!this.container) {
        console.error('Loyalty widget container not found');
        return;
      }

      this.render();
    }

    async identify(phone, email) {
      try {
        this.setLoading(true);
        this.customerData = await LoyaltyAPI.identify(phone, email);
        await this.loadCustomerData();
        this.render();
      } catch (error) {
        this.showError(error.message);
      } finally {
        this.setLoading(false);
      }
    }

    async loadCustomerData() {
      if (!this.customerData) return;

      try {
        // Load all customer data in parallel
        const [rewards, promotions, tiers] = await Promise.all([
          LoyaltyAPI.getAvailableRewards(this.customerData.loyaltyAccountId),
          LoyaltyAPI.getPromotions(this.customerData.programId, this.customerData.customerId, this.customerData.loyaltyAccountId),
          LoyaltyAPI.getTiers(this.customerData.programId)
        ]);

        this.customerData.availableRewards = rewards;
        this.customerData.activePromotions = promotions.promotions || promotions;
        this.customerData.tiers = tiers.rewardTiers || tiers;
      } catch (error) {
        console.error('Failed to load customer data:', error);
      }
    }

    async redeemReward(rewardTierId) {
      if (!this.customerData) return;

      try {
        this.setLoading(true);
        
        const result = await LoyaltyAPI.redeem(this.customerData.loyaltyAccountId, rewardTierId);
        
        if (result.discountCode && this.options.autoApplyDiscounts) {
          // Auto-apply discount using Shopify's shareable link
          window.location.href = `/discount/${encodeURIComponent(result.discountCode)}?return_to=/cart`;
        } else {
          this.showSuccess(`Discount code: ${result.discountCode}`);
        }
        
      } catch (error) {
        this.showError(error.message);
      } finally {
        this.setLoading(false);
      }
    }

    setLoading(loading) {
      this.isLoading = loading;
      this.render();
    }

    showError(message) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'loyalty-error';
      errorDiv.style.cssText = `
        background: #fee;
        color: #c33;
        padding: 10px;
        border-radius: 4px;
        margin: 10px 0;
        border: 1px solid #fcc;
      `;
      errorDiv.textContent = message;
      
      this.container.prepend(errorDiv);
      
      setTimeout(() => {
        if (errorDiv.parentNode) {
          errorDiv.parentNode.removeChild(errorDiv);
        }
      }, 5000);
    }

    showSuccess(message) {
      const successDiv = document.createElement('div');
      successDiv.className = 'loyalty-success';
      successDiv.style.cssText = `
        background: #efe;
        color: #3c3;
        padding: 10px;
        border-radius: 4px;
        margin: 10px 0;
        border: 1px solid #cfc;
      `;
      successDiv.textContent = message;
      
      this.container.prepend(successDiv);
      
      setTimeout(() => {
        if (successDiv.parentNode) {
          successDiv.parentNode.removeChild(successDiv);
        }
      }, 5000);
    }

    render() {
      if (!this.container) return;

      const theme = this.options.theme === 'dark' ? 'loyalty-dark' : 'loyalty-light';
      
      this.container.innerHTML = `
        <div class="square-loyalty-widget ${theme}">
          <style>
            .square-loyalty-widget {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 400px;
              border: 1px solid #ddd;
              border-radius: 8px;
              padding: 20px;
              background: #fff;
            }
            .square-loyalty-widget.loyalty-dark {
              background: #1a1a1a;
              color: #fff;
              border-color: #333;
            }
            .loyalty-header {
              text-align: center;
              margin-bottom: 20px;
            }
            .loyalty-title {
              font-size: 24px;
              font-weight: bold;
              margin: 0 0 10px 0;
            }
            .loyalty-form {
              margin-bottom: 20px;
            }
            .loyalty-input {
              width: 100%;
              padding: 10px;
              margin: 5px 0;
              border: 1px solid #ddd;
              border-radius: 4px;
              box-sizing: border-box;
            }
            .loyalty-button {
              width: 100%;
              padding: 12px;
              background: #007cba;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 16px;
              margin: 5px 0;
            }
            .loyalty-button:hover {
              background: #005a8b;
            }
            .loyalty-button:disabled {
              background: #ccc;
              cursor: not-allowed;
            }
            .loyalty-section {
              margin: 15px 0;
              padding: 15px;
              border: 1px solid #eee;
              border-radius: 4px;
            }
            .loyalty-dark .loyalty-section {
              border-color: #444;
            }
            .loyalty-section h3 {
              margin: 0 0 10px 0;
              font-size: 18px;
            }
            .loyalty-balance {
              text-align: center;
              font-size: 20px;
              font-weight: bold;
              color: #007cba;
            }
            .loyalty-dark .loyalty-balance {
              color: #4da6d9;
            }
            .loyalty-reward {
              padding: 10px;
              margin: 5px 0;
              border: 1px solid #ddd;
              border-radius: 4px;
              cursor: pointer;
            }
            .loyalty-dark .loyalty-reward {
              border-color: #555;
              background: #2a2a2a;
            }
            .loyalty-reward:hover {
              background: #f5f5f5;
            }
            .loyalty-dark .loyalty-reward:hover {
              background: #3a3a3a;
            }
            .loyalty-loading {
              text-align: center;
              padding: 20px;
              color: #666;
            }
          </style>
          
          <div class="loyalty-header">
            <h2 class="loyalty-title">${this.options.title}</h2>
          </div>

          ${this.renderContent()}
        </div>
      `;

      this.attachEventListeners();
    }

    renderContent() {
      if (this.isLoading) {
        return '<div class="loyalty-loading">Loading...</div>';
      }

      if (!this.customerData) {
        return this.renderIdentifyForm();
      }

      return this.renderCustomerDashboard();
    }

    renderIdentifyForm() {
      return `
        <div class="loyalty-form">
          <input type="tel" id="loyalty-phone" class="loyalty-input" placeholder="Phone number (e.g., +1234567890)" />
          <input type="email" id="loyalty-email" class="loyalty-input" placeholder="Email address" />
          <button id="loyalty-identify" class="loyalty-button">Find My Account</button>
        </div>
        <p style="font-size: 12px; color: #666; text-align: center;">
          Enter your phone number or email to find your loyalty account or create a new one.
        </p>
      `;
    }

    renderCustomerDashboard() {
      const { pointsBalance, lifetimePoints, availableRewards = [], activePromotions = [], tiers = [] } = this.customerData;

      return `
        <div class="loyalty-section">
          <h3>Your Balance</h3>
          <div class="loyalty-balance">${pointsBalance || 0} points</div>
          <div style="text-align: center; font-size: 14px; color: #666;">
            Lifetime: ${lifetimePoints || 0} points
          </div>
        </div>

        ${availableRewards.length > 0 ? `
          <div class="loyalty-section">
            <h3>Available Rewards</h3>
            ${availableRewards.map(reward => `
              <div class="loyalty-reward" data-reward-id="${reward.id}">
                <strong>${reward.name || 'Reward'}</strong>
                <div style="font-size: 14px; color: #666;">${reward.description || 'Click to redeem'}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${activePromotions.length > 0 ? `
          <div class="loyalty-section">
            <h3>Active Promotions</h3>
            ${activePromotions.map(promo => `
              <div class="loyalty-reward">
                <strong>${promo.name}</strong>
                <div style="font-size: 14px; color: #666;">${promo.summary || ''}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${tiers.length > 0 ? `
          <div class="loyalty-section">
            <h3>Redeem Points</h3>
            ${tiers.map(tier => {
              const canRedeem = pointsBalance >= (tier.points || 0);
              return `
                <div class="loyalty-reward ${canRedeem ? 'can-redeem' : 'cannot-redeem'}" 
                     data-tier-id="${tier.id}" 
                     style="${canRedeem ? '' : 'opacity: 0.5; cursor: not-allowed;'}">
                  <strong>${tier.name}</strong>
                  <div style="font-size: 14px; color: #666;">
                    ${tier.points} points - ${tier.definition?.discount_type === 'FIXED_AMOUNT' ? 
                      `$${(tier.definition.amount / 100).toFixed(2)} off` : 
                      `${tier.definition?.percentage || 0}% off`}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}

        <button id="loyalty-refresh" class="loyalty-button" style="background: #666;">
          Refresh Account
        </button>
      `;
    }

    attachEventListeners() {
      // Identify form
      const identifyBtn = document.getElementById('loyalty-identify');
      if (identifyBtn) {
        identifyBtn.addEventListener('click', () => {
          const phone = document.getElementById('loyalty-phone').value.trim();
          const email = document.getElementById('loyalty-email').value.trim();
          
          if (!phone && !email) {
            this.showError('Please enter your phone number or email address');
            return;
          }
          
          this.identify(phone, email);
        });
      }

      // Tier redemption
      const tierElements = document.querySelectorAll('[data-tier-id]');
      tierElements.forEach(element => {
        if (!element.classList.contains('cannot-redeem')) {
          element.addEventListener('click', () => {
            const tierId = element.dataset.tierId;
            this.redeemReward(tierId);
          });
        }
      });

      // Refresh button
      const refreshBtn = document.getElementById('loyalty-refresh');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
          this.loadCustomerData().then(() => this.render());
        });
      }
    }
  }

  // Make widget available globally
  window.SquareLoyaltyWidget = SquareLoyaltyWidget;
  window.LoyaltyAPI = LoyaltyAPI;

  // Auto-initialize if container exists
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('square-loyalty-widget')) {
      new SquareLoyaltyWidget('square-loyalty-widget');
    }
  });

})();
