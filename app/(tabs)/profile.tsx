import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View, ScrollView, Pressable, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { buildPropertyDetailsRoute } from '@/utils/routes';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Settings, Grid, Heart, MessageSquare, Edit, Gift, Briefcase, Star } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { scaleFont, scaleHeight, scaleWidth } from '@/utils/responsive';
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

      // Show immediately
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
        // If backend doesn't return url, keep local preview.
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
  // Our auth store's agent.id is numeric and matches that backend id.
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
      onPress={() => router.push(buildPropertyDetailsRoute({ propertyReference: item.propertyReference, id: item.id }) as any)}
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

  if (!token) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        <View style={[styles.contentContainer, { paddingBottom: bottomTabBarHeight + scaleHeight(16) }]}>
          <View style={styles.authGateCard}>
            <Text style={styles.authGateTitle}>Login required</Text>
            <Text style={styles.authGateDescription}>Only logged in users can upload videos.</Text>
            <Pressable style={styles.authGateButton} onPress={() => router.replace('/auth/login' as any)}>
              <Text style={styles.authGateButtonText}>Log in</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

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
              <Edit size={scaleWidth(16)} color={Colors.textLight} />
            </Pressable>
          </View>

          <Text style={styles.userName}>{agent?.name ?? 'Agent'}</Text>
          <Text style={styles.userBio}>Real Estate Agent</Text>

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

        {activeTab === 'properties' && isLoadingVideos ? (
          <View style={{ paddingVertical: scaleHeight(24), alignItems: 'center'}}>
            <SavingSpinner color={Colors.bronze} accessibilityLabel="Loading videos" />
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
                <Text style={{ color: Colors.textSecondary }}>No videos yet</Text>
              </View>
            ) : null
          }
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: scaleFont(18),
    fontWeight: '700',
    color: Colors.text,
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
    backgroundColor: Colors.textLight,
    borderRadius: scaleWidth(16),
    padding: scaleWidth(20),
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  authGateTitle: {
    fontSize: scaleFont(20),
    fontWeight: '800',
    color: Colors.text,
    marginBottom: scaleHeight(6),
  },
  authGateDescription: {
    fontSize: scaleFont(14),
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: scaleFont(20),
    marginBottom: scaleHeight(14),
  },
  authGateButton: {
    width: '100%',
    backgroundColor: Colors.bronze,
    paddingVertical: scaleHeight(14),
    borderRadius: scaleWidth(12),
    alignItems: 'center',
    marginBottom: scaleHeight(12),
  },
  authGateButtonText: {
    color: Colors.textLight,
    fontSize: scaleFont(16),
    fontWeight: '700',
  },
  authGateLink: {
    color: Colors.brown,
    fontSize: scaleFont(14),
    fontWeight: '700',
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
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: scaleWidth(50),
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
