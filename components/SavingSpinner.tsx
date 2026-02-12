import React, { useEffect, useMemo, useRef } from 'react';
import type { ViewStyle } from 'react-native';
import { ActivityIndicator, Animated, Easing, Platform } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors } from '@/constants/colors';

type BaseProps = {
  size?: number;
  color?: string;
  /**
   * When false, renders nothing.
   * Mirrors React Native's `ActivityIndicator` API.
   */
  animating?: boolean;
  /** Optional container style (useful for overlays / alignment). */
  style?: ViewStyle;
  testID?: string;
  accessibilityLabel?: string;
};

const IosSavingSpinner = ({
  size = 38,
  color = Colors.bronze,
  animating = true,
  style,
  testID,
  accessibilityLabel = 'Loading',
}: BaseProps) => {
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animating) return;

    const animation = Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 250, // a bit faster
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    animation.start();
    return () => animation.stop();
  }, [rotate, animating]);

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const strokeWidth = Math.max(6, Math.round(size / 10));
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  // Draw an arc (not a full circle) so the ends are visible and rounded.
  const arcPortion = 0.52;
  const dash = circumference * arcPortion;
  const gap = circumference - dash;

  if (!animating) return null;

  return (
    <Animated.View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      style={[
        // Keep a stable layout box so rotation never causes "orbiting" in flex layouts.
        { width: size, height: size, alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
    >
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <Svg width={size} height={size}>
        {/* Tail (thin) */}
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth * 0.6}
          strokeLinecap="round"
          fill="transparent"
          strokeDasharray={`${dash * 0.65} ${gap}`}
          opacity={0.6}
        />

        {/* Mid */}
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth * 0.7}
          strokeLinecap="round"
          fill="transparent"
          strokeDasharray={`${dash * 0.7} ${gap}`}
          opacity={0.8}
        />

        {/* Head (thick) */}
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="transparent"
          strokeDasharray={`${dash} ${gap}`}
        />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
};

export const SavingSpinner = ({
  size,
  color = Colors.bronze,
  animating = true,
  style,
  testID,
  accessibilityLabel,
}: BaseProps) => {
  const nonIosIndicatorSize = useMemo(() => {
    if (typeof size !== 'number') return 'large' as const;
    return size >= 36 ? ('large' as const) : ('small' as const);
  }, [size]);

  if (Platform.OS === 'ios') {
    return (
      <IosSavingSpinner
        size={size}
        color={color}
        animating={animating}
        style={style}
        testID={testID}
        accessibilityLabel={accessibilityLabel}
      />
    );
  }

  if (!animating) return null;

  return (
    <ActivityIndicator
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? 'Loading'}
      style={style}
      size={nonIosIndicatorSize}
      color={color}
    />
  );
};
