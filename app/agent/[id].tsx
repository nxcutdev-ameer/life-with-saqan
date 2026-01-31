import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Grid, Heart } from 'lucide-react-native';
import { Image } from 'expo-image';

import { Colors } from '@/constants/colors';
import { scaleFont, scaleHeight, scaleWidth } from '@/utils/responsive';
import { mockProperties } from '@/mocks/properties';
import { Property } from '@/types';

type TabType = 'properties' | 'liked';

export default function AgentProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('properties');

  const agentId = params.id;

  // UI-only for now: until a dedicated agent profile endpoint is implemented.
  const agentProperties = useMemo(() => {
    // mockProperties currently uses string ids; try to match either agent.id or agent.agentId.
    return mockProperties.filter((p) => p.agent?.id === agentId || String((p.agent as any)?.agentId) === agentId);
  }, [agentId]);

  const agent = agentProperties[0]?.agent;

  const agentName = (agent?.name ?? `Agent ${agentId}`).trim() || `Agent ${agentId}`;
  const agentInitial = agentName.charAt(0).toUpperCase();

  const displayedProperties = activeTab === 'properties' ? agentProperties : mockProperties.slice(0, 6);

  const renderPropertyItem = ({ item }: { item: Property }) => (
    <Pressable style={styles.gridItem} onPress={() => router.push(`/property/${item.id}` as any)}>
      <Image source={{ uri: item.thumbnailUrl }} style={styles.gridImage} contentFit="cover" />
      <View style={styles.gridOverlay}>
        <View style={styles.gridStats}>
          <View style={styles.gridStat}>
            <Heart size={scaleWidth(14)} color={Colors.textLight} fill={Colors.textLight} />
            <Text style={styles.gridStatText}>{item.likesCount}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={10}>
          <ArrowLeft size={scaleWidth(24)} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Agent</Text>
        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + scaleHeight(16) }}
      >
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{agentInitial}</Text>
            </View>
          </View>

          <Text style={styles.userName}>{agentName}</Text>
          <Text style={styles.userBio}>Real Estate Agent</Text>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{agentProperties.length}</Text>
              <Text style={styles.statLabel}>Properties</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>—</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>—</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
          </View>

          <Pressable style={styles.editButton} onPress={() => {}}>
            <Text style={styles.editButtonText}>Contact Agent</Text>
          </Pressable>
        </View>

        <View style={styles.tabsContainer}>
          <Pressable style={[styles.tab, activeTab === 'properties' && styles.tabActive]} onPress={() => setActiveTab('properties')}>
            <Grid size={scaleWidth(20)} color={activeTab === 'properties' ? Colors.bronze : Colors.textSecondary} />
            <Text style={[styles.tabText, activeTab === 'properties' && styles.tabTextActive]}>Properties</Text>
          </Pressable>
          {/* <Pressable style={[styles.tab, activeTab === 'liked' && styles.tabActive]} onPress={() => setActiveTab('liked')}>
            <Heart size={scaleWidth(20)} color={activeTab === 'liked' ? Colors.bronze : Colors.textSecondary} />
            <Text style={[styles.tabText, activeTab === 'liked' && styles.tabTextActive]}>Liked</Text>
          </Pressable> */}
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
    fontSize: scaleFont(22),
    fontWeight: '700',
    color: Colors.text,
  },
  backButton: {
    width: scaleWidth(40),
    height: scaleHeight(40),
    alignItems: 'center',
    justifyContent: 'center',
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
  },
  avatarText: {
    fontSize: scaleFont(36),
    fontWeight: '700',
    color: Colors.textLight,
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
    fontSize: scaleFont(14),
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.bronze,
  },
  gridContainer: {
    paddingHorizontal: scaleWidth(2),
  },
  gridItem: {
    width: '33.33%',
    aspectRatio: 1,
    padding: scaleWidth(1),
  },
  gridImage: {
    width: '100%',
    height: '100%',
    borderRadius: scaleWidth(8),
  },
  gridOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: scaleWidth(8),
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'flex-end',
  },
  gridStats: {
    flexDirection: 'row',
    padding: scaleWidth(6),
  },
  gridStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(4),
  },
  gridStatText: {
    color: Colors.textLight,
    fontSize: scaleFont(12),
    fontWeight: '700',
  },
});
