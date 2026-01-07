import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { X, Check } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';

type SubscriptionTier = 'free' | 'basic' | 'premium';

export default function PaywallScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState<SubscriptionTier | null>(null);

  const handleSubscribe = async (tier: SubscriptionTier) => {
    setLoading(tier);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      await AsyncStorage.setItem('@subscription_tier', tier);
      await AsyncStorage.setItem('@subscription_start', new Date().toISOString());

      const currentMonth = new Date().toISOString().slice(0, 7);
      await AsyncStorage.setItem(`@posts_used_${currentMonth}`, '0');

      setLoading(null);

      Alert.alert(
        'Success! 🎉',
        tier === 'free'
          ? 'You can now post 1 property for free!'
          : `${tier === 'basic' ? 'Basic' : 'Premium'} subscription activated!`,
        [{ text: 'Get Started', onPress: () => router.back() }]
      );
    } catch {
      setLoading(null);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  const PricingCard = ({
    badge,
    badgeColor,
    icon,
    title,
    price,
    priceSubtext,
    description,
    features,
    tier,
    isPopular = false,
  }: {
    badge: string;
    badgeColor: string;
    icon: string;
    title: string;
    price: string;
    priceSubtext?: string;
    description?: string;
    features: string[];
    tier: SubscriptionTier;
    isPopular?: boolean;
  }) => (
    <View style={[styles.card, isPopular && styles.cardPopular]}>
      <View style={[styles.badge, { backgroundColor: badgeColor }]}>
        <Text style={styles.badgeText}>{badge}</Text>
      </View>

      <Text style={styles.cardIcon}>{icon}</Text>
      <Text style={styles.cardTitle}>{title}</Text>

      <View style={styles.priceContainer}>
        <Text style={styles.price}>{price}</Text>
        {priceSubtext && <Text style={styles.priceSubtext}>{priceSubtext}</Text>}
      </View>

      {description && <Text style={styles.cardDescription}>{description}</Text>}

      <View style={styles.featuresContainer}>
        {features.map((feature, index) => (
          <View key={index} style={styles.feature}>
            <Check size={16} color={Colors.bronze} strokeWidth={3} />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>

      <Pressable
        style={[
          styles.subscribeButton,
          tier === 'free' ? styles.subscribeButtonOutlined : styles.subscribeButtonFilled,
          loading === tier && styles.subscribeButtonDisabled,
        ]}
        onPress={() => handleSubscribe(tier)}
        disabled={loading !== null}
      >
        {loading === tier ? (
          <ActivityIndicator color={tier === 'free' ? Colors.bronze : Colors.textLight} />
        ) : (
          <Text
            style={[
              styles.subscribeButtonText,
              tier === 'free'
                ? styles.subscribeButtonTextOutlined
                : styles.subscribeButtonTextFilled,
            ]}
          >
            {tier === 'free' ? 'Start Free' : 'Subscribe'}
          </Text>
        )}
      </Pressable>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Choose Your Plan</Text>
          <Text style={styles.headerSubtitle}>Post properties and grow your business</Text>
        </View>
        <Pressable style={styles.closeButton} onPress={() => router.back()}>
          <X size={24} color={Colors.text} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <PricingCard
          badge="TRY IT FREE"
          badgeColor="#27AE60"
          icon="🎁"
          title="Starter"
          price="FREE"
          features={[
            '1 property post',
            'Basic visibility',
            'No credit card required',
          ]}
          tier="free"
        />

        <PricingCard
          badge="POPULAR"
          badgeColor={Colors.bronze}
          icon="💼"
          title="Basic Agent"
          price="100 AED"
          priceSubtext="per month"
          description="Perfect for individual agents"
          features={[
            '10 property posts/month',
            'Standard visibility',
            'Basic analytics',
            'Extra posts: 15 AED each',
          ]}
          tier="basic"
          isPopular
        />

        <PricingCard
          badge="BEST VALUE"
          badgeColor="#D4AF37"
          icon="⭐"
          title="Premium Agent"
          price="300 AED"
          priceSubtext="per month"
          description="For agencies & high-volume agents"
          features={[
            'UNLIMITED property posts',
            'FREE Instagram promotion 📸',
            'Priority listing placement',
            'Advanced analytics',
            'Dedicated support',
          ]}
          tier="premium"
        />

        <View style={styles.footer}>
          <Text style={styles.footerText}>Cancel anytime • Secure payment via Stripe</Text>
          <View style={styles.footerLinks}>
            <Text style={styles.footerLink}>Terms</Text>
            <Text style={styles.footerDivider}>|</Text>
            <Text style={styles.footerLink}>Privacy</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute' as const,
    right: 20,
    top: 60,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 28,
    position: 'relative' as const,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardPopular: {
    borderWidth: 2,
    borderColor: Colors.bronze,
  },
  badge: {
    position: 'absolute' as const,
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  cardIcon: {
    fontSize: 56,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  priceContainer: {
    marginBottom: 8,
  },
  price: {
    fontSize: 44,
    fontWeight: '700',
    color: Colors.bronze,
    lineHeight: 48,
  },
  priceSubtext: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: -4,
  },
  cardDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  featuresContainer: {
    gap: 12,
    marginBottom: 20,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },
  subscribeButton: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.bronze,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  subscribeButtonFilled: {
    backgroundColor: Colors.bronze,
  },
  subscribeButtonOutlined: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Colors.bronze,
  },
  subscribeButtonDisabled: {
    opacity: 0.5,
  },
  subscribeButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  subscribeButtonTextFilled: {
    color: Colors.textLight,
  },
  subscribeButtonTextOutlined: {
    color: Colors.bronze,
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
    gap: 8,
  },
  footerText: {
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  footerLinks: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  footerLink: {
    fontSize: 10,
    color: Colors.textSecondary,
    textDecorationLine: 'underline',
  },
  footerDivider: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
});
