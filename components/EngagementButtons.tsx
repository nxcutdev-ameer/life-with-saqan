import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Text, Pressable, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Property } from '@/types';
import { formatEngagementMetric } from '@/utils/formatters';
import { feedStyles as styles } from '@/constants/feedStyles';
import Colors from '@/constants/colors';

interface EngagementButtonsProps {
  item: Property;
  isLiked: boolean;
  isSaved: boolean;
  onToggleLike: (propertyId: string) => void;
  onToggleSave: (propertyId: string) => void;
  onOpenComments: (propertyId: string) => void;
  onShare?: (propertyId: string) => void;
}

/**
 * Displays engagement action buttons (like, comment, save, share)
 * Shown in the right section of the property footer
 */
export default function EngagementButtons({
  item,
  isLiked,
  isSaved,
  onToggleLike,
  onToggleSave,
  onOpenComments,
  onShare,
}: EngagementButtonsProps) {
  const heartScale = useRef(new Animated.Value(1)).current;
  const heartBurstOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Modern "pop" animation when toggling like
    if (isLiked) {
      heartScale.setValue(0.9);
      heartBurstOpacity.setValue(0);

      Animated.parallel([
        Animated.spring(heartScale, {
          toValue: 1.12,
          stiffness: 280,
          damping: 16,
          mass: 0.75,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(heartBurstOpacity, {
            toValue: 1,
            duration: 90,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(heartBurstOpacity, {
            toValue: 0,
            duration: 260,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        Animated.spring(heartScale, {
          toValue: 1,
          stiffness: 220,
          damping: 16,
          mass: 0.9,
          useNativeDriver: true,
        }).start();
      });
    } else {
      Animated.spring(heartScale, {
        toValue: 1,
        stiffness: 220,
        damping: 18,
        mass: 1,
        useNativeDriver: true,
      }).start();
    }
  }, [heartBurstOpacity, heartScale, isLiked]);

  const heartAnimatedStyle = {
    transform: [{ scale: heartScale }],
  } as const;

  return (
    <View style={styles.footerActionsBar}>
      <Pressable
        style={[styles.footerActionButton, styles.iconShadow]}
        onPress={() => {
          // Immediate tactile response even before parent state updates
          Animated.spring(heartScale, {
            toValue: 0.92,
            stiffness: 300,
            damping: 18,
            mass: 0.7,
            useNativeDriver: true,
          }).start();
          onToggleLike(item.id);
        }}
      >
        <Animated.View style={heartAnimatedStyle}>
          {/* Subtle burst behind heart when liked */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: -10,
              top: -10,
              width: 45,
              height: 45,
              borderRadius: 22.5,
              backgroundColor: 'rgba(255, 59, 48, 0.35)',
              opacity: heartBurstOpacity,
              transform: [
                {
                  scale: heartBurstOpacity.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.6, 1.2],
                  }),
                },
              ],
            }}
          />
          <MaterialCommunityIcons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={25}
            color={isLiked ? '#FF3B30' : '#FFFFFF'}
          />
        </Animated.View>
        <Text style={styles.footerActionText}>
          {formatEngagementMetric(item.likesCount)}
        </Text>
      </Pressable>

      <Pressable style={[styles.footerActionButton, styles.iconShadow]} onPress={() => onOpenComments(item.id)}>
        <MaterialCommunityIcons name="chat" size={25} color="#FFFFFF" />
        <Text style={styles.footerActionText}>
          {formatEngagementMetric(item.commentsCount)}
        </Text>
      </Pressable>

      <Pressable style={[styles.footerActionButton, styles.iconShadow]} onPress={() => onToggleSave(item.id)}>
        <MaterialCommunityIcons
          name={isSaved ? 'bookmark' : 'bookmark-outline'}
          size={25}
          color={isSaved ?Colors.bronze: "#ffff"}
        />
        <Text style={styles.footerActionText}>
          {formatEngagementMetric(item.savesCount)}
        </Text>
      </Pressable>

      <Pressable
        style={[styles.footerActionButton, styles.iconShadow]}
        onPress={() => onShare && onShare(item.id)}
      >
        <MaterialCommunityIcons name="share-variant" size={25} color="#FFFFFF" />
        <Text style={styles.footerActionText}>
          {formatEngagementMetric(item.sharesCount)}
        </Text>
      </Pressable>
    </View>
  );
}
