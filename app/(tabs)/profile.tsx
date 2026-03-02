import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View, ScrollView, Pressable, FlatList, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { buildPropertyDetailsRoute } from '@/utils/routes';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Settings, Grid, Heart, MessageSquare, Edit, Gift, Briefcase, Star } from 'lucide-react-native';
import type { ThemeColors } from '@/constants/theme';
import { scaleFont, scaleHeight, scaleWidth } from '@/utils/responsive';
import { useTheme } from '@/utils/useTheme';
import { mockProperties } from '@/mocks/properties';
import { fetchPublicAgentVideos } from '@/utils/publicVideosApi';
import { mapPublicVideoToProperty } from '@/utils/publicVideoMapper';
import { Property } from '@/types';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { uploadProfileAvatar } from '@/utils/profileApi';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuthStore } from '@/stores/authStore';
import { SavingSpinner } from '@/components/SavingSpinner';

type TabType = 'properties' | 'liked';

export default function ProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const bottomTabBarHeight = useBottomTabBarHeight();
  const [activeTab, setActiveTab] = useState<TabType>('properties');
  const { tier, postsUsed, postsLimit } = useSubscription();
  const token = useAuthStore((s) =>
    s.session?.tokens?.saqancomToken || s.session?.tokens?.backofficeToken || s.session?.tokens?.propertiesToken
  );
  const agent = useAuthStore((s) => s.session?.agent);
  const backofficeToken = useAuthStore((s) => s.session?.tokens?.backofficeToken);
  const setSession = useAuthStore((s) => s.setSession);
  const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const handlePickAvatar = async () => {
    try {
      if (!backofficeToken) {
        Alert.alert('Login required', 'Missing Backoffice token. Please log in again.');
        return;
      }

      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Permission required', 'Please allow access to your photos to update your avatar.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'] as any,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      setLocalAvatarUri(asset.uri);

      setIsUploadingAvatar(true);
      const res = await uploadProfileAvatar({
        backofficeToken,
        uri: asset.uri,
        fileName: asset.fileName ?? undefined,
        mimeType: asset.mimeType ?? undefined,
      });

      const uploadedUrl = (res as any)?.payload?.avatar_url ?? null;

      // Persist the new avatar url in the global store
      setSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          agent: prev.agent ? { ...prev.agent, avatarUrl: uploadedUrl ?? prev.agent.avatarUrl } : prev.agent,
        };
      });

      if (!uploadedUrl) {
        Alert.alert('Updated', 'Avatar uploaded successfully.');
      }
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? 'Could not upload avatar.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const [agentVideos, setAgentVideos] = useState<Property[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);

  const likedProperties = mockProperties.slice(6, 12);

  const displayedProperties = useMemo(() => {
    return activeTab === 'properties' ? agentVideos : likedProperties;
  }, [activeTab, agentVideos, likedProperties]);

  // Public videos endpoint expects numeric backend agent id.
  const agentId = agent?.id;

  const loadAgentVideos = useCallback(
    async (opts?: { isActive?: () => boolean }) => {
      if (activeTab !== 'properties') return;

      if (!agentId) {
        // Fallback to mocked properties if agentId is not available.
        if (!opts?.isActive || opts.isActive()) setAgentVideos(mockProperties.slice(0, 6));
        return;
      }

      try {
        if (!opts?.isActive || opts.isActive()) setIsLoadingVideos(true);
        const res = await fetchPublicAgentVideos({ agentId, perPage: 20, page: 1 });
        const mapped = (res?.data ?? []).map(mapPublicVideoToProperty);
        if (!opts?.isActive || opts.isActive()) setAgentVideos(mapped);
      } catch (e: any) {
        if (!opts?.isActive || opts.isActive()) {
          setAgentVideos([]);
          Alert.alert('Error', e?.message ?? 'Failed to load your videos');
        }
      } finally {
        if (!opts?.isActive || opts.isActive()) setIsLoadingVideos(false);
      }
    },
    [activeTab, agentId]
  );

  // Refresh whenever the screen becomes focused.
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      void loadAgentVideos({ isActive: () => isActive });

      return () => {
        isActive = false;
      };
    }, [loadAgentVideos])
  );

  // Also refresh when switching back to the Properties tab while staying on this screen.
  useEffect(() => {
    if (activeTab !== 'properties') return;
    void loadAgentVideos();
  }, [activeTab, loadAgentVideos]);

  const renderPropertyItem = ({ item }: { item: Property }) => (
    <Pressable
      style={styles.gridItem}
      onPress={() =>
          router.push(
            buildPropertyDetailsRoute({
              propertyReference: item.propertyReference,
              id: item.id,
              mode: item.type === 'offplan' ? 'offplan' : undefined,
            }) as any
          )
        }
    >
      <Image
        source={{ uri: item.thumbnailUrl }}
        style={styles.gridImage}
        contentFit="cover"
      />
      <View style={styles.gridOverlay}>
        <View style={styles.gridStats}>
          <View style={styles.gridStat}>
            <Heart size={scaleWidth(14)} color={colors.white} fill={colors.white} />
            <Text style={styles.gridStatText}>{item.likesCount}</Text>
          </View>
          <View style={styles.gridStat}>
            <MessageSquare size={scaleWidth(14)} color={colors.white} />
            <Text style={styles.gridStatText}>{item.commentsCount}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );

  if (!token) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
        </View>

        <View style={[styles.contentContainer, { paddingBottom: bottomTabBarHeight + scaleHeight(16) }]}>
          <View style={[styles.authGateCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.authGateTitle, { color: colors.text }]}>Login required</Text>
            <Text style={[styles.authGateDescription, { color: colors.textSecondary }]}>Only logged in users can view profile.</Text>
            <Pressable style={[styles.authGateButton, { backgroundColor: colors.primary }]} onPress={() => router.replace('/auth/login' as any)}>
              <Text style={[styles.authGateButtonText, { color: colors.textOnPrimary }]}>Log in</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
        <Pressable style={styles.settingsButton} onPress={() => router.push('/(tabs)/settings')}>
          <Settings size={scaleWidth(24)} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomTabBarHeight + scaleHeight(16) }}
      >
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              {localAvatarUri || agent?.avatarUrl ? (
                <Image
                  source={{ uri: localAvatarUri || agent?.avatarUrl || '' }}
                  style={styles.avatarImage}
                  contentFit="cover"
                />
              ) : (
                <Text style={styles.avatarText}>
                  {(agent?.name ?? 'A').trim().charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
            <Pressable
              style={[styles.editAvatarButton, isUploadingAvatar && { opacity: 0.7 }]}
              onPress={handlePickAvatar}
              disabled={isUploadingAvatar}
            >
              <Edit size={scaleWidth(16)} color={colors.textOnPrimary} />
            </Pressable>
          </View>

          <Text style={[styles.userName, { color: colors.text }]}>{agent?.name ?? 'Agent'}</Text>
          <Text style={[styles.userBio, { color: colors.textSecondary }]}>Real Estate Agent</Text>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.text }]}>{displayedProperties.length}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Properties</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.text }]}>0</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Followers</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.text }]}>0</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Following</Text>
            </View>
          </View>

          <Pressable style={[styles.editButton, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Text style={[styles.editButtonText, { color: colors.text }]}>Edit Profile</Text>
          </Pressable>
        </View>

        <View style={[styles.subscriptionCard, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
          <View style={styles.subscriptionHeader}>
            {tier === 'premium' ? (
              <Star size={scaleWidth(20)} color={colors.primary} fill={colors.primary} />
            ) : tier === 'basic' ? (
              <Briefcase size={scaleWidth(20)} color={colors.primary} />
            ) : (
              <Gift size={scaleWidth(20)} color={colors.primary} />
            )}
            <Text style={[styles.subscriptionTier, { color: colors.text }]}>
              {tier === 'free' && 'Free Tier'}
              {tier === 'basic' && 'Basic Agent'}
              {tier === 'premium' && 'Premium Agent ⭐'}
            </Text>
          </View>

          <Text style={[styles.subscriptionUsage, { color: colors.textSecondary }]}>
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
            <Text style={[styles.premiumBadgeText, { color: colors.primary }]}>
              ✓ Instagram promotion included
            </Text>
          )}
        </View>

        <View style={styles.tabsContainer}>
          <Pressable
            style={[styles.tab, activeTab === 'properties' && styles.tabActive]}
            onPress={() => setActiveTab('properties')}
          >
            <Grid size={scaleWidth(20)} color={activeTab === 'properties' ? colors.primary : colors.textSecondary} />
            <Text style={[styles.tabText, activeTab === 'properties' && styles.tabTextActive]}>
              Properties
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'liked' && styles.tabActive]}
            onPress={() => setActiveTab('liked')}
          >
            <Heart size={scaleWidth(20)} color={activeTab === 'liked' ? colors.primary : colors.textSecondary} />
            <Text style={[styles.tabText, activeTab === 'liked' && styles.tabTextActive]}>
              Liked
            </Text>
          </Pressable>
        </View>

        {activeTab === 'properties' && isLoadingVideos ? (
          <View style={{ paddingVertical: scaleHeight(24), alignItems: 'center'}}>
            <SavingSpinner color={colors.primary} accessibilityLabel="Loading videos" />
          </View>
        ) : null}

        <FlatList
          data={displayedProperties}
          renderItem={renderPropertyItem}
          keyExtractor={(item) => String(item.id)}
          numColumns={3}
          scrollEnabled={false}
          contentContainerStyle={styles.gridContainer}
          ListEmptyComponent={
            activeTab === 'properties' ? (
              <View style={{ paddingVertical: scaleHeight(24), alignItems: 'center' }}>
                <Text style={{ color: colors.textSecondary }}>No videos yet</Text>
              </View>
            ) : null
          }
        />
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: scaleHeight(60),
    paddingHorizontal: scaleWidth(20),
    paddingBottom: scaleHeight(16),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: Platform.OS === 'android' ? scaleFont(16): scaleFont(18),
    fontWeight: '700',
    color: colors.text,
  },
  settingsButton: {
    width: scaleWidth(40),
    height: scaleHeight(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: scaleWidth(20),
    paddingTop: scaleHeight(24),
  },
  authGateCard: {
    marginTop: scaleHeight(16),
    backgroundColor: colors.surface,
    borderRadius: scaleWidth(16),
    padding: scaleWidth(20),
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  authGateTitle: {
    fontSize: Platform.OS === 'android' ? scaleFont(18): scaleFont(20),
    fontWeight: '800',
    color: colors.text,
    marginBottom: scaleHeight(6),
  },
  authGateDescription: {
    fontSize: Platform.OS === 'android' ? scaleFont(12): scaleFont(14),
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: scaleFont(20),
    marginBottom: scaleHeight(14),
  },
  authGateButton: {
    width: '100%',
    backgroundColor: colors.primary,
    paddingVertical: scaleHeight(14),
    borderRadius: scaleWidth(12),
    alignItems: 'center',
    marginBottom: scaleHeight(12),
  },
  authGateButtonText: {
    color: colors.textOnPrimary,
    fontSize: Platform.OS === 'android' ? scaleFont(14): scaleFont(16),
    fontWeight: '700',
  },
  authGateLink: {
    color: colors.primary,
    fontSize: Platform.OS === 'android' ? scaleFont(12): scaleFont(14),
    fontWeight: '700',
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: scaleHeight(24),
    paddingHorizontal: scaleWidth(20),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatarContainer: {
    position: 'relative' as const,
    marginBottom: scaleHeight(16),
  },
  avatar: {
    width: scaleWidth(100),
    height: scaleHeight(100),
    borderRadius: scaleWidth(50),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.surface,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: scaleWidth(50),
  },
  avatarText: {
    fontSize: Platform.OS === 'android' ? scaleFont(18): scaleFont(28),
    fontWeight: '700',
    color: colors.textOnPrimary,
  },
  editAvatarButton: {
    position: 'absolute' as const,
    bottom: 0,
    right: 0,
    width: scaleWidth(32),
    height: scaleHeight(32),
    borderRadius: scaleWidth(16),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  userName: {
    fontSize: Platform.OS === 'android' ? scaleFont(16): scaleFont(24),
    fontWeight: '700',
    color: colors.text,
    marginBottom: scaleHeight(4),
  },
  userBio: {
    fontSize: Platform.OS === 'android' ? scaleFont(12): scaleFont(14),
    color: colors.textSecondary,
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
    fontSize: Platform.OS === 'android' ? scaleFont(16): scaleFont(20),
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    fontSize: Platform.OS === 'android' ? scaleFont(10): scaleFont(13),
    color: colors.textSecondary,
  },
  statDivider: {
    width: scaleWidth(1),
    height: scaleHeight(24),
    backgroundColor: colors.border,
  },
  editButton: {
    width: '100%',
    paddingVertical: scaleHeight(12),
    borderRadius: scaleWidth(12),
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: Platform.OS === 'android' ? scaleFont(14): scaleFont(16),
    fontWeight: '600',
    color: colors.text,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: Platform.OS === 'android' ? scaleFont(13): scaleFont(15),
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.primary,
  },
  gridContainer: {
    padding: scaleWidth(2),
  },
  gridItem: {
    flex: 1,
    aspectRatio: 1,
    margin: scaleWidth(2),
    backgroundColor: colors.surface,
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
    fontSize: Platform.OS === 'android' ? scaleFont(10): scaleFont(12),
    fontWeight: '600',
    color: colors.white,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  subscriptionCard: {
    backgroundColor: colors.surface,
    borderRadius: scaleWidth(12),
    padding: scaleWidth(16),
    marginHorizontal: scaleWidth(20),
    marginBottom: scaleHeight(20),
    marginTop: scaleHeight(20),
    borderWidth: 1,
    borderColor: colors.primary,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(8),
    marginBottom: scaleHeight(8),
  },
  subscriptionTier: {
    fontSize: Platform.OS === 'android' ? scaleFont(14): scaleFont(16),
    fontWeight: '700',
    color: colors.text,
  },
  subscriptionUsage: {
    fontSize: Platform.OS === 'android' ? scaleFont(12): scaleFont(14),
    color: colors.textSecondary,
    marginBottom: scaleHeight(12),
  },
  upgradeButton: {
    backgroundColor: colors.primary,
    paddingVertical: scaleHeight(10),
    paddingHorizontal: scaleWidth(16),
    borderRadius: scaleWidth(8),
    alignItems: 'center',
  },
  upgradeButtonText: {
    color: colors.textOnPrimary,
    fontSize: Platform.OS === 'android' ? scaleFont(12): scaleFont(14),
    fontWeight: '600',
  },
  premiumBadgeText: {
    fontSize: Platform.OS === 'android' ? scaleFont(10): scaleFont(12),
    color: colors.primary,
    fontWeight: '600',
  },
});
