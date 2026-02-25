import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { TransactionType, LifestyleType } from '@/types';

interface UserPreferencesState {
  transactionType: TransactionType;
  location: string;
  lifestyles: LifestyleType[];
  setTransactionType: (type: TransactionType) => Promise<void>;
  setLocation: (location: string) => Promise<void>;
  setLifestyles: (lifestyles: LifestyleType[]) => Promise<void>;
  updatePreferences: (transactionType: TransactionType, location: string, lifestyles: LifestyleType[]) => Promise<void>;
}

const STORAGE_KEY = '@saqan_user_preferences';

export const [UserPreferencesProvider, useUserPreferences] = createContextHook<UserPreferencesState>(() => {
  const [transactionType, setTransactionTypeState] = useState<TransactionType>('RENT');
  const [location, setLocationState] = useState<string>('Dubai');
  const [lifestyles, setLifestylesState] = useState<LifestyleType[]>([]);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setTransactionTypeState(parsed.transactionType || 'RENT');
        setLocationState(parsed.location || 'Dubai');
        setLifestylesState(parsed.lifestyles || []);
      }
    } catch (error) {
      console.log('Error loading preferences:', error);
    }
  };

  const savePreferences = async (type: TransactionType, loc: string, lifes: LifestyleType[]): Promise<void> => {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          transactionType: type,
          location: loc,
          lifestyles: lifes,
        })
      );
    } catch (error) {
      console.error('Failed to save preferences:', error);
      throw error; // Re-throw to allow caller to handle
    }
  };

  // Atomic update functions with rollback on storage failure
  const setTransactionType = async (type: TransactionType): Promise<void> => {
    const previousType = transactionType;
    setTransactionTypeState(type);
    try {
      await savePreferences(type, location, lifestyles);
    } catch (error) {
      // Rollback state on storage failure
      setTransactionTypeState(previousType);
      throw error;
    }
  };

  const setLocation = async (loc: string): Promise<void> => {
    const previousLocation = location;
    setLocationState(loc);
    try {
      await savePreferences(transactionType, loc, lifestyles);
    } catch (error) {
      // Rollback state on storage failure
      setLocationState(previousLocation);
      throw error;
    }
  };

  const setLifestyles = async (lifes: LifestyleType[]): Promise<void> => {
    const previousLifestyles = lifestyles;
    setLifestylesState(lifes);
    try {
      await savePreferences(transactionType, location, lifes);
    } catch (error) {
      // Rollback state on storage failure
      setLifestylesState(previousLifestyles);
      throw error;
    }
  };

  // Main atomic update function with complete rollback on failure
  const updatePreferences = async (type: TransactionType, loc: string, lifes: LifestyleType[]): Promise<void> => {
    // Store previous values for rollback
    const previousType = transactionType;
    const previousLocation = location;
    const previousLifestyles = lifestyles;
    
    // Update all state first (synchronous)
    setTransactionTypeState(type);
    setLocationState(loc);
    setLifestylesState(lifes);
    
    try {
      // Then save to storage (asynchronous) - this ensures consistency
      await savePreferences(type, loc, lifes);
    } catch (error) {
      // Rollback all state on storage failure
      setTransactionTypeState(previousType);
      setLocationState(previousLocation);
      setLifestylesState(previousLifestyles);
      throw error;
    }
  };

  return {
    transactionType,
    location,
    lifestyles,
    setTransactionType,
    setLocation,
    setLifestyles,
    updatePreferences,
  };
});
