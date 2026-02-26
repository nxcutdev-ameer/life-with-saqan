import React, { useState } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { preloadFeedFromCacheBeforeNavigate } from '@/utils/preloadFeedFromCache';
import { Colors } from '@/constants/colors';
import { TransactionType } from '@/types';
import { cities } from '@/mocks/properties';
import { Platform } from 'react-native';

import { useUserPreferences } from '@/contexts/UserPreferencesContext';

export default function LocationsScreen() {
  const router = useRouter();
  const { updatePreferences, lifestyles } = useUserPreferences();

  // Background preference sync with retry logic
  const syncPreferencesInBackground = async (type: TransactionType, location: string, lifestyles: any[]) => {
    try {
      await updatePreferences(type, location, lifestyles);
    } catch (error) {
      console.warn('Failed to sync preferences, retrying...', error);
      // Retry once after 1 second
      setTimeout(async () => {
        try {
          await updatePreferences(type, location, lifestyles);
        } catch (retryError) {
          console.error('Failed to sync preferences after retry:', retryError);
        }
      }, 1000);
    }
  };
  const [transactionType, setTransactionType] = useState<TransactionType>('RENT');
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  const handleCitySelect = (city: string) => {
    setSelectedCity(city);
    
    // Navigate immediately
    if (transactionType === 'STAY') {
      router.push({
        pathname: '/lifestyle',
        params: {
          transactionType,
          location: city,
        },
      });
    } else {
      const backendTransactionType = transactionType === 'BUY' ? 'SALE' : transactionType;
      router.push({
        pathname: '/(tabs)/feed',
        params: {
          transactionType: backendTransactionType,
          location: city,
        },
      });
    }

    // Android optimization: Defer all background tasks to next tick
    if (Platform.OS === 'android') {
      // Use setImmediate to push to next event loop (Android-specific optimization)
      setImmediate(() => {
        syncPreferencesInBackground(transactionType, city, lifestyles);
        if (transactionType !== 'STAY') {
          const backendTransactionType = transactionType === 'BUY' ? 'SALE' : transactionType;
          preloadFeedFromCacheBeforeNavigate({ transactionType: backendTransactionType, city }, { warmPlayers: false })
            .catch(() => {});
        }
      });
    } else {
      // iOS: Original background task handling
      syncPreferencesInBackground(transactionType, city, lifestyles);
      if (transactionType !== 'STAY') {
        const backendTransactionType = transactionType === 'BUY' ? 'SALE' : transactionType;
        preloadFeedFromCacheBeforeNavigate({ transactionType: backendTransactionType, city }, { warmPlayers: false })
          .catch(() => {});
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Locations</Text>

      <View style={styles.transactionTabs}>
        {(['BUY', 'RENT', 'STAY'] as TransactionType[]).map((type) => (
          <Pressable
            key={type}
            style={[
              styles.tab,
              transactionType === type && styles.tabActive,
            ]}
            onPress={() => setTransactionType(type)}
          >
            <Text
              style={[
                styles.tabText,
                transactionType === type && styles.tabTextActive,
              ]}
            >
              {type}
            </Text>
            {transactionType === type && <View style={styles.tabUnderline} />}
          </Pressable>
        ))}
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.citiesContainer}
        showsVerticalScrollIndicator={false}
      >
        {cities.map((city) => (
          <Pressable
            key={city}
            style={[
              styles.cityChip,
              selectedCity === city && styles.cityChipSelected,
            ]}
            onPress={() => handleCitySelect(city)}
          >
            <Text
              style={[
                styles.cityText,
                selectedCity === city && styles.cityTextSelected,
              ]}
            >
              {city}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: Platform.select({ ios: 42, android: 32 }),
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 32,
  },
  transactionTabs: {
    flexDirection: 'row',
    gap: 32,
    marginBottom: 40,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    paddingBottom: 12,
    paddingTop: 12,
    position: 'relative' as const,
  },
  tabActive: {
    backgroundColor: Colors.text,
    paddingHorizontal: 16,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.textLight,
  },
  tabUnderline: {
    position: 'absolute' as const,
    bottom: -1,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: Colors.bronze,
  },
  scrollView: {
    flex: 1,
  },
  citiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingBottom: 40,
  },
  cityChip: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  cityChipSelected: {
    backgroundColor: Colors.bronze,
    borderColor: Colors.bronze,
  },
  cityText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
  cityTextSelected: {
    color: Colors.textLight,
  },
});
