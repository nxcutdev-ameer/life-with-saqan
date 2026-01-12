import React, { useEffect, useMemo } from 'react';
import {
  Alert,
  ImageBackground,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { scaleFont, scaleHeight, scaleWidth } from '@/utils/responsive';

export default function BrokerQuestionScreen() {
  const router = useRouter();
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: false } as any);
  }, [navigation]);

  const onNo = () => {
    Alert.alert('Registration restricted', 'Only brokers are allowed to register.');
  };

  const onYes = () => {
    router.replace('/auth/otp-verification' as any);
  };

  const backgroundSource = useMemo(
    () => ({ uri: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=1200&q=80' }),
    []
  );

  return (
    <ImageBackground source={backgroundSource} style={styles.container} resizeMode="cover">
      <LinearGradient
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0 }}
        colors={['rgba(243, 237, 223, 0.3)', 'rgba(240, 228, 228, 0.85)']}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>Are You Broker?</Text>
            </View>

            <View style={styles.card}>
              <Pressable style={styles.primaryButton} onPress={onYes}>
                <Text style={styles.primaryButtonText}>Yes</Text>
              </Pressable>

              <Pressable style={styles.secondaryButton} onPress={onNo}>
                <Text style={styles.secondaryButtonText}>No</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
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
  card: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: scaleWidth(16),
    padding: scaleWidth(16),
    backgroundColor: 'transparent',
    gap: scaleHeight(12),
  },
  primaryButton: {
    backgroundColor: Colors.bronze,
    paddingVertical: scaleHeight(14),
    borderRadius: scaleWidth(12),
    alignItems: 'center',
  },
  primaryButtonText: {
    color: Colors.textLight,
    fontSize: scaleFont(16),
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: scaleHeight(14),
    borderRadius: scaleWidth(12),
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: Colors.text,
    fontSize: scaleFont(16),
    fontWeight: '700',
  },
});
