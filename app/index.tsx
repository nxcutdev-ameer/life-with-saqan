import React from 'react';
import { StyleSheet, Text, View, Pressable, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { Menu } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { LinearGradient } from 'expo-linear-gradient';

export default function LandingScreen() {
  const router = useRouter();

  return (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=1200&q=80' }}
      style={styles.container}
      resizeMode="cover"
    >
      <LinearGradient
        colors={['rgba(243, 237, 223, 0.3)', 'rgba(243, 237, 223, 0.85)']}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <Pressable style={styles.menuButton}>
            <Menu size={24} color={Colors.text} />
          </Pressable>
          <Text style={styles.logo}>saqan</Text>
          <View style={styles.menuButton} />
        </View>

        <View style={styles.content}>
          <Text style={styles.heroTitle}>LIFE WITH SAQAN</Text>
          <Text style={styles.tagline}>
            Communities designed to connect you with yourself, your neighbors, and the natural world.
          </Text>

          <View style={styles.buttonContainer}>
            <Pressable
              style={styles.primaryButton}
              onPress={() => router.push('/locations')}
            >
              <Text style={styles.primaryButtonText}>Locations</Text>
            </Pressable>

            <Pressable style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Why Saqan ↓</Text>
            </Pressable>
          </View>
        </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  menuButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontSize: 24,
    fontWeight: '400',
    color: Colors.text,
    letterSpacing: 2,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  heroTitle: {
    fontSize: 48,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 48,
    maxWidth: 400,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 400,
    gap: 16,
  },
  primaryButton: {
    backgroundColor: Colors.bronze,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: Colors.textLight,
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: Colors.text,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '400',
  },
});
