import React, { useState, useMemo } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView, ImageBackground } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Check } from 'lucide-react-native';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import { TransactionType, LifestyleType } from '@/types';
import { lifestyleOptions } from '@/mocks/properties';
import { preloadFeedFromCacheBeforeNavigate } from '@/utils/preloadFeedFromCache';
import type { ThemeColors } from '@/constants/theme';
import { useTheme } from '@/utils/useTheme';

export default function LifestyleScreen() {
  const { colors: themeColors } = useTheme();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const router = useRouter();
  const params = useLocalSearchParams<{ transactionType: string; location: string }>();
  const { updatePreferences } = useUserPreferences();
  const [selectedLifestyles, setSelectedLifestyles] = useState<LifestyleType[]>([]);

  const toggleLifestyle = (lifestyle: LifestyleType) => {
    setSelectedLifestyles(prev =>
      prev.includes(lifestyle)
        ? prev.filter(l => l !== lifestyle)
        : [...prev, lifestyle]
    );
  };

  const handleContinue = () => {
    const transactionType = (params.transactionType as TransactionType) || 'RENT';
    const location = (params.location as string) || 'Dubai';

    // Persist to global preferences so AppHeader reflects the chosen values.
    updatePreferences(transactionType, location, selectedLifestyles);

    // Use LandingScreen-warmed cache to prepare the exact feed (strict type+city) before navigating.
    // Commit filtered items synchronously (fast, from cache) so Feed mounts already filtered.
    // Warm players in background so we don't block navigation on player init.
    const backendTransactionType = transactionType === 'BUY' ? 'SALE' : transactionType;

    preloadFeedFromCacheBeforeNavigate({ transactionType: backendTransactionType, city: location }, { warmPlayers: false })
      .catch(() => {
        // Ignore preload failures; feed will load normally.
      })
      .finally(() => {
        preloadFeedFromCacheBeforeNavigate({ transactionType: backendTransactionType, city: location }, { warmPlayers: true }).catch(() => {});
      });

    router.push({
      pathname: '/(tabs)/feed',
      params: {
        transactionType: backendTransactionType,
        location,
        lifestyles: selectedLifestyles.join(','),
      },
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Choose Your Lifestyle</Text>
        <Text style={styles.subtitle}>
          Select one or more lifestyles that resonate with you
        </Text>

        <View style={styles.lifestyleGrid}>
          {lifestyleOptions.map((lifestyle) => {
            const isSelected = selectedLifestyles.includes(lifestyle.id);
            
            return (
              <Pressable
                key={lifestyle.id}
                style={[
                  styles.lifestyleCard,
                  isSelected && styles.lifestyleCardSelected,
                ]}
                onPress={() => toggleLifestyle(lifestyle.id)}
              >
                <ImageBackground
                  source={{ uri: lifestyle.imageUrl }}
                  style={styles.lifestyleImage}
                  resizeMode="cover"
                >
                  <LinearGradient
                    colors={['transparent', 'rgba(61, 61, 61, 0.9)']}
                    style={styles.lifestyleGradient}
                  >
                    {isSelected && (
                      <View style={styles.checkmark}>
                        <Check size={24} color={themeColors.white} />
                      </View>
                    )}
                    
                    <View style={styles.lifestyleInfo}>
                      <Text style={styles.lifestyleName}>{lifestyle.name}</Text>
                      <Text style={styles.lifestyleTagline}>{lifestyle.tagline}</Text>
                      <Text style={styles.lifestyleDescription} numberOfLines={3}>
                        {lifestyle.description}
                      </Text>
                    </View>
                  </LinearGradient>
                </ImageBackground>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[
            styles.continueButton,
            selectedLifestyles.length === 0 && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={selectedLifestyles.length === 0}
        >
          <Text style={styles.continueButtonText}>
            {selectedLifestyles.length === 0
              ? 'Select at least one lifestyle'
              : `Continue with ${selectedLifestyles.length} lifestyle${selectedLifestyles.length > 1 ? 's' : ''}`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (themeColors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themeColors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 120,
  },
  title: {
    fontSize: 36,
    fontWeight: '600',
    color: themeColors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: themeColors.textSecondary,
    marginBottom: 32,
  },
  lifestyleGrid: {
    gap: 20,
  },
  lifestyleCard: {
    height: 320,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  lifestyleCardSelected: {
    borderColor: themeColors.primary,
  },
  lifestyleImage: {
    flex: 1,
  },
  lifestyleGradient: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 20,
  },
  checkmark: {
    alignSelf: 'flex-end',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: themeColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lifestyleInfo: {
    gap: 8,
  },
  lifestyleName: {
    fontSize: 28,
    fontWeight: '700',
    color: themeColors.white,
    letterSpacing: 1,
  },
  lifestyleTagline: {
    fontSize: 16,
    fontWeight: '600',
    color: themeColors.white,
  },
  lifestyleDescription: {
    fontSize: 14,
    color: themeColors.white,
    lineHeight: 20,
    opacity: 0.9,
  },
  footer: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    backgroundColor: themeColors.background,
    borderTopWidth: 1,
    borderTopColor: themeColors.border,
  },
  continueButton: {
    backgroundColor: themeColors.primary,
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: themeColors.textSecondary,
  },
  continueButtonText: {
    color: themeColors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
