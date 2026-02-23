import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, BackHandler, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { SavingSpinner } from '@/components/SavingSpinner';
import { useFocusEffect, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
import { ArrowLeft, RefreshCcw } from 'lucide-react-native';
import { Colors, LifestyleColors } from '@/constants/colors';
import { scaleFont, scaleHeight, scaleWidth } from '@/utils/responsive';
import { useRecordingStore } from '@/stores/recordingStore';

export default function RecordVideoScreen() {
  const router = useRouter();

  // Android hardware back: always go directly to Upload screen.
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        router.replace('/(tabs)/upload' as any);
        return true;
      };

      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [router])
  );
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [audioPermission, setAudioPermission] = useState<boolean | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const pulseAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isRecording) {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(0);
      scaleAnim.stopAnimation();
      scaleAnim.setValue(1);
      return;
    }

    // Pulsing glow animation
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 280,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 280,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    // Breathing scale animation for the button
    const scaleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.12,
          duration: 420,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 420,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    pulseLoop.start();
    scaleLoop.start();
    
    return () => {
      pulseLoop.stop();
      scaleLoop.stop();
    };
  }, [isRecording, pulseAnim, scaleAnim]);
  const setRecordedVideoUri = useRecordingStore((s) => s.setRecordedVideoUri);

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  // Request audio permissions on component mount
  useEffect(() => {
    const requestAudioPermission = async () => {
      try {
        const { status } = await Audio.requestPermissionsAsync();
        setAudioPermission(status === 'granted');
      } catch (error) {
        console.warn('Audio permission request failed:', error);
        setAudioPermission(false);
      }
    };

    requestAudioPermission();
  }, []);

  const startRecording = async () => {
    if (isRecording || isSaving) return;

    // Check camera permission
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Permission required', 'Camera permission is required to record video.');
        return;
      }
    }

    // Check audio permission for Android
    if (audioPermission === null) {
      Alert.alert('Permission loading', 'Audio permissions are being checked. Please try again.');
      return;
    }

    if (!audioPermission) {
      try {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Audio Permission Required', 
            'Microphone access is required to record video with audio. Please enable it in device settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Settings', onPress: () => {
                // On Android, user needs to manually enable in settings
                Alert.alert('Enable Permissions', 'Go to Settings > Apps > [Your App] > Permissions > Microphone and enable it.');
              }}
            ]
          );
          return;
        }
        setAudioPermission(true);
      } catch (error) {
        Alert.alert('Permission Error', 'Failed to request audio permission. Please try again.');
        return;
      }
    }

    try {
      setIsRecording(true);
      const camera = cameraRef.current as any;
      if (!camera?.recordAsync) {
        throw new Error('Camera not ready');
      }

      const res = await camera.recordAsync({
        maxDuration: 60,
        quality: '720p',
        mute: false,
      });

      // recordAsync resolves after stopRecording is called (or maxDuration reached)
      if (res?.uri) {
        setIsSaving(true);
        setRecordedVideoUri(res.uri);
        // Navigate to preview screen instead of going back directly
        router.push('/record-video-preview' as any);
      }
    } catch (e: any) {
      Alert.alert('Recording failed', e?.message ?? 'Unable to record video');
    } finally {
      setIsRecording(false);
      setIsSaving(false);
    }
  };

  const stopRecording = async () => {
    if (!isRecording) return;
    try {
      const camera = cameraRef.current as any;
      camera?.stopRecording?.();
    } catch {
      // ignore
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            // Always return directly to Upload screen (avoid stacking when retaking multiple times)
            router.replace('/(tabs)/upload' as any);
          }}
          hitSlop={10}
        >
          <ArrowLeft size={scaleWidth(24)} color={Colors.textLight} />
        </Pressable>
        <Text style={styles.headerTitle}>Record Video</Text>
        <Pressable
          onPress={() => {
            // nothing to reset yet; keep placeholder for future camera toggles
          }}
          hitSlop={10}
          style={{ opacity: 0 }}
        >
          <RefreshCcw size={scaleWidth(22)} color={Colors.textLight} />
        </Pressable>
      </View>

      <View style={styles.cameraWrap}>
        <CameraView ref={cameraRef as any} style={StyleSheet.absoluteFill} facing="back" mode="video" />
      </View>

      <View style={styles.footer}>
        <Text style={styles.hint}>Hold to record, release to stop</Text>

        <Animated.View
          style={[
            {
              transform: [{ scale: isRecording ? scaleAnim : 1 }],
            },
          ]}
        >
          <Pressable
            style={[styles.recordButton, isRecording && styles.recordButtonActive]}
            delayLongPress={120}
            onLongPress={startRecording}
            onPressOut={stopRecording}
          >
            {isSaving ? (
              <SavingSpinner color="#fff" accessibilityLabel="Saving video" />
            ) : (
              <View style={styles.recordButtonInnerWrap}>
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.recordPulse,
                    {
                      transform: [
                        {
                          scale: pulseAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 1.35],
                          }),
                        },
                      ],
                      opacity: pulseAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.55, 0],
                      }),
                    },
                  ]}
                />
                <View style={styles.recordButtonInner} />
              </View>
            )}
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingTop: scaleHeight(60),
    paddingHorizontal: scaleWidth(20),
    paddingBottom: scaleHeight(12),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: Colors.textLight,
    fontSize: scaleFont(16),
    fontWeight: '800',
  },
  cameraWrap: {
    flex: 1,
    overflow: 'hidden',
  },
  footer: {
    paddingHorizontal: scaleWidth(20),
    paddingTop: scaleHeight(12),
    paddingBottom: scaleHeight(28),
    alignItems: 'center',
    gap: scaleHeight(10),
  },
  hint: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: scaleFont(13),
    fontWeight: '700',
  },
  recordButton: {
    width: scaleWidth(80),
    height: scaleWidth(80),
    borderRadius: scaleWidth(40),
    borderWidth: 6,
    borderColor: LifestyleColors.cityLiving,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButtonActive: {
    borderColor: LifestyleColors.beach,
  },
  recordButtonInnerWrap: {
    width: scaleWidth(52),
    height: scaleWidth(52),
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordPulse: {
    position: 'absolute',
    width: scaleWidth(52),
    height: scaleWidth(52),
    borderRadius: scaleWidth(26),
    backgroundColor: '#ff3b30',
  },
  recordButtonInner: {
    width: scaleWidth(52),
    height: scaleWidth(52),
    borderRadius: scaleWidth(26),
    backgroundColor: '#ff3b30',
  },
});
