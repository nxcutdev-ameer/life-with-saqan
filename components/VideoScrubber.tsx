import { scaleHeight } from '@/utils/responsive';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  GestureResponderEvent,
  PanResponder,
  PanResponderGestureState,
  View,
  ViewStyle,
} from 'react-native';

export type VideoScrubberProps = {
  /** Current playback time (seconds) */
  currentTime: number;
  /** Duration (seconds) */
  duration: number;
  /** Called when user taps/drags */
  onSeek: (seconds: number) => void;
  /** Called when user starts dragging */
  onScrubStart?: () => void;
  /** Called when user ends dragging */
  onScrubEnd?: () => void;
  /** Optional styles for outer container */
  style?: ViewStyle | ViewStyle[];
  /** Track color */
  trackColor?: string;
  /** Fill color */
  fillColor?: string;
  /** Height of the track */
  height?: number;
  /** Whether to show a draggable thumb */
  showThumb?: boolean;
  /** Thumb size in px */
  thumbSize?: number;
  /** Thumb color */
  thumbColor?: string;
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

//Lightweight scrubbable progress bar Uses an Animated.Value for smoothness between updates.
 
export function VideoScrubber({
  currentTime,
  duration,
  onSeek,
  onScrubStart,
  onScrubEnd,
  style,
  trackColor = 'rgba(255,255,255,0.25)',
  fillColor = '#FFFFFF',
  height = 3,
  showThumb = true,
  thumbSize = scaleHeight(16),
  thumbColor,
}: VideoScrubberProps) {
  const barRef = useRef<View>(null);

  const [containerWidth, setContainerWidth] = useState(0);
  const [barLeftX, setBarLeftX] = useState(0);
  const isScrubbingRef = useRef(false);

  const onScrubStartRef = useRef<VideoScrubberProps['onScrubStart']>(onScrubStart);
  const onScrubEndRef = useRef<VideoScrubberProps['onScrubEnd']>(onScrubEnd);

  useEffect(() => {
    onScrubStartRef.current = onScrubStart;
    onScrubEndRef.current = onScrubEnd;
  }, [onScrubStart, onScrubEnd]);

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

  const animatedThumbTranslateX = useMemo(() => {
    const half = thumbSize / 2;
    return animatedProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [-half, Math.max(-half, containerWidth - half)],
      extrapolate: 'clamp',
    });
  }, [animatedProgress, containerWidth, thumbSize]);

  const seekToProgress = React.useCallback(
    (p01: number) => {
      if (!Number.isFinite(duration) || duration <= 0) return;
      onSeek(clamp01(p01) * duration);
    },
    [duration, onSeek]
  );

  const updateFromMoveX = React.useCallback(
    (moveX: number) => {
      if (containerWidth <= 0) return;
      const localX = moveX - barLeftX;
      const p01 = clamp01(localX / containerWidth);

      animatedProgress.stopAnimation();
      animatedProgress.setValue(p01);

      seekToProgress(p01);
    },
    [animatedProgress, barLeftX, containerWidth, seekToProgress]
  );

  const ensureBarMeasurement = React.useCallback(() => {
    barRef.current?.measureInWindow((x) => {
      setBarLeftX(x);
    });
  }, []);

  const panResponder = useMemo(() => {
    const shouldSet = (_evt: GestureResponderEvent, _gs: PanResponderGestureState) => {
      return Number.isFinite(duration) && duration > 0;
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: shouldSet,
      onMoveShouldSetPanResponder: shouldSet,
      onPanResponderGrant: (_evt, gestureState) => {
        onScrubStartRef.current?.();
        isScrubbingRef.current = true;
        ensureBarMeasurement();
        updateFromMoveX(gestureState.x0);
      },
      onPanResponderMove: (_evt, gestureState) => {
        updateFromMoveX(gestureState.moveX);
      },
      onPanResponderRelease: (_evt, gestureState) => {
        onScrubEndRef.current?.();
        updateFromMoveX(gestureState.moveX);
        isScrubbingRef.current = false;
      },
      onPanResponderTerminate: () => {
        onScrubEndRef.current?.();
        isScrubbingRef.current = false;
      },
    });
  }, [duration, ensureBarMeasurement, updateFromMoveX]);

  const resolvedThumbColor = thumbColor ?? fillColor;

  return (
    <View
      ref={barRef}
      style={[
        {
          width: '100%',
          height: Math.max(height, thumbSize),
          justifyContent: 'center',
        },
        style,
      ]}
      onLayout={(e) => {
        setContainerWidth(e.nativeEvent.layout.width);
        requestAnimationFrame(ensureBarMeasurement);
      }}
      {...panResponder.panHandlers}
    >
      {/* Track */}
      <View
        style={{
          height,
          backgroundColor: trackColor,
          borderRadius: height / 2,
          overflow: 'hidden',
        }}
      >
        <Animated.View style={{ width: animatedWidth, height: '100%', backgroundColor: fillColor }} />
      </View>

      {/* Thumb */}
      {showThumb && (
        <Animated.View
          style={{
            position: 'absolute',
            left: 0,
            transform: [{ translateX: animatedThumbTranslateX }],
            width: thumbSize,
            height: thumbSize,
            borderRadius: thumbSize / 2,
            backgroundColor: resolvedThumbColor,
            borderWidth: 0.5,
            borderColor: 'rgba(0,0,0,0.25)',
          }}
        />
      )}
    </View>
  );
}
