import React, { useState } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView, Modal, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Check, X } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { TransactionType, LifestyleType } from '@/types';
import { cities, lifestyleOptions } from '@/mocks/properties';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';

interface LocationsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function LocationsModal({ visible, onClose }: LocationsModalProps) {
  const { transactionType, location, lifestyles, updatePreferences } = useUserPreferences();
  
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionType>(transactionType);
  const [selectedLocation, setSelectedLocation] = useState<string>(location);
  const [selectedLifestyles, setSelectedLifestyles] = useState<LifestyleType[]>(lifestyles);
  const [step, setStep] = useState<'selection' | 'lifestyle'>('selection');

  const handleTransactionSelect = (type: TransactionType) => {
    setSelectedTransaction(type);
    // Transaction + location as a single step
  };

  const handleLocationSelect = (city: string) => {
    setSelectedLocation(city);
    // Only proceed to lifestyle step if STAY is selected
    if (selectedTransaction === 'STAY') {
      setTimeout(() => setStep('lifestyle'), 200);
    } else {
      // For BUY/RENT, apply preferences immediately and close modal
      updatePreferences(selectedTransaction, city, []);
      onClose();
    }
  };

  const toggleLifestyle = (lifestyle: LifestyleType) => {
    setSelectedLifestyles(prev =>
      prev.includes(lifestyle)
        ? prev.filter(l => l !== lifestyle)
        : [...prev, lifestyle]
    );
  };

  const handleApply = () => {
    // Only apply lifestyles for STAY transaction type
    const finalLifestyles = selectedTransaction === 'STAY' ? selectedLifestyles : [];
    updatePreferences(selectedTransaction, selectedLocation, finalLifestyles);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          {step === 'lifestyle' ? (
            <Pressable onPress={() => setStep('selection')} style={styles.backButton}>
              <ArrowLeft size={24} color={Colors.text} />
            </Pressable>
          ) : (
            <View style={{ width: 24 }} />
          )}

          <Text style={styles.headerTitle}>{step === 'selection' ? 'Locations' : 'Choose Lifestyle'}</Text>

          <View style={{ width: 24 }} />
          <Pressable onPress={onClose} style={styles.closeButton}>
            <X size={24} color={Colors.text} />
          </Pressable>
        </View>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {step === 'selection' && (
            <View>
              <View style={styles.transactionTabs}>
                {(['BUY', 'RENT', 'STAY'] as TransactionType[]).map((type) => (
                  <Pressable
                    key={type}
                    style={[styles.tab, selectedTransaction === type && styles.tabActive]}
                    onPress={() => handleTransactionSelect(type)}
                  >
                    <Text style={[styles.tabText, selectedTransaction === type && styles.tabTextActive]}>
                      {type}
                    </Text>
                    {selectedTransaction === type && <View style={styles.tabUnderline} />}
                  </Pressable>
                ))}
              </View>

              <View style={styles.citiesContainer}>
                {cities.map((city) => (
                  <Pressable
                    key={city}
                    style={[styles.cityChip, selectedLocation === city && styles.cityChipSelected]}
                    onPress={() => handleLocationSelect(city)}
                  >
                    <Text style={[styles.cityText, selectedLocation === city && styles.cityTextSelected]}>
                      {city}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {step === 'lifestyle' && (
            <View>
              <Text style={styles.lifestyleTitle}>Select one or more lifestyles</Text>
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
                              <Check size={20} color={Colors.textLight} />
                            </View>
                          )}
                          
                          <View style={styles.lifestyleInfo}>
                            <Text style={styles.lifestyleName}>{lifestyle.name}</Text>
                            <Text style={styles.lifestyleTagline} numberOfLines={2}>
                              {lifestyle.tagline}
                            </Text>
                          </View>
                        </LinearGradient>
                      </ImageBackground>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                style={[
                  styles.applyButton,
                  selectedLifestyles.length === 0 && styles.applyButtonDisabled,
                ]}
                onPress={handleApply}
                disabled={selectedLifestyles.length === 0}
              >
                <Text style={styles.applyButtonText}>
                  {selectedLifestyles.length === 0
                    ? 'Select at least one lifestyle'
                    : 'Apply Changes'}
                </Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  closeButton: {
    padding: 4,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
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
  lifestyleTitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  lifestyleGrid: {
    gap: 16,
    marginBottom: 24,
  },
  lifestyleCard: {
    height: 240,
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
    padding: 16,
  },
  checkmark: {
    alignSelf: 'flex-end',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.bronze,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lifestyleInfo: {
    gap: 6,
  },
  lifestyleName: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textLight,
    letterSpacing: 0.5,
  },
  lifestyleTagline: {
    fontSize: 13,
    color: Colors.textLight,
    lineHeight: 18,
    opacity: 0.9,
  },
  applyButton: {
    backgroundColor: Colors.bronze,
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 40,
  },
  applyButtonDisabled: {
    backgroundColor: Colors.textSecondary,
  },
  applyButtonText: {
    color: Colors.textLight,
    fontSize: 16,
    fontWeight: '600',
  },
});
