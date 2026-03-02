import React, { useState, useMemo } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import type { ThemeColors } from '@/constants/theme';
import { useTheme } from '@/utils/useTheme';
import { preloadFeedFromCacheBeforeNavigate } from '@/utils/preloadFeedFromCache';
import { TransactionType } from '@/types';
import { cities } from '@/mocks/properties';
import { Platform } from 'react-native';

import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import { scaleFont } from '@/utils/responsive';

export default function LocationsScreen() {
  const { colors: themeColors, isDarkMode } = useTheme();
  const styles = useMemo(() => createStyles(themeColors, isDarkMode), [themeColors, isDarkMode]);
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

const createStyles = (themeColors: ThemeColors, isDarkMode: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themeColors.background,
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: Platform.OS === 'android' ? scaleFont(22): scaleFont(42),
    fontWeight: '600',
    color: themeColors.text,
    marginBottom: 32,
  },
  transactionTabs: {
    flexDirection: 'row',
    gap: 32,
    marginBottom: 40,
    borderBottomWidth: 1,
    borderBottomColor: themeColors.border,
  },
  tab: {
    paddingBottom: 12,
    paddingTop: 12,
    position: 'relative' as const,
  },
  tabActive: {
    backgroundColor: isDarkMode ? themeColors.black : themeColors.text,
    paddingHorizontal: 16,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  tabText: {
    fontSize: Platform.OS === 'android' ? scaleFont(14): scaleFont(16),
    fontWeight: '500',
    color: themeColors.textSecondary,
  },
  tabTextActive: {
    color: themeColors.white,
  },
  tabUnderline: {
    position: 'absolute' as const,
    bottom: -1,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: themeColors.primary,
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
    borderColor: themeColors.border,
    backgroundColor: themeColors.background,
  },
  cityChipSelected: {
    backgroundColor: isDarkMode ? themeColors.black : themeColors.primary,
    borderColor: isDarkMode ? themeColors.black : themeColors.primary,
  },
  cityText: {
    fontSize: Platform.OS === 'android' ? scaleFont(14): scaleFont(16),
    fontWeight: '500',
    color: themeColors.text,
  },
  cityTextSelected: {
    color: themeColors.white,
  },
});
