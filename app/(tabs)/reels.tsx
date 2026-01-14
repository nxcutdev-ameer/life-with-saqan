import React, { useRef, useState } from 'react';
import {
  Text,
  View,
  Dimensions,
  ViewToken,
  Animated,
  Pressable,
  PanResponder,
} from 'react-native';
import { scaleHeight, scaleWidth } from '@/utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
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
import SpeedBoostOverlay from '@/components/SpeedBoostOverlay';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ReelItemProps {
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

function ReelItem({ item, index, isViewable, isLiked, isSaved, scrollY, onToggleLike, onToggleSave, onOpenComments, onNavigateToProperty }: ReelItemProps) {
  const [isPaused, setIsPaused] = useState(false);
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
      if (isPaused) {
        player.pause();
      } else {
        player.play();
      }
    } else {
      // Ensure we never keep a reel at 2x when it leaves the viewport.
      try {
        (player as any).playbackRate = 1;
      } catch {}
      try {
        (player as any).rate = 1;
      } catch {}

      player.pause();
    }
  }, [isPaused, isViewable, player]);

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

  const insets = useSafeAreaInsets();
  const bottomTabBarHeight = useBottomTabBarHeight?.() ?? 0;

  const EDGE_ZONE_WIDTH = scaleWidth(70);
  const isSpeedingRef = useRef(false);

  // Constrain the touch overlay so it doesn't steal interactions from the AppHeader (top)
  // or the engagement/video controls (bottom).
  const OVERLAY_TOP = insets.top + scaleHeight(12) + scaleHeight(16) + scaleHeight(32);
  const OVERLAY_BOTTOM = scaleHeight(140) + bottomTabBarHeight;

  const togglePause = () => {
    setIsPaused((prev) => {
      const next = !prev;
      if (isViewable) {
        if (next) {
          player.pause();
        } else {
          player.play();
        }
      }
      return next;
    });
  };

  const [isSpeeding, setIsSpeeding] = useState(false);

  const startSpeed = () => {
    isSpeedingRef.current = true;
    setIsSpeeding(true);
    setPlaybackRate(2);
  };

  const stopSpeed = () => {
    isSpeedingRef.current = false;
    setIsSpeeding(false);
    setPlaybackRate(1);
  };

  const setPlaybackRate = (rate: number) => {
    // expo-video's player API varies slightly by platform/version; set both common properties.
    try {
      (player as any).playbackRate = rate;
    } catch {}
    try {
      (player as any).rate = rate;
    } catch {}
  };

  const swipeHandledRef = useRef(false);
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        const { dx, dy } = gestureState;
        return Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.8;
      },
      onPanResponderRelease: (_evt, gestureState) => {
        const { dx } = gestureState;
        if (dx < -60 && !swipeHandledRef.current) {
          swipeHandledRef.current = true;
          player.pause();
          setIsPaused(true);
          onNavigateToProperty(item.id);
        }
        setTimeout(() => {
          swipeHandledRef.current = false;
        }, 250);
      },
      onPanResponderTerminate: () => {
        swipeHandledRef.current = false;
      },
    })
  ).current;

  return (
      <View style={styles.propertyContainer} {...panResponder.panHandlers}>
        <View style={styles.videoTouchArea}>
          <VideoView
            player={player}
            style={[
              styles.video,
              {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 0,
              },
            ]}
            contentFit="cover"
            nativeControls={false}
          />
        </View>

        {/* Overlay touch zones */}
        <View
          style={{
            position: 'absolute',
            top: OVERLAY_TOP,
            left: 0,
            right: 0,
            bottom: OVERLAY_BOTTOM,
            flexDirection: 'row',
            // Above native video surface, below footer.
            zIndex: 150,
            elevation: 150,
            backgroundColor: 'transparent',
          }}
        >
          <Pressable
            style={{
              width: EDGE_ZONE_WIDTH,
              height: '100%',
              backgroundColor: 'transparent',
            }}
            onPressIn={startSpeed}
            onPressOut={stopSpeed}
          />

          <Pressable
            style={{
              flex: 1,
              height: '100%',
              backgroundColor: 'transparent',
            }}
            onPress={togglePause}
          />

          <Pressable
            style={{
              width: EDGE_ZONE_WIDTH,
              height: '100%',
              backgroundColor: 'transparent',
            }}
            onPressIn={startSpeed}
            onPressOut={stopSpeed}
          />
        </View>

        {/* Centered just above the progress bar */}
        <SpeedBoostOverlay visible={isSpeeding} bottom={bottomTabBarHeight + scaleHeight(10)} />

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
          onNavigateToProperty={() => {
            player.pause();
            setIsPaused(true);
            onNavigateToProperty(item.id);
          }}
        />
      </View>
  );
}

export default function ReelsScreen() {
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
      <ReelItem
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


