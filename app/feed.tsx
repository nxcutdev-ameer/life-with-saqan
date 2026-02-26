import React, { useEffect, useRef, useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  Pressable, 
  FlatList, 
  Dimensions,
  ViewToken,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Video, ResizeMode } from 'expo-av';
import { Heart, MessageCircle, Bookmark, Share2, MapPin, Bed, Bath, Maximize, Search } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/colors';
import { mockProperties, filterProperties } from '@/mocks/properties';
import { LifestyleType, Property } from '@/types';
import * as Haptics from 'expo-haptics';
import { useEngagementStore } from '@/stores/engagementStore';
import { buildPropertyDetailsRoute } from '@/utils/routes';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function FeedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ 
    transactionType?: string; 
    location?: string; 
    lifestyles?: string;
  }>();
  
  const lifestyles = params.lifestyles ? params.lifestyles.split(',') as LifestyleType[] : [];
  const filteredProperties = filterProperties(
    mockProperties,
    params.transactionType,
    params.location,
    lifestyles
  );

  const [viewableItems, setViewableItems] = useState<string[]>([]);
  const { hydrated: likesHydrated, hydrate: hydrateLikes, toggleLike: toggleLikeGlobal, isLiked: isLikedGlobal } =
    useEngagementStore();

  useEffect(() => {
    if (!likesHydrated) hydrateLikes();
  }, [hydrateLikes, likesHydrated]);
  const [savedProperties, setSavedProperties] = useState<Set<string>>(new Set());

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
  }).current;

  const onViewableItemsChanged = useRef(({ viewableItems: items }: { viewableItems: ViewToken[] }) => {
    setViewableItems(items.map(item => item.key as string));
  }).current;

  const toggleLike = async (propertyId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await toggleLikeGlobal(propertyId);
    } catch {
      // ignore (store already reverted optimistic update)
    }
  };

  const toggleSave = (propertyId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSavedProperties(prev => {
      const newSet = new Set(prev);
      if (newSet.has(propertyId)) {
        newSet.delete(propertyId);
      } else {
        newSet.add(propertyId);
      }
      return newSet;
    });
  };

  const renderProperty = ({ item, index }: { item: Property; index: number }) => {
    const isViewable = viewableItems.includes(item.id);
    const isLiked = isLikedGlobal(item.id);
    const isSaved = savedProperties.has(item.id);
    
    // Fix iOS flickering: Stable first video autoplay with proper fallback
    // Note: can't use hooks (useMemo) inside renderProperty; keep it as a simple derived value.
    const shouldPlay = index === 0 && viewableItems.length === 0 ? true : isViewable;

    return (
      <View style={styles.propertyContainer}>
        <Pressable 
          style={styles.videoTouchArea}
          onPress={() => router.push(buildPropertyDetailsRoute({ propertyReference: item.propertyReference, id: item.id }))}
        >
          <Video
            source={{ uri: item.videoUrl }}
            style={styles.video}
            resizeMode={ResizeMode.COVER}
            shouldPlay={shouldPlay}
            isLooping
            isMuted={false}
            volume={0.8}
            // Platform-specific video optimizations
            useNativeControls={false}
            positionMillis={0}
            progressUpdateIntervalMillis={Platform.OS === 'android' ? 1000 : 500}
          />
        </Pressable>

        <LinearGradient
          colors={['transparent', 'transparent', Colors.overlay]}
          style={styles.bottomGradient}
          pointerEvents="none"
        />

        <View style={styles.actionsBar}>
          <Pressable 
            style={styles.actionButton}
            onPress={() => toggleLike(item.id)}
          >
            <Heart 
              size={32} 
              color={Colors.textLight} 
              fill={isLiked ? Colors.bronze : 'transparent'}
            />
            <Text style={styles.actionText}>
              {(item.likesCount + (isLiked ? 1 : 0)).toLocaleString()}
            </Text>
          </Pressable>

          <Pressable style={styles.actionButton}>
            <MessageCircle size={32} color={Colors.textLight} />
            <Text style={styles.actionText}>
              {item.commentsCount.toLocaleString()}
            </Text>
          </Pressable>

          <Pressable 
            style={styles.actionButton}
            onPress={() => toggleSave(item.id)}
          >
            <Bookmark 
              size={32} 
              color={Colors.textLight}
              fill={isSaved ? Colors.bronze : 'transparent'}
            />
          </Pressable>

          <Pressable style={styles.actionButton}>
            <Share2 size={32} color={Colors.textLight} />
          </Pressable>
        </View>

        <View style={styles.infoCard}>
          <Pressable
            style={styles.agentRow}
            onPress={() => {
              const routeAgentId = (item.agent as any)?.agentId ?? item.agent?.id;
              if (!routeAgentId) return;
              router.push(`/agent/${routeAgentId}` as any);
            }}
          >
            <View style={styles.agentAvatar}>
              <Text style={styles.agentInitial}>
                {(item.agentName || item.agent?.name || 'A').trim().charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.agentName}>{item.agentName}</Text>
          </Pressable>

          <Text style={styles.propertyTitle} numberOfLines={2}>
            {item.title}
          </Text>

          <Text style={styles.price}>
            {item.currency} {item.price.toLocaleString()}
            {item.listingType === 'RENT' ? '/year' : ''}
          </Text>

          <View style={styles.locationRow}>
            <MapPin size={16} color={Colors.textLight} />
            <Text style={styles.locationText}>
              {item.location.area}, {item.location.city}
            </Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Bed size={16} color={Colors.textLight} />
              <Text style={styles.statText}>{item.bedrooms}</Text>
            </View>
            <Text style={styles.statDivider}>|</Text>
            <View style={styles.stat}>
              <Bath size={16} color={Colors.textLight} />
              <Text style={styles.statText}>{item.bathrooms}</Text>
            </View>
            <Text style={styles.statDivider}>|</Text>
            <View style={styles.stat}>
              <Maximize size={16} color={Colors.textLight} />
              <Text style={styles.statText}>{item.sizeSqft.toLocaleString()} sqft</Text>
            </View>
          </View>

          <Pressable style={styles.contactButton}>
            <Text style={styles.contactButtonText}>Contact Agent</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  if (filteredProperties.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No properties found</Text>
        <Text style={styles.emptyText}>
          Try adjusting your filters or select different lifestyles
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable 
        style={styles.searchButton}
        onPress={() => router.push('/search')}
      >
        <Search size={24} color={Colors.textLight} />
      </Pressable>
      
      <FlatList
        data={filteredProperties}
        renderItem={renderProperty}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        // Android optimization: Enhanced performance settings
        removeClippedSubviews={Platform.OS === 'android'}
        maxToRenderPerBatch={Platform.OS === 'android' ? 1 : 2}
        windowSize={Platform.OS === 'android' ? 2 : 3}
        initialNumToRender={1}
        updateCellsBatchingPeriod={Platform.OS === 'android' ? 50 : 100}
        disableIntervalMomentum={Platform.OS === 'android'}
        // iOS optimization: Smoother scrolling
        scrollEventThrottle={Platform.OS === 'ios' ? 16 : 32}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.text,
  },
  searchButton: {
    position: 'absolute' as const,
    top: 60,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.overlayLight,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  propertyContainer: {
    height: SCREEN_HEIGHT,
    position: 'relative' as const,
  },
  videoTouchArea: {
    width: '100%',
    height: '100%',
    position: 'absolute' as const,
    zIndex: 1,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  bottomGradient: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: 400,
  },
  actionsBar: {
    position: 'absolute' as const,
    right: 16,
    bottom: 180,
    gap: 24,
    zIndex: 10,
  },
  actionButton: {
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    color: Colors.textLight,
    fontSize: 12,
    fontWeight: '600',
  },
  infoCard: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 80,
    padding: 20,
    gap: 8,
    zIndex: 10,
  },
  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  agentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.bronze,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.textLight,
  },
  agentInitial: {
    color: Colors.textLight,
    fontSize: 18,
    fontWeight: '700',
  },
  agentName: {
    color: Colors.textLight,
    fontSize: 14,
    fontWeight: '600',
  },
  propertyTitle: {
    color: Colors.textLight,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  price: {
    color: Colors.bronze,
    fontSize: 24,
    fontWeight: '700',
    marginVertical: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    color: Colors.textLight,
    fontSize: 14,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    color: Colors.textLight,
    fontSize: 13,
    fontWeight: '500',
  },
  statDivider: {
    color: Colors.textLight,
    fontSize: 13,
    opacity: 0.5,
  },
  contactButton: {
    backgroundColor: Colors.bronze,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
    marginTop: 12,
  },
  contactButtonText: {
    color: Colors.textLight,
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
