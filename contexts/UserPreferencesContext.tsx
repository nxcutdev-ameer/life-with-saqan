import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { TransactionType, LifestyleType } from '@/types';

interface UserPreferencesState {
  transactionType: TransactionType;
  location: string;
  lifestyles: LifestyleType[];
  setTransactionType: (type: TransactionType) => void;
  setLocation: (location: string) => void;
  setLifestyles: (lifestyles: LifestyleType[]) => void;
  updatePreferences: (transactionType: TransactionType, location: string, lifestyles: LifestyleType[]) => void;
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

  const savePreferences = async (type: TransactionType, loc: string, lifes: LifestyleType[]) => {
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
      console.log('Error saving preferences:', error);
    }
  };

  const setTransactionType = (type: TransactionType) => {
    setTransactionTypeState(type);
    savePreferences(type, location, lifestyles);
  };

  const setLocation = (loc: string) => {
    setLocationState(loc);
    savePreferences(transactionType, loc, lifestyles);
  };

  const setLifestyles = (lifes: LifestyleType[]) => {
    setLifestylesState(lifes);
    savePreferences(transactionType, location, lifes);
  };

  const updatePreferences = (type: TransactionType, loc: string, lifes: LifestyleType[]) => {
    setTransactionTypeState(type);
    setLocationState(loc);
    setLifestylesState(lifes);
    savePreferences(type, loc, lifes);
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
