import React, { useState } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView, ImageBackground } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Check } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import { TransactionType, LifestyleType } from '@/types';
import { lifestyleOptions } from '@/mocks/properties';

export default function LifestyleScreen() {
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

    router.push({
      pathname: '/(tabs)/feed',
      params: {
        transactionType,
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
                        <Check size={24} color={Colors.textLight} />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
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
    borderColor: Colors.bronze,
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
    backgroundColor: Colors.bronze,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lifestyleInfo: {
    gap: 8,
  },
  lifestyleName: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textLight,
    letterSpacing: 1,
  },
  lifestyleTagline: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textLight,
  },
  lifestyleDescription: {
    fontSize: 14,
    color: Colors.textLight,
    lineHeight: 20,
    opacity: 0.9,
  },
  footer: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  continueButton: {
    backgroundColor: Colors.bronze,
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: Colors.textSecondary,
  },
  continueButtonText: {
    color: Colors.textLight,
    fontSize: 16,
    fontWeight: '600',
  },
});
