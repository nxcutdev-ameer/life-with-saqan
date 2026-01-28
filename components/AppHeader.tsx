import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { scaleFont, scaleHeight, scaleWidth } from '@/utils/responsive';
import { Search } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';

interface AppHeaderProps {
  onSearchPress: () => void;
  onSelectionsPress: () => void;
}

export default function AppHeader({ onSearchPress, onSelectionsPress }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const { transactionType, location, lifestyles } = useUserPreferences();

  const getLifestyleDisplay = () => {
    if (lifestyles.length === 0) return 'Lifestyle';
    if (lifestyles.length === 1) {
      return lifestyles[0] === 'CITY_LIVING' ? 'City Living' : lifestyles[0].charAt(0) + lifestyles[0].slice(1).toLowerCase();
    }
    return `${lifestyles.length} Lifestyles`;
  };

  const lifestyleDisplay = getLifestyleDisplay();

  return (
    <View style={[styles.header, { paddingTop: insets.top + scaleHeight(12) }]}>
      <Pressable style={styles.selectionsContainer} onPress={onSelectionsPress}>
        <Text
          style={[styles.selectionText, styles.inactiveText]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {transactionType.charAt(0) + transactionType.slice(1).toLowerCase()}
        </Text>
        
        <View style={styles.locationContainer}>
          <Text
            style={[
              styles.selectionText, 
              transactionType === 'STAY' ? styles.inactiveText : styles.activeText
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {location}
          </Text>
          {transactionType !== 'STAY' && (
            <>
              <View style={styles.lifestyleUnderline} />
              {/* <View style={styles.lifestyleDot} /> */}
            </>
          )}
        </View>

        {transactionType === 'STAY' && (
          <View style={styles.lifestyleContainer}>
            <Text
              style={[styles.selectionText, styles.activeText]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {lifestyleDisplay}
            </Text>
            <View style={styles.lifestyleUnderline} />
            {/* <View style={styles.lifestyleDot} /> */}
          </View>
        )}
      </Pressable>

      <Pressable style={styles.iconButton} onPress={onSearchPress}>
        <Search size={scaleFont(24)} color={Colors.textLight} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: scaleHeight(12),
    paddingBottom: scaleHeight(16),
    paddingHorizontal: scaleWidth(15), //20
  },
  selectionsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(20),
    minWidth: 0,
  },
  selectionText: {
    fontSize: scaleFont(16),
    fontWeight: '500',
    color: Colors.textLight,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: scaleWidth(4),
    flexShrink: 1,
  },
  inactiveText: {
    opacity: 0.5,
  },
  activeText: {
    fontWeight: '700',
    opacity: 1,
  },
  locationContainer: {
    position: 'relative' as const,
    flexShrink: 1,
    minWidth: 0,
  },
  lifestyleContainer: {
    position: 'relative' as const,
    flexShrink: 1,
    minWidth: 0,
  },
  lifestyleUnderline: {
    position: 'absolute' as const,
    bottom: -scaleHeight(4),
    left: '50%',
    height: scaleHeight(3),
    backgroundColor: '#E53935',
    borderRadius: scaleWidth(2),
    width: scaleWidth(26),
    transform: [{ translateX: -scaleWidth(13) }],
  },
  lifestyleDot: {
    position: 'absolute' as const,
    top: -scaleHeight(6), //-scaleHeight(10)
    right: -scaleWidth(6),  //scaleWidth(45)
    width: scaleWidth(8),
    height: scaleWidth(8),
    borderRadius: scaleWidth(4),
    backgroundColor: '#E53935',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.67)',
  },
  iconButton: {
    padding: scaleWidth(8),
  },
});
