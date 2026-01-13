import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Platform,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { scaleFont, scaleHeight, scaleWidth } from '@/utils/responsive';
import { useAuthStore } from '@/stores/authStore';
import { updateBrokerId } from '@/utils/profileApi';
import { ApiError } from '@/utils/api';

export default function BrokerQuestionScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const logout = useAuthStore((s) => s.logout);
  const backofficeToken = useAuthStore((s) => s.session?.tokens?.backofficeToken) ?? null;

  const [step, setStep] = useState<'question' | 'brokerNumber'>('question');
  const [brokerNumber, setBrokerNumber] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const EMIRATES = useMemo(
    () => [
      'Abu Dhabi',
      'Dubai',
      'Sharjah',
      'Ajman',
      'Umm Al Quwain',
      'Ras Al Khaimah',
      'Fujairah',
    ],
    []
  );
  const [selectedEmirate, setSelectedEmirate] = useState<string | null>(null);
  const [emirateModalVisible, setEmirateModalVisible] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  // 0 -> show question card, 1 -> show broker number card
  const progress = useRef(new Animated.Value(0)).current;
  // Animates extra fields inside the broker card
  const detailsProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: false } as any);
  }, [navigation]);

  const onNo = () => {
    Keyboard.dismiss();
    Alert.alert('Registration restricted', 'Only brokers are allowed to register.', [
      {
        text: 'OK',
        onPress: () => {
          // Ensure we don't keep an authenticated session for non-brokers.
          logout();
          router.replace('/(tabs)/feed' as any);
        },
      },
    ]);
  };

  const onYes = () => {
    Keyboard.dismiss();
    if (isAnimating || step !== 'question') return;

    setEmirateModalVisible(false);

    // Mount the next card immediately so it can animate in.
    setStep('brokerNumber');
    setIsAnimating(true);

    // Reset and animate details
    detailsProgress.setValue(0);

    Animated.parallel([
      Animated.timing(progress, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(detailsProgress, {
        toValue: 1,
        duration: 420,
        delay: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsAnimating(false);
    });
  };

  const pickPhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Permission required', 'Please allow photo library access to upload a photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled) {
        setPhotoUri(result.assets?.[0]?.uri ?? null);
      }
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message || 'Please try again.');
    }
  };

  const onContinue = async () => {
    Keyboard.dismiss();
    const cleaned = brokerNumber.replace(/[^0-9]/g, '');
    if (cleaned.length !== 5) {
      Alert.alert('Invalid broker number', 'Broker number must be exactly 5 digits.');
      return;
    }

    if (!backofficeToken) {
      Alert.alert('Session error', 'Missing backoffice token. Please login again.');
      logout();
      router.replace('/auth/login' as any);
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await updateBrokerId({ brokerNumber: cleaned, backofficeToken });
      if (res?.success) {
        router.replace('/(tabs)/upload' as any);
      } else {
        Alert.alert('Unable to update broker number', res?.message || 'Please try again.');
      }
    } catch (e: any) {
      const body = e instanceof ApiError ? (e.body as any) : null;
      Alert.alert('Unable to update broker number', body?.message || e?.message || 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onBack = () => {
    Keyboard.dismiss();
    if (isAnimating || step !== 'brokerNumber') return;

    setEmirateModalVisible(false);

    setIsAnimating(true);
    Animated.parallel([
      Animated.timing(progress, {
        toValue: 0,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(detailsProgress, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setStep('question');
      setIsAnimating(false);
    });
  };

  const backgroundSource = useMemo(
    () => ({ uri: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=1200&q=80' }),
    []
  );

  const questionTranslateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -scaleHeight(40)],
  });
  const questionOpacity = progress.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [1, 0.2, 0],
  });

  const brokerCardTranslateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [scaleHeight(36), 0],
  });
  const brokerCardOpacity = progress.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0, 0.2, 1],
  });

  const detailsTranslateY = detailsProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [scaleHeight(10), 0],
  });
  const detailsOpacity = detailsProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const brokerCardPointerEvents = step === 'brokerNumber' ? 'auto' : 'none';
  const questionCardPointerEvents = step === 'question' ? 'auto' : 'none';

  return (
    <ImageBackground source={backgroundSource} style={styles.container} resizeMode="cover">
      <LinearGradient
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0 }}
        colors={['rgba(243, 237, 223, 0.3)', 'rgba(240, 228, 228, 0.85)']}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.safeArea}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <KeyboardAvoidingView
            style={styles.content}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.cardStage}>
              {/* Step 1: Broker question */}
              <Animated.View
              pointerEvents={questionCardPointerEvents as any}
              style={[
                styles.card,
                styles.cardLayer,
                {
                  transform: [{ translateY: questionTranslateY }],
                  opacity: questionOpacity,
                },
              ]}
            >
                <Text style={styles.cardTitle}>Are You Broker?</Text>

                <View style={styles.buttonsRow}>
                  <Pressable
                    style={[styles.buttonBase, styles.primaryButton, (isAnimating || step !== 'question') && styles.buttonDisabled]}
                    onPress={onYes}
                    disabled={isAnimating || step !== 'question'}
                  >
                    <Text style={styles.primaryButtonText}>Yes</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.buttonBase, styles.secondaryButton, (isAnimating || step !== 'question') && styles.buttonDisabled]}
                    onPress={onNo}
                    disabled={isAnimating || step !== 'question'}
                  >
                    <Text style={styles.secondaryButtonText}>No</Text>
                  </Pressable>
                </View>
              </Animated.View>

            {/* Step 2: Broker number */}
            <Animated.View
              pointerEvents={brokerCardPointerEvents as any}
              style={[
                styles.card,
                styles.cardLayer,
                {
                  transform: [{ translateY: brokerCardTranslateY }],
                  opacity: brokerCardOpacity,
                },
              ]}
            >
                <Text style={styles.cardTitle}>Broker Number</Text>

                <TextInput
                  value={brokerNumber}
                  onChangeText={(t) => setBrokerNumber(t.replace(/[^0-9]/g, '').slice(0, 5))}
                  placeholder="Enter your 5-digit broker number"
                  placeholderTextColor={Colors.overlayLight}
                  keyboardType="number-pad"
                  maxLength={5}
                  style={styles.input}
                  autoFocus
                />

                {brokerNumber.length > 0 && brokerNumber.length !== 5 ? (
                  <Text style={styles.helperText}>Broker number must be 5 digits.</Text>
                ) : null}

                {/* Only shown when user clicked YES (broker flow) */}
                <Animated.View
                  style={{
                    opacity: detailsOpacity,
                    transform: [{ translateY: detailsTranslateY }],
                  }}
                >
                  <Text style={styles.sectionLabel}>Emirate</Text>
                  <Pressable
                    style={styles.dropdownButton}
                    onPress={() => setEmirateModalVisible(true)}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.dropdownButtonText}>
                      {selectedEmirate ?? 'Select emirate'}
                    </Text>
                    <Text style={styles.dropdownChevron}>▼</Text>
                  </Pressable>

                  <Modal
                    transparent
                    visible={emirateModalVisible}
                    animationType="fade"
                    onRequestClose={() => setEmirateModalVisible(false)}
                  >
                    <Pressable
                      style={styles.modalBackdrop}
                      onPress={() => setEmirateModalVisible(false)}
                    >
                      <Pressable style={styles.modalSheet} onPress={() => {}}>
                        <Text style={styles.modalTitle}>Select Emirate</Text>
                        {EMIRATES.map((e) => (
                          <Pressable
                            key={e}
                            style={styles.modalItem}
                            onPress={() => {
                              setSelectedEmirate(e);
                              setEmirateModalVisible(false);
                            }}
                          >
                            <Text style={styles.modalItemText}>{e}</Text>
                          </Pressable>
                        ))}
                      </Pressable>
                    </Pressable>
                  </Modal>

                  <Text style={[styles.sectionLabel, { marginTop: scaleHeight(12) }]}>Upload Photo</Text>
                  <Pressable style={styles.uploadBox} onPress={pickPhoto} disabled={isSubmitting}>
                    {photoUri ? (
                      <Image source={{ uri: photoUri }} style={styles.uploadPreview} contentFit="cover" />
                    ) : (
                      <Text style={styles.uploadHint}>Tap to upload a photo</Text>
                    )}
                  </Pressable>
                </Animated.View>

                <View style={styles.buttonsRow}>
                <Pressable
                  style={[
                    styles.buttonBase,
                    styles.primaryButton,
                    (brokerNumber.trim().length !== 5 || isAnimating || isSubmitting) && styles.buttonDisabled,
                  ]}
                  onPress={onContinue}
                  disabled={brokerNumber.trim().length !== 5 || isAnimating || isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color={Colors.textLight} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Continue</Text>
                  )}
                </Pressable>

                  <Pressable
                    style={[styles.buttonBase, styles.secondaryButton, (isAnimating || isSubmitting) && styles.buttonDisabled]}
                    onPress={onBack}
                    disabled={isAnimating || isSubmitting}
                  >
                    <Text style={styles.secondaryButtonText}>Back</Text>
                  </Pressable>
                </View>
              </Animated.View>
            </View>
          </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </SafeAreaView>
      </LinearGradient>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    color: Colors.text,
    fontSize: scaleFont(13),
    fontWeight: '700',
    marginBottom: scaleHeight(8),
    marginTop: scaleHeight(10),
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: scaleWidth(12),
    paddingHorizontal: scaleWidth(14),
    paddingVertical: scaleHeight(12),
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  dropdownButtonText: {
    color: Colors.text,
    fontSize: scaleFont(15),
    fontWeight: '600',
  },
  dropdownChevron: {
    color: Colors.text,
    fontSize: scaleFont(12),
    fontWeight: '800',
  },
  uploadBox: {
    marginTop: scaleHeight(6),
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: scaleWidth(12),
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,255,255,0.18)',
    height: scaleHeight(140),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  uploadHint: {
    color: Colors.text,
    fontSize: scaleFont(14),
    fontWeight: '600',
    opacity: 0.85,
  },
  uploadPreview: {
    width: '100%',
    height: '100%',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
    padding: scaleWidth(14),
  },
  modalSheet: {
    borderRadius: scaleWidth(16),
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'rgba(255,255,255,0.98)',
    paddingVertical: scaleHeight(10),
    overflow: 'hidden',
  },
  modalTitle: {
    paddingHorizontal: scaleWidth(14),
    paddingVertical: scaleHeight(10),
    fontSize: scaleFont(14),
    fontWeight: '800',
    color: Colors.text,
  },
  modalItem: {
    paddingHorizontal: scaleWidth(14),
    paddingVertical: scaleHeight(14),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  modalItemText: {
    fontSize: scaleFont(15),
    fontWeight: '700',
    color: Colors.text,
  },

  container: { flex: 1 },
  gradient: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingHorizontal: scaleWidth(24),
    marginHorizontal: scaleWidth(16),
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardStage: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    // Provides a stable area to stack cards without affecting vertical layout
    minHeight: scaleHeight(520),
    justifyContent: 'center',
  },
  cardLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignSelf: 'center',
  },
  card: {
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: scaleWidth(16),
    padding: scaleWidth(16),
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'visible',
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: scaleWidth(12),
    paddingHorizontal: scaleWidth(14),
    paddingVertical: scaleHeight(12),
    fontSize: scaleFont(16),
    color: Colors.text,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginBottom: scaleHeight(10),
  },
  helperText: {
    color: Colors.overlayLight,
    fontSize: scaleFont(12),
    marginBottom: scaleHeight(12),
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  cardTitle: {
    fontSize: scaleFont(28),
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: scaleHeight(16),
  },
  buttonsRow: {
    flexDirection: 'row-reverse',
    gap: scaleWidth(12),
    marginTop:scaleHeight(16),
  },
  buttonBase: {
    flex: 1,
    paddingVertical: scaleHeight(14),
    borderRadius: scaleWidth(12),
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: Colors.bronze,
  },
  primaryButtonText: {
    color: Colors.textLight,
    fontSize: scaleFont(16),
    fontWeight: '700',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryButtonText: {
    color: Colors.text,
    fontSize: scaleFont(16),
    fontWeight: '700',
  },
});
