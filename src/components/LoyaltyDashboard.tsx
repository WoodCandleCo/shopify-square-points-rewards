import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Gift, CreditCard, TrendingUp, Award } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface LoyaltyAccount {
  id: string;
  balance: number;
  points_earned_lifetime: number;
  square_loyalty_account_id: string;
  program_id: string;
}

interface LoyaltyReward {
  id: string;
  name: string;
  description: string | null;
  points_required: number;
  discount_amount: number | null;
  discount_type: string;
  square_reward_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface LoyaltyTransaction {
  id: string;
  transaction_type: string;
  points: number;
  description: string | null;
  created_at: string;
  user_id: string;
  loyalty_account_id: string;
  square_transaction_id: string | null;
}

const LoyaltyDashboard = () => {
  const [loyaltyAccount, setLoyaltyAccount] = useState<LoyaltyAccount | null>(null);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchLoyaltyData();
    }
  }, [user]);

  const fetchLoyaltyData = async () => {
    try {
      // Fetch loyalty account
      const { data: accountData, error: accountError } = await supabase
        .from('loyalty_accounts')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (accountError && accountError.code !== 'PGRST116') {
        throw accountError;
      }

      setLoyaltyAccount(accountData);

      // Fetch available rewards
      const { data: rewardsData, error: rewardsError } = await supabase
        .from('loyalty_rewards')
        .select('*')
        .eq('is_active', true)
        .order('points_required');

      if (rewardsError) throw rewardsError;
      setRewards(rewardsData || []);

      // Fetch recent transactions if account exists
      if (accountData) {
        const { data: transactionsData, error: transactionsError } = await supabase
          .from('loyalty_transactions')
          .select('*')
          .eq('user_id', user?.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (transactionsError) throw transactionsError;
        setTransactions(transactionsData || []);
      }
    } catch (error: any) {
      toast({
        title: "Error loading loyalty data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnectSquare = async () => {
    toast({
      title: "Square Connection",
      description: "This would connect to Square API to link your loyalty account.",
    });
  };

  const handleRedeemReward = async (reward: LoyaltyReward) => {
    if (!loyaltyAccount || loyaltyAccount.balance < reward.points_required) {
      toast({
        title: "Insufficient points",
        description: `You need ${reward.points_required} points to redeem this reward.`,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Reward redeemed!",
      description: `${reward.name} has been added to your cart.`,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading your loyalty data...</p>
        </div>
      </div>
    );
  }

  if (!loyaltyAccount) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Gift className="w-12 h-12 mx-auto text-primary mb-4" />
            <CardTitle>Connect Your Square Loyalty Account</CardTitle>
            <CardDescription>
              Link your Square loyalty account to start earning and redeeming points
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleConnectSquare} className="w-full">
              Connect Square Account
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground">Your Loyalty Dashboard</h1>
          <p className="text-muted-foreground mt-2">Track your points and redeem rewards</p>
        </div>

        {/* Loyalty Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{loyaltyAccount.balance}</div>
              <p className="text-xs text-muted-foreground">loyalty points</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Lifetime Points</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loyaltyAccount.points_earned_lifetime}</div>
              <p className="text-xs text-muted-foreground">total earned</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available Rewards</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{rewards.length}</div>
              <p className="text-xs text-muted-foreground">rewards to redeem</p>
            </CardContent>
          </Card>
        </div>

        {/* Available Rewards */}
        <Card>
          <CardHeader>
            <CardTitle>Available Rewards</CardTitle>
            <CardDescription>Redeem your points for these great rewards</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rewards.map((reward) => (
                <Card key={reward.id} className="relative">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{reward.name}</CardTitle>
                      <Badge variant={loyaltyAccount.balance >= reward.points_required ? "default" : "secondary"}>
                        {reward.points_required} pts
                      </Badge>
                    </div>
                    <CardDescription>{reward.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {reward.discount_type === 'PERCENTAGE' 
                          ? `${reward.discount_amount}% off`
                          : `$${((reward.discount_amount || 0) / 100).toFixed(2)} off`
                        }
                      </p>
                      <Button 
                        onClick={() => handleRedeemReward(reward)}
                        disabled={loyaltyAccount.balance < reward.points_required}
                        className="w-full"
                        size="sm"
                      >
                        {loyaltyAccount.balance >= reward.points_required ? 'Redeem' : 'Not enough points'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        {transactions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your latest loyalty transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {transactions.map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-2 h-2 rounded-full ${
                        transaction.transaction_type === 'EARN' ? 'bg-green-500' : 'bg-blue-500'
                      }`} />
                      <div>
                        <p className="font-medium">{transaction.description}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(transaction.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className={`font-bold ${
                      transaction.transaction_type === 'EARN' ? 'text-green-600' : 'text-blue-600'
                    }`}>
                      {transaction.transaction_type === 'EARN' ? '+' : '-'}{transaction.points} pts
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default LoyaltyDashboard;