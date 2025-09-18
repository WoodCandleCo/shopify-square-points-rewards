import React, { useState, useEffect } from 'react';
import {
  reactExtension,
  Banner,
  BlockStack,
  Button,
  Heading,
  InlineLayout,
  Text,
  TextField,
  useApi,
  useApplyCartLinesChange,
  useCartLines,
  useSettings,
  useCustomer,
  Pressable,
  Icon,
  View,
} from '@shopify/ui-extensions-react/checkout';

interface LoyaltyAccount {
  id: string;
  balance: number;
  points_earned_lifetime: number;
}

interface LoyaltyReward {
  id: string;
  name: string;
  points_required: number;
  discount_amount: number;
  discount_type: 'PERCENTAGE' | 'FIXED_AMOUNT';
}

export default reactExtension(
  'purchase.checkout.block.render',
  () => <Extension />
);

function Extension() {
  const { extension } = useApi();
  const settings = useSettings();
  const customer = useCustomer();
  const cartLines = useCartLines();
  const applyCartLinesChange = useApplyCartLinesChange();

  const [loyaltyAccount, setLoyaltyAccount] = useState<LoyaltyAccount | null>(null);
  const [availableRewards, setAvailableRewards] = useState<LoyaltyReward[]>([]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRewards, setShowRewards] = useState(false);

  // Check for existing customer loyalty account
  useEffect(() => {
    if (customer?.id) {
      loadCustomerLoyaltyAccount();
    }
  }, [customer]);

  const loadCustomerLoyaltyAccount = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/loyalty/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          customer_id: customer?.id,
          email: customer?.email 
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setLoyaltyAccount(data.loyalty_account);
        setAvailableRewards(data.available_rewards);
      }
    } catch (err) {
      console.error('Failed to load loyalty account:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneNumberSubmit = async () => {
    if (!phoneNumber) {
      setError('Please enter your phone number');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      
      const response = await fetch('/api/loyalty/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone: phoneNumber,
          customer_id: customer?.id,
          email: customer?.email 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setLoyaltyAccount(data.loyalty_account);
        setAvailableRewards(data.available_rewards);
        setPhoneNumber('');
      } else {
        setError(data.error || 'Failed to find loyalty account');
      }
    } catch (err) {
      setError('Failed to connect to loyalty program');
    } finally {
      setIsLoading(false);
    }
  };

  const redeemReward = async (reward: LoyaltyReward) => {
    if (!loyaltyAccount || loyaltyAccount.balance < reward.points_required) {
      return;
    }

    try {
      setIsLoading(true);
      
      const response = await fetch('/api/loyalty/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loyalty_account_id: loyaltyAccount.id,
          reward_id: reward.id,
          cart_total: cartLines.reduce((sum, line) => sum + (line.cost.totalAmount.amount || 0), 0)
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Apply discount to cart
        const discountValue = reward.discount_type === 'PERCENTAGE' 
          ? cartLines.reduce((sum, line) => sum + (line.cost.totalAmount.amount || 0), 0) * (reward.discount_amount / 100)
          : reward.discount_amount;

        await applyCartLinesChange({
          type: 'addCartLine',
          merchandiseId: 'gid://shopify/ProductVariant/discount',
          quantity: 1,
          cost: {
            totalAmount: {
              amount: -discountValue,
              currencyCode: cartLines[0]?.cost?.totalAmount?.currencyCode || 'USD'
            }
          }
        });

        // Update loyalty account balance
        setLoyaltyAccount(prev => prev ? {
          ...prev,
          balance: prev.balance - reward.points_required
        } : null);
      }
    } catch (err) {
      setError('Failed to redeem reward');
    } finally {
      setIsLoading(false);
    }
  };

  if (!loyaltyAccount) {
    return (
      <BlockStack spacing="base">
        <Heading level={2}>Loyalty Program</Heading>
        <Text>Enter your phone number to access your loyalty points</Text>
        
        <TextField
          label="Phone Number"
          value={phoneNumber}
          onChange={setPhoneNumber}
          placeholder="+1 (555) 123-4567"
        />
        
        {error && (
          <Banner status="critical">{error}</Banner>
        )}
        
        <Button
          onPress={handlePhoneNumberSubmit}
          disabled={isLoading || !phoneNumber}
          loading={isLoading}
        >
          Connect Loyalty Account
        </Button>
      </BlockStack>
    );
  }

  return (
    <BlockStack spacing="base">
      <Heading level={2}>Your Loyalty Points</Heading>
      
      <InlineLayout columns={['fill', 'fill']}>
        <View>
          <Text emphasis="bold">Current Balance</Text>
          <Text size="large">{loyaltyAccount.balance} points</Text>
        </View>
        <View>
          <Text emphasis="bold">Lifetime Earned</Text>
          <Text size="large">{loyaltyAccount.points_earned_lifetime} points</Text>
        </View>
      </InlineLayout>

      {availableRewards.length > 0 && (
        <BlockStack spacing="tight">
          <Pressable onPress={() => setShowRewards(!showRewards)}>
            <InlineLayout columns={['fill', 'auto']}>
              <Text emphasis="bold">Available Rewards ({availableRewards.length})</Text>
              <Icon source={showRewards ? 'chevronUp' : 'chevronDown'} />
            </InlineLayout>
          </Pressable>

          {showRewards && (
            <BlockStack spacing="tight">
              {availableRewards.map((reward) => (
                <View key={reward.id} border="base" padding="base">
                  <BlockStack spacing="tight">
                    <InlineLayout columns={['fill', 'auto']}>
                      <View>
                        <Text emphasis="bold">{reward.name}</Text>
                        <Text size="small">
                          {reward.discount_type === 'PERCENTAGE' 
                            ? `${reward.discount_amount}% off` 
                            : `$${(reward.discount_amount / 100).toFixed(2)} off`}
                        </Text>
                        <Text size="small">{reward.points_required} points required</Text>
                      </View>
                      <Button
                        size="small"
                        onPress={() => redeemReward(reward)}
                        disabled={loyaltyAccount.balance < reward.points_required || isLoading}
                      >
                        Redeem
                      </Button>
                    </InlineLayout>
                  </BlockStack>
                </View>
              ))}
            </BlockStack>
          )}
        </BlockStack>
      )}

      {error && (
        <Banner status="critical">{error}</Banner>
      )}
    </BlockStack>
  );
}