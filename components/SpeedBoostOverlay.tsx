import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { FastForward } from 'lucide-react-native';

import { Colors } from '@/constants/colors';
import { scaleFont, scaleHeight, scaleWidth } from '@/utils/responsive';

type Props = {
  visible: boolean;
  bottom: number;
};

/**
 * Instagram-like "2x" speed indicator with a repeating glassy streak.
 * Render it absolutely above the progress bar.
 */
export default function SpeedBoostOverlay({ visible, bottom }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const streak = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  // Streak should cross only within the bounds of the icon+text.
  const streakTranslateX = useMemo(
    () =>
      streak.interpolate({
        inputRange: [0, 1],
        outputRange: [-scaleWidth(40), scaleWidth(40)],
      }),
    [streak]
  );

  useEffect(() => {
    if (visible) {
      // Fade in quickly
      Animated.timing(opacity, {
        toValue: 1,
        duration: 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();

      // Start streak loop
      streak.setValue(0);
      loopRef.current?.stop();
      loopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(streak, {
            toValue: 1,
            duration: 520,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(streak, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.delay(220),
        ])
      );
      loopRef.current.start();
      return;
    }

    // Fade out and stop
    Animated.timing(opacity, {
      toValue: 0,
      duration: 120,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
    loopRef.current?.stop();
  }, [opacity, streak, visible]);

  return (
    <Animated.View
      style={[styles.container, { bottom, opacity }]}
      pointerEvents={visible ? 'none' : 'none'}
    >
      <View style={styles.contentWrap}>
        <View style={styles.clipWrap}>
          <View style={styles.contentRow}>
            <Text style={styles.text}>2x</Text>
            <FastForward size={16} color={Colors.textLight} fill={"#fff"}/>
          </View>
          {/* Glassy streak crossing over the icon + text */}
            <Animated.View
            style={[
              styles.streak,
              {
                transform: [{ translateX: streakTranslateX }, { rotate: '-18deg' }],
              },
            ]}
          />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 260,
    elevation: 260,
  },
  contentWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scaleWidth(10),
    paddingVertical: scaleHeight(6),
  },
  clipWrap: {
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: scaleWidth(10),
    paddingHorizontal: scaleWidth(4),
    paddingVertical: scaleHeight(2),
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scaleWidth(8),
  },
  text: {
    color: Colors.textLight,
    fontSize: scaleFont(16),
    fontWeight: '600',
  },
  streak: {
    position: 'absolute',
    top: -scaleHeight(18),
    width: scaleWidth(26),
    height: scaleHeight(90),
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
});
