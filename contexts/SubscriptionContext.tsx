import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SubscriptionState {
  tier: 'free' | 'basic' | 'premium';
  postsUsed: number;
  postsLimit: number;
  canPost: boolean;
  loading: boolean;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionState | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SubscriptionState>({
    tier: 'free',
    postsUsed: 0,
    postsLimit: 1,
    canPost: true,
    loading: true,
    refreshSubscription: async () => {},
  });

  useEffect(() => {
    const loadSubscription = async () => {
      try {
        const tier = (await AsyncStorage.getItem('@subscription_tier')) as 'free' | 'basic' | 'premium' || 'free';

        const limit = tier === 'free' ? 1 : tier === 'basic' ? 10 : -1;

        const currentMonth = new Date().toISOString().slice(0, 7);
        const postsUsed = parseInt(await AsyncStorage.getItem(`@posts_used_${currentMonth}`) || '0');

        setState(prev => ({
          ...prev,
          tier,
          postsUsed,
          postsLimit: limit,
          canPost: limit === -1 || postsUsed < limit,
          loading: false,
        }));
      } catch (error) {
        console.error('Failed to load subscription:', error);
        setState(prev => ({ ...prev, loading: false }));
      }
    };

    loadSubscription();
  }, []);

  const refreshSubscription = async () => {
    try {
      const tier = (await AsyncStorage.getItem('@subscription_tier')) as 'free' | 'basic' | 'premium' || 'free';

      const limit = tier === 'free' ? 1 : tier === 'basic' ? 10 : -1;

      const currentMonth = new Date().toISOString().slice(0, 7);
      const postsUsed = parseInt(await AsyncStorage.getItem(`@posts_used_${currentMonth}`) || '0');

      setState(prev => ({
        ...prev,
        tier,
        postsUsed,
        postsLimit: limit,
        canPost: limit === -1 || postsUsed < limit,
      }));
    } catch (error) {
      console.error('Failed to refresh subscription:', error);
    }
  };

  const stateWithRefresh = {
    ...state,
    refreshSubscription,
  };

  return (
    <SubscriptionContext.Provider value={stateWithRefresh}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) throw new Error('useSubscription must be used within SubscriptionProvider');
  return context;
};
