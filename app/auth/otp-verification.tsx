import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '@/constants/colors';
import { scaleFont, scaleHeight, scaleWidth } from '@/utils/responsive';
import { useAuthStore } from '@/stores/authStore';
import {
  authByPhone,
  verifyLoginPhoneOtp,
  verifyRegisterPhoneOtp,
} from '@/utils/authApi';
import { requestBrokerIdUpdate, validateBrokerOtp } from '@/utils/brokerApi';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

function maskPhone(phone: string | null) {
  if (!phone) return '';
  if (phone.length <= 4) return phone;
  const last4 = phone.slice(-4);
  return `•••• ${last4}`;
}

export default function OtpVerificationScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const pendingPhoneNumber = useAuthStore((s) => s.pendingPhoneNumber);
  const pendingFlow = useAuthStore((s) => s.pendingFlow);
  const pendingMessage = useAuthStore((s) => s.pendingMessage);
  const pendingBrokerUpdate = useAuthStore((s) => s.pendingBrokerUpdate);
  const setPendingMessage = useAuthStore((s) => s.setPendingMessage);
  const backofficeToken = useAuthStore((s) => s.session?.tokens?.backofficeToken) ?? null;
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const completeOtpVerification = useAuthStore((s) => s.completeOtpVerification);
  const clearPendingAuth = useAuthStore((s) => s.clearPendingAuth);

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: false } as any);
  }, [navigation]);

  const [digits, setDigits] = useState<string[]>(Array.from({ length: OTP_LENGTH }, () => ''));
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(RESEND_SECONDS);

  const inputsRef = useRef<(TextInput | null)[]>([]);
  const resendIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ignoreMissingPendingRedirectRef = useRef(false);

  const otp = useMemo(() => digits.join(''), [digits]);
  const isComplete = otp.length === OTP_LENGTH && !digits.some((d) => d === '');

  useEffect(() => {
    // If user lands here directly (or auth data got cleared), send them back to login.
    // After successful verification we clear pendingPhoneNumber, so only redirect
    // if the user is NOT authenticated.
    if (!pendingPhoneNumber && !isAuthenticated) {
      if (!ignoreMissingPendingRedirectRef.current) {
        router.replace('/auth/login' as any);
      }
      return;
    }

    if (!pendingPhoneNumber && isAuthenticated) {
      // User is authenticated; no need to initialize OTP UI.
      return;
    }

    const t = setTimeout(() => {
      inputsRef.current[0]?.focus();
    }, 200);

    // Start resend countdown.
    startResendCountdown();

    return () => {
      clearTimeout(t);
      const resendInterval = resendIntervalRef.current;
      if (resendInterval) clearInterval(resendInterval);
    };
  }, [isAuthenticated, pendingPhoneNumber, router]);

  const setDigitAt = (index: number, value: string) => {
    setDigits((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const onChangeAt = (index: number, text: string) => {
    if (isVerifying) return;

    const cleaned = text.replace(/[^0-9]/g, '');

    // Handle paste of entire code.
    if (cleaned.length > 1) {
      const nextDigits = Array.from({ length: OTP_LENGTH }, (_, i) => cleaned[i] ?? '');
      setDigits(nextDigits);

      // If user pasted the full code, move focus to the last box and dismiss keyboard.
      if (cleaned.length >= OTP_LENGTH) {
        inputsRef.current[OTP_LENGTH - 1]?.blur();
        Keyboard.dismiss();
      } else {
        // Focus the next empty input (index = cleaned.length)
        const nextIndex = Math.min(cleaned.length, OTP_LENGTH - 1);
        inputsRef.current[nextIndex]?.focus();
      }
      return;
    }

    setDigitAt(index, cleaned);

    if (cleaned && index < OTP_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const onKeyPressAt = (index: number, key: string) => {
    if (isVerifying) return;
    if (key !== 'Backspace') return;

    // If current is empty, move back.
    if (digits[index] === '' && index > 0) {
      inputsRef.current[index - 1]?.focus();
      setDigitAt(index - 1, '');
      return;
    }

    setDigitAt(index, '');
  };

  const onVerify = async () => {
    if (!isComplete || isVerifying) return;
    if (!pendingPhoneNumber) {
      router.replace('/auth/login' as any);
      return;
    }

    Keyboard.dismiss();
    setIsVerifying(true);

    try {
      if (pendingFlow === 'broker_update') {
        if (!backofficeToken) {
          throw new Error('Missing backoffice token. Please login again.');
        }

        const res = await validateBrokerOtp({ backofficeToken, otpCode: otp });
        if (res?.success) {
          clearPendingAuth();
          router.replace('/(tabs)/upload' as any);
          return;
        }

        throw new Error(res?.message || 'Invalid OTP.');
      }

      if (pendingFlow === 'login') {
        const res: any = await verifyLoginPhoneOtp({ phone: pendingPhoneNumber, otpCode: otp });
        const payload = res?.payload ?? res?.data ?? res;
        const hasTokens =
          !!payload?.saqancom_token || !!payload?.backoffice_token || !!payload?.properties_token;
        const ok = res?.success === true || res?.success === 'true' || res?.status === true || hasTokens;
        if (!ok) {
          throw new Error(res?.message || 'Failed to verify OTP.');
        }

        completeOtpVerification({
          tokens: {
            saqancomToken: payload?.saqancom_token ?? null,
            backofficeToken: payload?.backoffice_token ?? null,
            propertiesToken: payload?.properties_token ?? null,
          },
          agent: payload?.agent ?? null,
        });
        router.replace('/(tabs)/upload' as any);
        return;
      }

      // Default: register flow
      const res = await verifyRegisterPhoneOtp({ phone: pendingPhoneNumber, otpCode: otp });

      const brokerExist = res?.payload?.brokerExist;

      if (res?.success !== true) {
        throw new Error(res?.message || 'Failed to verify OTP.');
      }

      // Store session details after successful OTP.
      completeOtpVerification({
        tokens: {
          saqancomToken: res?.payload?.saqancom_token ?? null,
          backofficeToken: res?.payload?.backoffice_token ?? null,
          propertiesToken: res?.payload?.properties_token ?? null,
        },
        agent: res?.payload?.agent ?? null,
      });

      // If broker exists, go straight to upload. Otherwise show broker question.
      if (brokerExist === true) {
        router.replace('/(tabs)/upload' as any);
      } else {
        router.replace('/auth/broker-question' as any);
      }
    } catch (e: any) {
      let msg =
        e?.body && typeof e.body === 'object'
          ? // Try to show first validation error if present
            ((): string => {
              const body: any = e.body;
              if (typeof body?.message === 'string' && body.message.trim()) return body.message;
              const errors = body?.errors;
              if (errors && typeof errors === 'object') {
                const firstKey = Object.keys(errors)[0];
                const firstVal = firstKey ? errors[firstKey] : null;
                if (Array.isArray(firstVal) && typeof firstVal[0] === 'string') return firstVal[0];
                if (typeof firstVal === 'string') return firstVal;
              }
              return e?.message ?? 'Failed to verify OTP. Please try again.';
            })()
          : e?.message ?? 'Failed to verify OTP. Please try again.';

      // Avoid leaking generic backend codes to users.
      if (msg === 'validation_error' || msg === 'validation error') {
        msg = 'Invalid OTP. Please check the code and try again.';
      }

      Alert.alert('Verification failed', msg);
    } finally {
      setIsVerifying(false);
    }
  };

  const onChangeNumber = () => {
    if (isVerifying) return;
    clearPendingAuth();
    router.replace('/auth/login' as any);
  };

  const startResendCountdown = () => {
    setResendSecondsLeft(RESEND_SECONDS);
    resendIntervalRef.current && clearInterval(resendIntervalRef.current);
    resendIntervalRef.current = setInterval(() => {
      setResendSecondsLeft((prev) => {
        if (prev <= 1) {
          resendIntervalRef.current && clearInterval(resendIntervalRef.current);
          resendIntervalRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const onResendOtp = async () => {
    if (isVerifying || isResending || resendSecondsLeft > 0) return;
    if (!pendingPhoneNumber) return;

    setIsResending(true);

    try {
      if (pendingFlow === 'broker_update') {
        if (!backofficeToken) {
          throw new Error('Missing backoffice token. Please login again.');
        }
        if (!pendingBrokerUpdate) {
          throw new Error('Missing broker update request details.');
        }

        const res = await requestBrokerIdUpdate({
          backofficeToken,
          brokerNumber: pendingBrokerUpdate.brokerNumber,
          emirate: pendingBrokerUpdate.emirate,
          file: null,
        });

        // For broker update resend, even failure can be informative.
        if (!res?.success) {
          throw new Error(res?.message || 'Failed to resend OTP.');
        }

        // Update banner message
        setPendingMessage(res?.message ?? null);
        startResendCountdown();
        Alert.alert('OTP sent', res?.message || 'A new OTP has been sent.');
        return;
      }

      // Unified auth endpoint will decide action server-side.
      const res = await authByPhone(pendingPhoneNumber);

      if (!res?.success) {
        throw new Error(res?.message || 'Failed to resend OTP.');
      }

      startResendCountdown();
      Alert.alert('OTP sent', res?.message || 'A new OTP has been sent.');
    } catch (e: any) {
      Alert.alert('Resend failed', e?.message ?? 'Failed to resend OTP. Please try again.');
    } finally {
      setIsResending(false);
    }
  };


  return (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=1200&q=80' }}
      style={styles.container}
      resizeMode="cover"
    >
      <LinearGradient
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0 }}
        colors={['rgba(243, 237, 223, 0.3)', 'rgba(240, 228, 228, 0.85)']}
        style={styles.gradient}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <KeyboardAvoidingView
            style={styles.keyboardAvoidingView}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <SafeAreaView style={styles.safeArea}>
              <View style={styles.content}>
                <View style={styles.header}>
                  <Text style={styles.title}>Verify OTP</Text>
                  <Text style={styles.subtitle}>
                    Enter the 6-digit code sent to {maskPhone(pendingPhoneNumber)}
                  </Text>

                  {pendingFlow === 'broker_update' && pendingMessage ? (
                    <View style={styles.infoBanner}>
                      <Text style={styles.infoBannerText}>{pendingMessage}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.card}>
                  <View style={styles.otpRow}>
                    {Array.from({ length: OTP_LENGTH }, (_, index) => (
                      <TextInput
                        key={index}
                        ref={(r) => {
                          inputsRef.current[index] = r;
                        }}
                        value={digits[index]}
                        onChangeText={(t) => onChangeAt(index, t)}
                        onKeyPress={({ nativeEvent }) => onKeyPressAt(index, nativeEvent.key)}
                        style={styles.otpBox}
                        keyboardType="number-pad"
                        textContentType="oneTimeCode"
                        maxLength={1}
                        returnKeyType="done"
                        placeholder="•"
                        placeholderTextColor={Colors.textSecondary}
                        selectionColor={Colors.bronze}
                      />
                    ))}
                  </View>

                  <Pressable
                    style={[
                      styles.primaryButton,
                      (!isComplete || isVerifying) && styles.primaryButtonDisabled,
                    ]}
                    onPress={onVerify}
                    disabled={!isComplete || isVerifying}
                  >
                    <View style={styles.primaryButtonContent}>
                      {isVerifying ? (
                        <ActivityIndicator size="small" color={Colors.textLight} />
                      ) : null}
                      <Text style={styles.primaryButtonText}>
                        {isVerifying ? 'Verifying OTP…' : 'Verify OTP'}
                      </Text>
                    </View>
                  </Pressable>

                  <Pressable
                    style={[styles.secondaryButton, isVerifying && styles.secondaryButtonDisabled]}
                    onPress={onChangeNumber}
                    disabled={isVerifying}
                  >
                    <Text style={styles.secondaryButtonText}>Change number</Text>
                  </Pressable>

                  <View style={styles.resendRow}>
                    <Text style={styles.disclaimer}>
                      {resendSecondsLeft > 0
                        ? `Resend OTP in ${resendSecondsLeft}s`
                        : 'Didn’t receive the code?'}
                    </Text>
                    <Pressable
                      onPress={onResendOtp}
                      disabled={isVerifying || isResending || resendSecondsLeft > 0}
                    >
                      <Text
                        style={[
                          styles.resendLink,
                          (isVerifying || isResending || resendSecondsLeft > 0) &&
                            styles.resendLinkDisabled,
                        ]}
                      >
                        {isResending ? 'Resending…' : 'Resend OTP'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </LinearGradient>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
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
  header: {
    width: '100%',
    maxWidth: 520,
    paddingBottom: scaleHeight(16),
    alignItems: 'center',
  },
  title: {
    fontSize: scaleFont(34),
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: scaleHeight(8),
    fontSize: scaleFont(14),
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  infoBanner: {
    marginTop: scaleHeight(12),
    paddingVertical: scaleHeight(10),
    paddingHorizontal: scaleWidth(12),
    borderRadius: scaleWidth(12),
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  infoBannerText: {
    color: Colors.text,
    fontSize: scaleFont(13),
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: scaleFont(18),
  },
  card: {
    width: '100%',
    maxWidth: 520,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: scaleWidth(16),
    padding: scaleWidth(16),
    backgroundColor: 'transparent',
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: scaleWidth(10),
  },
  otpBox: {
    flex: 1,
    height: scaleHeight(56),
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: scaleWidth(12),
    textAlign: 'center',
    fontSize: scaleFont(20),
    fontWeight: '700',
    color: Colors.text,
    backgroundColor: 'transparent',
  },
  primaryButton: {
    marginTop: scaleHeight(18),
    backgroundColor: Colors.bronze,
    paddingVertical: scaleHeight(14),
    borderRadius: scaleWidth(12),
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scaleWidth(10),
  },
  primaryButtonText: {
    color: Colors.textLight,
    fontSize: scaleFont(16),
    fontWeight: '700',
  },
  secondaryButton: {
    marginTop: scaleHeight(10),
    paddingVertical: scaleHeight(12),
    borderRadius: scaleWidth(12),
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  secondaryButtonDisabled: {
    opacity: 0.5,
  },
  secondaryButtonText: {
    color: Colors.text,
    fontSize: scaleFont(14),
    fontWeight: '700',
  },
  resendRow: {
    marginTop: scaleHeight(14),
    alignItems: 'center',
    gap: scaleHeight(6),
  },
  disclaimer: {
    fontSize: scaleFont(12),
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  resendLink: {
    fontSize: scaleFont(14),
    fontWeight: '700',
    color: Colors.brown,
  },
  resendLinkDisabled: {
    opacity: 0.5,
  },
});
