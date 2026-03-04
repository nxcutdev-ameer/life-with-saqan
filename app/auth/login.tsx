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
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import type { ThemeColors } from '@/constants/theme';
import { scaleFont, scaleHeight, scaleWidth } from '@/utils/responsive';
import { useAuthStore } from '@/stores/authStore';
import { authByPhone } from '@/utils/authApi';
import { normalizePhone } from '@/utils/formatters';
import { useTheme } from '@/utils/useTheme';

export default function LoginScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const setPendingAuth = useAuthStore((s) => s.setPendingAuth);
  const { colors: themeColors, isDarkMode } = useTheme();

  const styles = useMemo(() => createStyles(themeColors, isDarkMode), [themeColors, isDarkMode]);

  const [phone, setPhone] = useState('');
  const [formattedPhone, setFormattedPhone] = useState('');
  const [isValidPhone, setIsValidPhone] = useState(false);
  const [sendingMethod, setSendingMethod] = useState<'whatsapp' | 'sms' | null>(null);
  const isSendingOtp = sendingMethod !== null;

  const normalized = useMemo(() => normalizePhone(formattedPhone), [formattedPhone]);

  const gradientColors = useMemo(
    () =>
      isDarkMode
        ? (['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.88)'] as const)
        : (['rgba(243, 237, 223, 0.3)', 'rgba(240, 228, 228, 0.85)'] as const),
    [isDarkMode]
  );

  React.useEffect(() => {
    navigation.setOptions({ gestureEnabled: false } as any);
  }, [navigation]);

  const onLogin = async (method: 'whatsapp' | 'sms') => {
    if (!isValidPhone || isSendingOtp) return;

    Keyboard.dismiss();
    setSendingMethod(method);

    try {
      // IMPORTANT: `method` must be passed so SMS doesn't fallback to WhatsApp.
      const res = await authByPhone(normalized, method);
      if (!res?.success) {
        throw new Error(res?.message || 'Failed to send OTP');
      }

      const action = (res?.payload?.action || 'login').toString();
      const flow = action === 'register' ? 'register' : 'login';

      setPendingAuth({ phoneNumber: normalized, flow, method });
      router.replace('/auth/otp-verification' as any);
    } catch (e: any) {
      Alert.alert('Login failed', e?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setSendingMethod(null);
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
        colors={gradientColors as any}
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
                    onPress={() => onLogin('whatsapp')}
                    disabled={!isValidPhone || isSendingOtp}
                  >
                    <View style={styles.primaryButtonContent}>
                      {sendingMethod === 'whatsapp' ? (
                        <ActivityIndicator size="small" color={themeColors.textOnPrimary} />
                      ) : (
                        <FontAwesome
                          name="whatsapp"
                          size={scaleFont(18)}
                          color={themeColors.textOnPrimary}
                        />
                      )}
                      <Text style={styles.primaryButtonText}>
                        {sendingMethod === 'whatsapp' ? 'Sending OTP…' : 'Login with WhatsApp'}
                      </Text>
                    </View>
                  </Pressable>
                </View>

                <Text style={styles.orText}>or</Text>
                <Pressable
                  style={[styles.secondaryButton, (!isValidPhone || isSendingOtp) && styles.primaryButtonDisabled]}
                  onPress={() => onLogin('sms')}
                  disabled={!isValidPhone || isSendingOtp}
                >
                  {sendingMethod === 'sms' ? (
                    <View style={styles.secondaryButtonContent}>
                      <ActivityIndicator size="small" color={themeColors.text} />
                      <Text style={styles.secondaryButtonText}>Sending OTP…</Text>
                    </View>
                  ) : (
                    <Text style={styles.secondaryButtonText}>Login with SMS</Text>
                  )}
                </Pressable>
              </View>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </LinearGradient>
    </ImageBackground>
  );
}

const createStyles = (colors: ThemeColors, isDarkMode: boolean) =>
  StyleSheet.create({
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
      marginHorizontal: Platform.OS === 'android' ? scaleWidth(2) : scaleWidth(16),
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
      fontSize: Platform.OS === 'android' ? scaleFont(26) : scaleFont(34),
      fontWeight: '800',
      color: isDarkMode ? colors.white : colors.text,
      textAlign: 'center',
    },
    subtitle: {
      marginTop: scaleHeight(8),
      fontSize: Platform.OS === 'android' ? scaleFont(12) : scaleFont(14),
      color: colors.textSecondary,
      textAlign: 'center',
    },
    card: {
      width: '100%',
      maxWidth: 420,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: scaleWidth(16),
      padding: scaleWidth(16),
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'transparent',
    },
    primaryButton: {
      marginTop: scaleHeight(14),
      backgroundColor: colors.primary,
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
      color: colors.textOnPrimary,
      fontSize: Platform.OS === 'android' ? scaleFont(12) : scaleFont(16),
      fontWeight: '700',
    },
    secondaryButton: {
      width: '100%',
      maxWidth: 420,
      marginTop: 0,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : 'transparent',
      paddingVertical: scaleHeight(14),
      borderRadius: scaleWidth(12),
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    secondaryButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: scaleWidth(10),
    },
    secondaryButtonText: {
      color: isDarkMode ? colors.white : colors.text,
      fontSize: Platform.OS === 'android' ? scaleFont(12) : scaleFont(16),
      fontWeight: '600',
    },
    orText: {
      marginTop: scaleHeight(16),
      marginBottom: scaleHeight(12),
      color: colors.textSecondary,
      fontSize: Platform.OS === 'android' ? scaleFont(12) : scaleFont(16),
      fontWeight: '700',
      textAlign: 'center',
    },
  });
