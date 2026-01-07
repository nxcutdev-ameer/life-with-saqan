import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  GestureResponderEvent,
  PanResponder,
  PanResponderGestureState,
  View,
} from 'react-native';
import { feedStyles as styles } from '@/constants/feedStyles';

interface PropertyProgressBarProps {
  currentTime: number;
  duration: number;
  onSeek: (timestamp: number) => void;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

/**
 * Video progress bar with scrubbing:
 * - Tap anywhere to jump
 * - Drag to scrub
 *
 * While scrubbing we pause the "live" animation updates so the finger wins.
 */
export default function PropertyProgressBar({ currentTime, duration, onSeek }: PropertyProgressBarProps) {
  const barRef = useRef<View>(null);

  const [containerWidth, setContainerWidth] = useState(0);
  const [barLeftX, setBarLeftX] = useState(0);
  const isScrubbingRef = useRef(false);

  const progress01 = useMemo(() => {
    if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0) return 0;
    return clamp01(currentTime / duration);
  }, [currentTime, duration]);

  const animatedProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isScrubbingRef.current) return;

    Animated.timing(animatedProgress, {
      toValue: progress01,
      duration: 120,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [animatedProgress, progress01]);

  const animatedWidth = useMemo(() => {
    return animatedProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, containerWidth],
      extrapolate: 'clamp',
    });
  }, [animatedProgress, containerWidth]);

  const seekToProgress = React.useCallback(
    (p01: number) => {
      if (!Number.isFinite(duration) || duration <= 0) return;
      const next = clamp01(p01) * duration;
      onSeek(next);
    },
    [duration, onSeek]
  );

  const updateFromMoveX = React.useCallback(
    (moveX: number) => {
      if (containerWidth <= 0) return;
      const localX = moveX - barLeftX;
      const p01 = clamp01(localX / containerWidth);

      // Make the bar follow the finger immediately.
      animatedProgress.stopAnimation();
      animatedProgress.setValue(p01);

      seekToProgress(p01);
    },
    [animatedProgress, barLeftX, containerWidth, seekToProgress]
  );

  const ensureBarMeasurement = () => {
    barRef.current?.measureInWindow((x) => {
      setBarLeftX(x);
    });
  };

  const panResponder = useMemo(() => {
    const onStart = (_evt: GestureResponderEvent, _gs: PanResponderGestureState) => {
      // Don't steal touches if we cannot seek.
      return Number.isFinite(duration) && duration > 0;
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: onStart,
      onMoveShouldSetPanResponder: onStart,
      onPanResponderGrant: (_evt, gestureState) => {
        isScrubbingRef.current = true;
        ensureBarMeasurement();
        updateFromMoveX(gestureState.x0);
      },
      onPanResponderMove: (_evt, gestureState) => {
        updateFromMoveX(gestureState.moveX);
      },
      onPanResponderRelease: (_evt, gestureState) => {
        updateFromMoveX(gestureState.moveX);
        isScrubbingRef.current = false;
      },
      onPanResponderTerminate: () => {
        isScrubbingRef.current = false;
      },
    });
  }, [duration, updateFromMoveX]);

  return (
    <View
      ref={barRef}
      style={styles.progressBarContainer}
      onLayout={(e) => {
        setContainerWidth(e.nativeEvent.layout.width);
        // Update left edge after layout so taps/drags map correctly.
        requestAnimationFrame(ensureBarMeasurement);
      }}
      {...panResponder.panHandlers}
    >
      <Animated.View style={[styles.progressBar, { width: animatedWidth }]} />
    </View>
  );
}
