import React, { useRef, useState } from 'react';
import { 
  Text, 
  View, 
  Pressable, 
  Dimensions,
  ViewToken,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { mockProperties, filterProperties } from '@/mocks/properties';
import { Property } from '@/types';
import * as Haptics from 'expo-haptics';
import CommentsModal from '@/components/CommentsModal';
import AppHeader from '@/components/AppHeader';
import LocationsModal from '@/components/LocationsModal';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import { feedStyles as styles } from '@/constants/feedStyles';
import PropertyFooter from '@/components/PropertyFooter';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FeedItemProps {
  item: Property;
  index: number;
  isViewable: boolean;
  isLiked: boolean;
  isSaved: boolean;
  scrollY: Animated.Value;
  onToggleLike: (id: string) => void;
  onToggleSave: (id: string) => void;
  onOpenComments: (id: string) => void;
  onNavigateToProperty: (id: string) => void;
}

function FeedItem({ item, index, isViewable, isLiked, isSaved, scrollY, onToggleLike, onToggleSave, onOpenComments, onNavigateToProperty }: FeedItemProps) {
  const player = useVideoPlayer(item.videoUrl, (player) => {
    player.loop = true;
    player.muted = false;
    player.volume = 0.8;
  });

  // `player.currentTime` is not React state. Track it locally so UI (progress bar) updates live.
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  React.useEffect(() => {
    if (isViewable) {
      player.play();
    } else {
      player.pause();
    }
  }, [isViewable, player]);

  React.useEffect(() => {
    if (!isViewable) return;

    let rafId: number | null = null;
    let lastUpdate = 0;

    const tick = (t: number) => {
      // Update ~10 times/sec; the progress bar animates between updates for smoothness.
      if (t - lastUpdate >= 100) {
        lastUpdate = t;
        setCurrentTime(player.currentTime);
        setDuration(player.duration);
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [isViewable, player]);

  const handleSeek = (timestamp: number) => {
    player.currentTime = timestamp;
    // Keep UI in sync immediately on manual seeks.
    setCurrentTime(timestamp);
  };

  return (
    <View style={styles.propertyContainer}>
      <Pressable 
        style={styles.videoTouchArea}
        onPress={() => onNavigateToProperty(item.id)}
      >
        <VideoView
          player={player}
          style={styles.video}
          contentFit="cover"
          nativeControls={false}
        />
      </Pressable>

      <PropertyFooter
        item={item}
        currentTime={currentTime}
        duration={duration}
        isLiked={isLiked}
        isSaved={isSaved}
        onToggleLike={onToggleLike}
        onToggleSave={onToggleSave}
        onOpenComments={onOpenComments}
        onSeek={handleSeek}
      />
    </View>
  );
}

export default function FeedScreen() {
  const router = useRouter();
  const { transactionType, location, lifestyles } = useUserPreferences();
  
  const filteredProperties = filterProperties(
    mockProperties,
    transactionType,
    location,
    lifestyles
  );

  const [viewableItems, setViewableItems] = useState<string[]>([]);
  const [likedProperties, setLikedProperties] = useState<Set<string>>(new Set());
  const [savedProperties, setSavedProperties] = useState<Set<string>>(new Set());
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [locationsModalVisible, setLocationsModalVisible] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
  }).current;

  const onViewableItemsChanged = useRef(({ viewableItems: items }: { viewableItems: ViewToken[] }) => {
    setViewableItems(items.map(item => item.key as string));
  }).current;

  const toggleLike = (propertyId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLikedProperties(prev => {
      const newSet = new Set(prev);
      if (newSet.has(propertyId)) {
        newSet.delete(propertyId);
      } else {
        newSet.add(propertyId);
      }
      return newSet;
    });
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
    return (
      <FeedItem
        item={item}
        index={index}
        isViewable={viewableItems.includes(item.id)}
        isLiked={likedProperties.has(item.id)}
        isSaved={savedProperties.has(item.id)}
        scrollY={scrollY}
        onToggleLike={toggleLike}
        onToggleSave={toggleSave}
        onOpenComments={(id) => {
          setSelectedPropertyId(id);
          setCommentsModalVisible(true);
        }}
        onNavigateToProperty={(id) => router.push(`/property/${id}`)}
      />
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
      <AppHeader 
        onSearchPress={() => router.push('/search')}
        onSelectionsPress={() => setLocationsModalVisible(true)}
      />
      <Animated.FlatList
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
        removeClippedSubviews
        maxToRenderPerBatch={2}
        windowSize={3}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      />
      <CommentsModal
        visible={commentsModalVisible}
        onClose={() => setCommentsModalVisible(false)}
        propertyId={selectedPropertyId || ''}
        commentsCount={selectedPropertyId ? filteredProperties.find(p => p.id === selectedPropertyId)?.commentsCount || 0 : 0}
      />
      <LocationsModal
        visible={locationsModalVisible}
        onClose={() => setLocationsModalVisible(false)}
      />
    </View>
  );
}


