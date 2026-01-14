import React, { useMemo, useState } from 'react';
import { PhoneField } from '@/components/PhoneField';
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
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '@/constants/colors';
import { scaleFont, scaleHeight, scaleWidth } from '@/utils/responsive';
import { useAuthStore } from '@/stores/authStore';
import { authByPhone } from '@/utils/authApi';

function normalizePhone(input: string) {
  // Keep leading + if user uses international format.
  const trimmed = input.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/[^0-9]/g, '');
  return hasPlus ? `+${digits}` : digits;
}

export default function LoginScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const setPendingAuth = useAuthStore((s) => s.setPendingAuth);

  const [phone, setPhone] = useState('');
  const [formattedPhone, setFormattedPhone] = useState('');
  const [isValidPhone, setIsValidPhone] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  const normalized = useMemo(() => normalizePhone(formattedPhone), [formattedPhone]);

  React.useEffect(() => {
    navigation.setOptions({ gestureEnabled: false } as any);
  }, [navigation]);

  const onContinue = async () => {
    if (!isValidPhone || isSendingOtp) return;

    Keyboard.dismiss();
    setIsSendingOtp(true);

    try {
      const res = await authByPhone(normalized);
      if (!res?.success) {
        throw new Error(res?.message || 'Failed to send OTP');
      }

      const action = (res?.payload?.action || 'login').toString();
      const flow = action === 'register' ? 'register' : 'login';

      setPendingAuth({ phoneNumber: normalized, flow });
      router.replace('/auth/otp-verification' as any);
    } catch (e: any) {
      Alert.alert('Login failed', e?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setIsSendingOtp(false);
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
                  <Text style={styles.title}>Log in</Text>
                  <Text style={styles.subtitle}>Enter your mobile number to continue</Text>
                </View>

                <View style={styles.card}>
                  <PhoneField
                    label="Mobile Number"
                    value={phone}
                    onChangeValue={setPhone}
                    onChange={({ formattedPhone, isValid }) => {
                      setFormattedPhone(formattedPhone);
                      setIsValidPhone(isValid);
                    }}
                  />

                  <Pressable
                    style={[
                      styles.primaryButton,
                      (!isValidPhone || isSendingOtp) && styles.primaryButtonDisabled,
                    ]}
                    onPress={onContinue}
                    disabled={!isValidPhone || isSendingOtp}
                  >
                    <View style={styles.primaryButtonContent}>
                      {isSendingOtp ? (
                        <ActivityIndicator size="small" color={Colors.textLight} />
                      ) : null}
                      <Text style={styles.primaryButtonText}>
                        {isSendingOtp ? 'Sending OTP…' : 'Continue'}
                      </Text>
                    </View>
                  </Pressable>

                </View>
                {/* <Pressable
                  style={[styles.secondaryButton, isSendingOtp && styles.primaryButtonDisabled]}
                  onPress={() => router.replace('/(tabs)/feed' as any)}
                  disabled={isSendingOtp}
                >
                  <Text style={styles.secondaryButtonText}>Continue without login</Text>
                </Pressable> */}
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
    maxWidth: 420,
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
  card: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: scaleWidth(16),
    padding: scaleWidth(16),
    backgroundColor: 'transparent',
  },
  label: {
    fontSize: scaleFont(14),
    fontWeight: '600',
    color: Colors.text,
    marginBottom: scaleHeight(8),
  },
  primaryButton: {
    marginTop: scaleHeight(14),
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
    width: '100%',
    maxWidth: 420,
    marginTop: scaleHeight(20),
    backgroundColor: 'transparent',
    paddingVertical: scaleHeight(14),
    borderRadius: scaleWidth(12),
    borderWidth: 1,
    borderColor: Colors.text,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: Colors.text,
    fontSize: scaleFont(16),
    fontWeight: '600',
  },
  footerRow: {
    marginTop: scaleHeight(14),
    flexDirection: 'row',
    justifyContent: 'center',
    gap: scaleWidth(6),
  },
  footerText: {
    color: Colors.textSecondary,
    fontSize: scaleFont(14),
  },
  link: {
    color: Colors.brown,
    fontSize: scaleFont(14),
    fontWeight: '700',
  },
});
