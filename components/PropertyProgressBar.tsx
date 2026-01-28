import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  GestureResponderEvent,
  PanResponder,
  PanResponderGestureState,
  Text,
  View,
} from 'react-native';
import { feedStyles as styles } from '@/constants/feedStyles';
import { scaleHeight, scaleWidth } from '@/utils/responsive';

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface PropertyProgressBarProps {
  currentTime: number;
  duration: number;
  onSeek: (timestamp: number) => void;
  onScrubStart?: () => void;
  onScrubEnd?: () => void;

  /** Optional: show a time label above the bar (e.g. while scrubbing). */
  showTimeLabel?: boolean;
  /** Optional: override the "dragged" time shown in the label (seconds). */
  displayTime?: number;
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
export default function PropertyProgressBar({ currentTime, duration, onSeek, onScrubStart, onScrubEnd, showTimeLabel = false, displayTime }: PropertyProgressBarProps) {
  const barRef = useRef<View>(null);

  const [containerWidth, setContainerWidth] = useState(0);
  const [scrubTime, setScrubTime] = useState<number>(0);
  const [barLeftX, setBarLeftX] = useState(0);
  const isScrubbingRef = useRef(false);
  const [isScrubbing, setIsScrubbing] = useState(false);

  // Thumb: always visible (as a dot), grows while scrubbing.
  const thumbScale = useRef(new Animated.Value(0.2)).current;
  const barHeight = useRef(new Animated.Value(scaleHeight(3))).current;

  useEffect(() => {
    // Must be JS-driven because `animatedProgress` drives width (JS driver) and is also used
    // in the thumb translateX transform. Mixing native + JS drivers on connected nodes causes
    // "node moved to native earlier" runtime errors.
    Animated.parallel([
      Animated.timing(thumbScale, {
        toValue: isScrubbing ? 1.4 : 0.2,
        duration: 90,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(barHeight, {
        toValue: isScrubbing ? scaleHeight(3) + scaleHeight(2) : scaleHeight(3),
        duration: 140,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
  }, [barHeight, isScrubbing, thumbScale]);

  const progress01 = useMemo(() => {
    if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0) return 0;
    return clamp01(currentTime / duration);
  }, [currentTime, duration]);

  const labelTime = displayTime ?? (isScrubbing ? scrubTime : currentTime);

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

      const nextSeconds = clamp01(p01) * (Number.isFinite(duration) ? duration : 0);
      setScrubTime(nextSeconds);

      seekToProgress(p01);
    },
    [animatedProgress, barLeftX, containerWidth, duration, seekToProgress]
  );

  const ensureBarMeasurement = () => {
    barRef.current?.measureInWindow((x) => {
      setBarLeftX(x);
    });
  };

  const animatedThumbTranslateX = useMemo(() => {
    const thumbWidth = scaleWidth(14);
    const half = thumbWidth / 2;
    return animatedProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [-half, Math.max(-half, containerWidth - half)],
      extrapolate: 'clamp',
    });
  }, [animatedProgress, containerWidth]);

  const baseThumbSize = scaleWidth(14);
  const animatedThumbWidth = useMemo(() => Animated.multiply(thumbScale, baseThumbSize), [thumbScale]);
  // Use scaleWidth for height as well to ensure it stays a circle
  const animatedThumbHeight = useMemo(() => Animated.multiply(thumbScale, baseThumbSize), [thumbScale]);
  const animatedThumbMarginTop = useMemo(
    () => Animated.multiply(animatedThumbHeight, -0.5),
    [animatedThumbHeight]
  );

  const panResponder = useMemo(() => {
    const onStart = (_evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
      // Don't steal touches if we cannot seek.
      if (!(Number.isFinite(duration) && duration > 0)) return false;

      // If the finger is moving, we want to own the gesture (prevents losing the responder).
      const dx = Math.abs(gestureState.dx);
      const dy = Math.abs(gestureState.dy);
      return dx > 2 || dy > 2;
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: onStart,
      onMoveShouldSetPanResponder: onStart,
      onStartShouldSetPanResponderCapture: onStart,
      onMoveShouldSetPanResponderCapture: onStart,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (_evt, gestureState) => {
        onScrubStart?.();
        isScrubbingRef.current = true;
        setIsScrubbing(true);

        const { locationX } = _evt.nativeEvent;
        const startX = locationX;
        setBarLeftX((prev) => prev); // re-trigger if needed, though usually stable
        updateFromMoveX(gestureState.moveX);
      },
      onPanResponderMove: (_evt, gestureState) => {
        updateFromMoveX(gestureState.moveX);
      },
      onPanResponderRelease: (_evt, gestureState) => {
        isScrubbingRef.current = false;
        setIsScrubbing(false);
        onScrubEnd?.();
      },
      onPanResponderTerminate: () => {
        isScrubbingRef.current = false;
        setIsScrubbing(false);
        onScrubEnd?.();
      },
    });
  }, [duration, onScrubEnd, onScrubStart, updateFromMoveX]);

  return (
    <View
      style={[
        styles.progressBarContainer,
        {
          justifyContent: 'center', // Ensure track is centered vertically
          backgroundColor: 'transparent', // Avoid doubling up background with the feedStyles one
        },
        isScrubbing ? { height: scaleHeight(26) } : null, // Enlarge hit area visibly if needed, or rely on hitSlop
      ]}
      hitSlop={{ top: scaleHeight(12), bottom: scaleHeight(12), left: 12, right: 12 }}
      onLayout={(e) => {
        setContainerWidth(e.nativeEvent.layout.width);
        // Update left edge after layout so taps/drags map correctly.
        barRef.current?.measure((_x, _y, _width, _height, pageX, _pageY) => {
          setBarLeftX(pageX);
        });
      }}
      ref={barRef}
      {...panResponder.panHandlers}
    >
      {showTimeLabel ? (
        <View style={{ position: 'absolute', top: -scaleHeight(26), left: 0, right: 0, alignItems: 'center' }}>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 8,
              backgroundColor: 'rgba(0,0,0,0.65)',
            }}
          >
            <Text style={{ color: '#fff', fontSize: scaleHeight(12), fontWeight: '700' }}>
              {formatTime(labelTime)} / {formatTime(duration)}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Track background */}
      <Animated.View
        style={{
          width: '100%',
          height: barHeight,
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={[
            styles.progressBar,
            {
              width: animatedProgress.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </Animated.View>

      {/* Thumb grows while scrubbing */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          top: '50%',
          marginTop: animatedThumbMarginTop,
          transform: [{ translateX: animatedThumbTranslateX }],
          width: animatedThumbWidth,
          height: animatedThumbHeight,
          borderRadius: Animated.divide(animatedThumbHeight, 2),
          backgroundColor: '#fff',
          borderWidth: 0.5,
          borderColor: 'rgba(0,0,0,0.25)',
          opacity: isScrubbing ? 1 : 0.85,
        }}
      />
    </View>
  );
}
