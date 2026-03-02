import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, BackHandler, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
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

  const cameraGranted = !!permission?.granted;
  const cameraActive = cameraGranted;

  const [isRecording, setIsRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);

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

  // Read microphone permission on mount (avoid prompting immediately).
  useEffect(() => {
    const checkAudioPermission = async () => {
      try {
        const { status } = await Audio.getPermissionsAsync();
        setAudioPermission(status === 'granted');
      } catch (error) {
        console.warn('Audio permission check failed:', error);
        setAudioPermission(false);
      }
    };

    checkAudioPermission();
  }, []);

  const ensureMicrophonePermission = async (): Promise<boolean> => {
    if (audioPermission === true) return true;

    try {
      const { status } = await Audio.requestPermissionsAsync();
      const granted = status === 'granted';
      setAudioPermission(granted);
      if (!granted) {
        Alert.alert(
          'Audio Permission Required',
          'Microphone access is required to record video with audio. Please enable it in device settings.'
        );
      }
      return granted;
    } catch (error) {
      console.warn('Audio permission request failed:', error);
      setAudioPermission(false);
      Alert.alert('Permission Error', 'Failed to request microphone permission.');
      return false;
    }
  };

  useEffect(() => {
    // When camera permission/focus changes or the view remounts, reset readiness.
    if (!cameraActive) {
      setIsCameraReady(false);
    }
  }, [cameraActive]);

  const startRecording = async () => {
    if (isRecording || isSaving) return;

    // Ensure camera permission
    if (!cameraGranted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Permission required', 'Camera permission is required to record video.');
        return;
      }
    }

    // Ensure microphone permission
    if (!(await ensureMicrophonePermission())) {
      return;
    }
    try {
      if (!isCameraReady) {
        Alert.alert('Camera starting', 'Please wait a moment for the camera to initialize.');
        return;
      }

      setIsRecording(true);
      const camera = cameraRef.current as any;
      if (!camera?.recordAsync) {
        throw new Error('Camera not ready');
      }

      const res = await camera.recordAsync({
        maxDuration: 60,
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
            setIsCameraReady(false);
            setCameraKey((k) => k + 1);
          }}
          hitSlop={10}
          accessibilityLabel="Reload camera"
        >
          <RefreshCcw size={scaleWidth(22)} color={Colors.textLight} />
        </Pressable>
      </View>

      <View style={styles.cameraWrap}>
        {!permission ? (
          <View style={styles.permissionState}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.permissionText}>Checking camera permission…</Text>
          </View>
        ) : !cameraGranted ? (
          <View style={styles.permissionState}>
            <Text style={styles.permissionText}>Camera permission is required to record video.</Text>
            <Pressable style={styles.permissionButton} onPress={() => requestPermission()}>
              <Text style={styles.permissionButtonText}>Grant Camera Permission</Text>
            </Pressable>
          </View>
        ) : (
          <CameraView
            key={`camera-${cameraKey}`}
            ref={cameraRef as any}
            style={StyleSheet.absoluteFill}
            facing="back"
            mode="video"
            videoQuality="720p"
            mute={false}
            onCameraReady={() => setIsCameraReady(true)}
            onMountError={(e) => {
              console.warn('Camera mount error:', e);
              Alert.alert(
                'Camera error',
                'Unable to start the camera. Please close other apps that might be using the camera and try again.'
              );
            }}
          />
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.hint}>Tap to record, tap again to stop</Text>

        <Animated.View
          style={[
            {
              transform: [{ scale: isRecording ? scaleAnim : 1 }],
            },
          ]}
        >
          <Pressable
            style={[
              styles.recordButton,
              isRecording && styles.recordButtonActive,
              (!isCameraReady || !cameraGranted) && { opacity: 0.7 },
            ]}
            onPress={() => {
              if (isSaving) return;
              if (isRecording) {
                stopRecording();
              } else {
                startRecording();
              }
            }}
            disabled={!cameraGranted || !isCameraReady}
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
  permissionState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scaleWidth(24),
    gap: scaleHeight(12),
  },
  permissionText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: scaleFont(14),
    fontWeight: '700',
    textAlign: 'center',
  },
  permissionButton: {
    marginTop: scaleHeight(10),
    paddingVertical: scaleHeight(12),
    paddingHorizontal: scaleWidth(18),
    borderRadius: scaleWidth(12),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: scaleFont(13),
    fontWeight: '800',
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
    borderWidth: 3,
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
