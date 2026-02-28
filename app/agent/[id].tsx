import React, { useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Alert, FlatList, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { buildPropertyDetailsRoute } from '@/utils/routes';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Grid, Heart, Mail, MessageCircle, Phone } from 'lucide-react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { scaleFont, scaleHeight, scaleWidth } from '@/utils/responsive';
import { mockProperties } from '@/mocks/properties';
import type { Agent, Property } from '@/types';
import { fetchPublicAgentVideos } from '@/utils/publicVideosApi';
import { mapPublicVideoToProperty } from '@/utils/publicVideoMapper';

type TabType = 'properties' | 'liked';

const isNumericId = (value: string) => /^\d+$/.test(value);

export default function AgentProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('properties');

  const agentIdParam = params.id;
  const shouldUseApi = Boolean(agentIdParam && isNumericId(agentIdParam));

  const [agent, setAgent] = useState<Agent | null>(null);
  const [agentProperties, setAgentProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const mockAgentProperties = useMemo(() => {
    if (!agentIdParam) return [];
    return mockProperties.filter((p) => p.agent?.id === agentIdParam || String((p.agent as any)?.agentId) === agentIdParam);
  }, [agentIdParam]);

  useFocusEffect(
    React.useCallback(() => {
      if (activeTab !== 'properties') return;

      // If agent id is not numeric, we can't call the public endpoint; fall back to mock.
      if (!agentIdParam || !shouldUseApi) {
        setAgentProperties(mockAgentProperties);
        setAgent(mockAgentProperties[0]?.agent ?? null);
        return;
      }

      let cancelled = false;

      (async () => {
        try {
          setIsLoading(true);
          const res = await fetchPublicAgentVideos({ agentId: agentIdParam, perPage: 20, page: 1 });
          const mapped = (res?.data ?? []).map(mapPublicVideoToProperty);

          if (cancelled) return;

          setAgentProperties(mapped);
          setAgent(mapped[0]?.agent ?? null);
        } catch (e: any) {
          if (cancelled) return;

          // Graceful fallback: still show something for non-prod / mocked agents.
          setAgentProperties(mockAgentProperties);
          setAgent(mockAgentProperties[0]?.agent ?? null);

          Alert.alert('Error', e?.message ?? 'Failed to load agent profile');
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [activeTab, agentIdParam, shouldUseApi, mockAgentProperties])
  );

  const agentName = (agent?.name ?? (agentIdParam ? `Agent ${agentIdParam}` : 'Agent')).trim() || 'Agent';
  const agentInitial = agentName.charAt(0).toUpperCase();

  const displayedProperties = activeTab === 'properties' ? agentProperties : mockProperties.slice(0, 6);

  const renderPropertyItem = ({ item }: { item: Property }) => (
    <Pressable style={styles.gridItem} onPress={() =>
        router.push(
          buildPropertyDetailsRoute({
            propertyReference: item.propertyReference,
            id: item.id,
            mode: item.type === 'offplan' ? 'offplan' : undefined,
            agentPhone: agent?.phone ?? undefined,
          }) as any
        )
      }>
      <Image source={{ uri: item.thumbnailUrl }} style={styles.gridImage} contentFit="cover" />
      <View style={styles.gridOverlay}>
        <View style={styles.gridStats}>
          <View style={styles.gridStat}>
            <Heart size={scaleWidth(14)} color={Colors.textLight} fill={Colors.textLight} />
            <Text style={styles.gridStatText}>{item.likesCount}</Text>
          </View>

          {item.location?.city ? (
            <View style={styles.gridStat}>
              <Text style={styles.gridEmirateText} numberOfLines={1}>
                {item.location.city}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );

  const openPhone = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const phone = agent?.phone ?? '';
    if (!phone) return;
    const telUrl = `tel:${phone}`;
    if (await Linking.canOpenURL(telUrl)) {
      await Linking.openURL(telUrl);
    }
  };

  const openWhatsApp = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const phone = (agent?.phone ?? '').replace(/\s+/g, '');
    if (!phone) return;

    const text = `Hi, I would like to inquiry about your property`;
    const encodedText = encodeURIComponent(text);

    const appUrl = `whatsapp://send?phone=${phone}&text=${encodedText}`;
    const webUrl = `https://wa.me/${phone}?text=${encodedText}`;

    if (await Linking.canOpenURL(appUrl)) {
      await Linking.openURL(appUrl);
      return;
    }

    await Linking.openURL(webUrl);
  };

  const openEmail = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const email = agent?.email ?? '';
    if (!email) return;

    const subject = encodeURIComponent(`Inquiry about property`);
    const body = encodeURIComponent(`Hi ${agentName}`);
    const mailtoUrl = `mailto:${email}?subject=${subject}&body=${body}`;

    if (await Linking.canOpenURL(mailtoUrl)) {
      await Linking.openURL(mailtoUrl);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={10}>
          <ArrowLeft size={scaleWidth(24)} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Agent</Text>
        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + scaleHeight(16) }}>
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              {agent?.photo ? (
                <Image source={{ uri: agent.photo }} style={styles.avatarImage} contentFit="cover" />
              ) : (
                <Text style={styles.avatarText}>{agentInitial}</Text>
              )}
            </View>
          </View>

          <Text style={styles.userName}>{agentName}</Text>
          <Text style={styles.userBio}>Real Estate Agent</Text>
            <View style={styles.statsRow}>
                      <View style={styles.statItem}>
                        <Text style={styles.statNumber}>{displayedProperties.length}</Text>
                        <Text style={styles.statLabel}>Properties</Text>
                      </View>
                      <View style={styles.statDivider} />
                      <View style={styles.statItem}>
                        <Text style={styles.statNumber}>0</Text>
                        <Text style={styles.statLabel}>Followers</Text>
                      </View>
                      <View style={styles.statDivider} />
                      <View style={styles.statItem}>
                        <Text style={styles.statNumber}>0</Text>
                        <Text style={styles.statLabel}>Following</Text>
                      </View>
                    </View>
                        
                  
          <View style={styles.statsRow}>
            {/* <View style={styles.statItem}>
              <Text style={styles.statNumber}>{agentProperties.length}</Text>
              <Text style={styles.statLabel}>Properties</Text>
            </View> */}
          </View>

          <View style={styles.contactButtons}>
            <Pressable style={[styles.contactIconButton, !(agent?.phone ?? '') && { opacity: 0.4 }]} onPress={openPhone} disabled={!(agent?.phone ?? '')}>
              <Phone size={scaleWidth(20)} color={Colors.bronze} />
            </Pressable>
            <Pressable style={[styles.contactIconButton, !(agent?.phone ?? '') && { opacity: 0.4 }]} onPress={openWhatsApp} disabled={!(agent?.phone ?? '')}>
              <MessageCircle size={scaleWidth(20)} color={Colors.bronze} />
            </Pressable>
            <Pressable style={[styles.contactIconButton, !(agent?.email ?? '') && { opacity: 0.4 }]} onPress={openEmail} disabled={!(agent?.email ?? '')}>
              <Mail size={scaleWidth(20)} color={Colors.bronze} />
            </Pressable>
          </View>
        </View>

        {/* <View style={styles.tabsContainer}>
          <Pressable style={[styles.tab, activeTab === 'properties' && styles.tabActive]} onPress={() => setActiveTab('properties')}>
            <Grid size={scaleWidth(20)} color={activeTab === 'properties' ? Colors.bronze : Colors.textSecondary} />
            <Text style={[styles.tabText, activeTab === 'properties' && styles.tabTextActive]}>Properties</Text>
          </Pressable>
        </View> */}

        {activeTab === 'properties' && isLoading ? (
          <View style={{ paddingVertical: scaleHeight(24) }}>
            <ActivityIndicator color={Colors.bronze} />
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
                <Text style={{ color: Colors.textSecondary }}>No properties</Text>
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
  },
  headerTitle: {
    fontSize: Platform.OS === 'android' ? scaleFont(18): scaleFont(22),
    fontWeight: '700',
    color: Colors.text,
  },
  backButton: {
    width: scaleWidth(40),
    height: scaleHeight(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactIconButton: {
    width: scaleWidth(48),
    height: scaleWidth(48),
    borderRadius: scaleWidth(24),
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.bronze,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactButtons: {
    flexDirection: 'row',
    gap: scaleWidth(12),
  },
  headerRightSpacer: {
    width: scaleWidth(40),
    height: scaleHeight(40),
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
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: Platform.OS === 'android' ? scaleFont(24): scaleFont(36),
    fontWeight: '700',
    color: Colors.textLight,
  },
  userName: {
    fontSize: Platform.OS === 'android' ? scaleFont(18): scaleFont(24),
    fontWeight: '700',
    color: Colors.text,
    marginBottom: scaleHeight(4),
  },
  userBio: {
    fontSize: Platform.OS === 'android' ? scaleFont(12): scaleFont(14),
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
   statDivider: {
    width: scaleWidth(1),
    height: scaleHeight(24),
    backgroundColor: Colors.border,
  },
  statNumber: {
    fontSize: Platform.OS === 'android' ? scaleFont(16): scaleFont(20),
    fontWeight: '700',
    color: Colors.text,
  },
  statLabel: {
    fontSize: scaleFont(13),
    color: Colors.textSecondary,
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
    fontSize: Platform.OS === 'android' ? scaleFont(13): scaleFont(15),
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
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gridStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(4),
  },
  gridStatText: {
    fontSize: Platform.OS === 'android' ? scaleFont(10): scaleFont(12),
    fontWeight: '600',
    color: Colors.textLight,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  gridEmirateText: {
    fontSize: Platform.OS === 'android' ? scaleFont(10): scaleFont(12),
    fontWeight: '600',
    color: Colors.textLight,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    maxWidth: scaleWidth(70),
  },
});
