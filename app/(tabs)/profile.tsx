import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Settings, Grid, Heart, MessageSquare, Edit, Gift, Briefcase, Star } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { scaleFont, scaleHeight, scaleWidth } from '@/utils/responsive';
import { mockProperties } from '@/mocks/properties';
import { Property } from '@/types';
import { Image } from 'expo-image';
import { useSubscription } from '@/contexts/SubscriptionContext';

type TabType = 'properties' | 'liked';

export default function ProfileScreen() {
  const router = useRouter();
  const bottomTabBarHeight = useBottomTabBarHeight();
  const [activeTab, setActiveTab] = useState<TabType>('properties');
  const { tier, postsUsed, postsLimit } = useSubscription();

  const userProperties = mockProperties.slice(0, 6);
  const likedProperties = mockProperties.slice(6, 12);

  const displayedProperties = activeTab === 'properties' ? userProperties : likedProperties;

  const renderPropertyItem = ({ item }: { item: Property }) => (
    <Pressable
      style={styles.gridItem}
      onPress={() => router.push(`/property/${item.id}`)}
    >
      <Image
        source={{ uri: item.thumbnailUrl }}
        style={styles.gridImage}
        contentFit="cover"
      />
      <View style={styles.gridOverlay}>
        <View style={styles.gridStats}>
          <View style={styles.gridStat}>
            <Heart size={scaleWidth(14)} color={Colors.textLight} fill={Colors.textLight} />
            <Text style={styles.gridStatText}>{item.likesCount}</Text>
          </View>
          <View style={styles.gridStat}>
            <MessageSquare size={scaleWidth(14)} color={Colors.textLight} />
            <Text style={styles.gridStatText}>{item.commentsCount}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <Pressable style={styles.settingsButton} onPress={() => router.push('/(tabs)/settings')}>
          <Settings size={scaleWidth(24)} color={Colors.text} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomTabBarHeight + scaleHeight(16) }}
      >
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>JS</Text>
            </View>
            <Pressable style={styles.editAvatarButton}>
              <Edit size={scaleWidth(16)} color={Colors.textLight} />
            </Pressable>
          </View>

          <Text style={styles.userName}>John Smith</Text>
          <Text style={styles.userBio}>Real Estate Agent | Dubai Marina Specialist</Text>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>24</Text>
              <Text style={styles.statLabel}>Properties</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>1.2K</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>342</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
          </View>

          <Pressable style={styles.editButton}>
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </Pressable>
        </View>

        <View style={styles.subscriptionCard}>
          <View style={styles.subscriptionHeader}>
            {tier === 'premium' ? (
              <Star size={scaleWidth(20)} color={Colors.bronze} fill={Colors.bronze} />
            ) : tier === 'basic' ? (
              <Briefcase size={scaleWidth(20)} color={Colors.bronze} />
            ) : (
              <Gift size={scaleWidth(20)} color={Colors.bronze} />
            )}
            <Text style={styles.subscriptionTier}>
              {tier === 'free' && 'Free Tier'}
              {tier === 'basic' && 'Basic Agent'}
              {tier === 'premium' && 'Premium Agent ⭐'}
            </Text>
          </View>

          <Text style={styles.subscriptionUsage}>
            {tier === 'premium'
              ? 'Unlimited posts'
              : tier === 'basic'
              ? `${postsUsed}/${postsLimit} posts used this month`
              : `${postsUsed}/1 post used`
            }
          </Text>

          {tier !== 'premium' && (
            <Pressable
              style={styles.upgradeButton}
              onPress={() => router.push('/paywall')}
            >
              <Text style={styles.upgradeButtonText}>
                {tier === 'free' ? 'View Plans' : 'Upgrade to Premium'}
              </Text>
            </Pressable>
          )}

          {tier === 'premium' && (
            <Text style={styles.premiumBadgeText}>
              ✓ Instagram promotion included
            </Text>
          )}
        </View>

        <View style={styles.tabsContainer}>
          <Pressable
            style={[styles.tab, activeTab === 'properties' && styles.tabActive]}
            onPress={() => setActiveTab('properties')}
          >
            <Grid size={scaleWidth(20)} color={activeTab === 'properties' ? Colors.bronze : Colors.textSecondary} />
            <Text style={[styles.tabText, activeTab === 'properties' && styles.tabTextActive]}>
              Properties
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'liked' && styles.tabActive]}
            onPress={() => setActiveTab('liked')}
          >
            <Heart size={scaleWidth(20)} color={activeTab === 'liked' ? Colors.bronze : Colors.textSecondary} />
            <Text style={[styles.tabText, activeTab === 'liked' && styles.tabTextActive]}>
              Liked
            </Text>
          </Pressable>
        </View>

        <FlatList
          data={displayedProperties}
          renderItem={renderPropertyItem}
          keyExtractor={(item) => item.id}
          numColumns={3}
          scrollEnabled={false}
          contentContainerStyle={styles.gridContainer}
        />
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: scaleHeight(60),
    paddingHorizontal: scaleWidth(20),
    paddingBottom: scaleHeight(16),
  },
  headerTitle: {
    fontSize: scaleFont(32),
    fontWeight: '700',
    color: Colors.text,
  },
  settingsButton: {
    width: scaleWidth(40),
    height: scaleHeight(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: scaleHeight(24),
    paddingHorizontal: scaleWidth(20),
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatarContainer: {
    position: 'relative' as const,
    marginBottom: scaleHeight(16),
  },
  avatar: {
    width: scaleWidth(100),
    height: scaleHeight(100),
    borderRadius: scaleWidth(50),
    backgroundColor: Colors.bronze,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.textLight,
  },
  avatarText: {
    fontSize: scaleFont(36),
    fontWeight: '700',
    color: Colors.textLight,
  },
  editAvatarButton: {
    position: 'absolute' as const,
    bottom: 0,
    right: 0,
    width: scaleWidth(32),
    height: scaleHeight(32),
    borderRadius: scaleWidth(16),
    backgroundColor: Colors.bronze,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  userName: {
    fontSize: scaleFont(24),
    fontWeight: '700',
    color: Colors.text,
    marginBottom: scaleHeight(4),
  },
  userBio: {
    fontSize: scaleFont(14),
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: scaleHeight(20),
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(24),
    marginBottom: scaleHeight(20),
  },
  statItem: {
    alignItems: 'center',
    gap: scaleWidth(4),
  },
  statNumber: {
    fontSize: scaleFont(20),
    fontWeight: '700',
    color: Colors.text,
  },
  statLabel: {
    fontSize: scaleFont(13),
    color: Colors.textSecondary,
  },
  statDivider: {
    width: scaleWidth(1),
    height: scaleHeight(24),
    backgroundColor: Colors.border,
  },
  editButton: {
    width: '100%',
    paddingVertical: scaleHeight(12),
    borderRadius: scaleWidth(12),
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.textLight,
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: Colors.text,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scaleWidth(8),
    paddingVertical: scaleHeight(16),
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Colors.bronze,
  },
  tabText: {
    fontSize: scaleFont(15),
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.bronze,
  },
  gridContainer: {
    padding: scaleWidth(2),
  },
  gridItem: {
    flex: 1,
    aspectRatio: 1,
    margin: scaleWidth(2),
    backgroundColor: Colors.textLight,
    position: 'relative' as const,
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    justifyContent: 'flex-end',
    padding: scaleWidth(8),
  },
  gridStats: {
    flexDirection: 'row',
    gap: scaleWidth(12),
  },
  gridStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(4),
  },
  gridStatText: {
    fontSize: scaleFont(12),
    fontWeight: '600',
    color: Colors.textLight,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  subscriptionCard: {
    backgroundColor: '#FFF9F0',
    borderRadius: scaleWidth(12),
    padding: scaleWidth(16),
    marginHorizontal: scaleWidth(20),
    marginBottom: scaleHeight(20),
    marginTop: scaleHeight(20),
    borderWidth: 1,
    borderColor: Colors.bronze,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(8),
    marginBottom: scaleHeight(8),
  },
  subscriptionTier: {
    fontSize: scaleFont(16),
    fontWeight: '700',
    color: Colors.text,
  },
  subscriptionUsage: {
    fontSize: scaleFont(14),
    color: Colors.textSecondary,
    marginBottom: scaleHeight(12),
  },
  upgradeButton: {
    backgroundColor: Colors.bronze,
    paddingVertical: scaleHeight(10),
    paddingHorizontal: scaleWidth(16),
    borderRadius: scaleWidth(8),
    alignItems: 'center',
  },
  upgradeButtonText: {
    color: Colors.textLight,
    fontSize: scaleFont(14),
    fontWeight: '600',
  },
  premiumBadgeText: {
    fontSize: scaleFont(12),
    color: Colors.bronze,
    fontWeight: '600',
  },
});
