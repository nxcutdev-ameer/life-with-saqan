import React, { useCallback, useRef, useState } from 'react';
import {
  Text,
  View,
  Dimensions,
  Animated,
  Pressable,
  PanResponder,
  AppState,
  Platform,
} from 'react-native';
import { scaleHeight, scaleWidth } from '@/utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useVideoPlaybackRegistryStore } from '@/stores/videoPlaybackRegistryStore';
import { buildPropertyDetailsRoute } from '@/utils/routes';
import { VideoView, useVideoPlayer } from 'expo-video';
import { fetchPublicVideos } from '@/utils/publicVideosApi';
import { mapPublicVideoToProperty } from '@/utils/publicVideoMapper';
import { Property } from '@/types';
import * as Haptics from 'expo-haptics';
import CommentsModal from '@/components/CommentsModal';
import AppHeader from '@/components/AppHeader';
import LocationsModal from '@/components/LocationsModal';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import { feedStyles as styles } from '@/constants/feedStyles';
import PropertyFooter from '@/components/PropertyFooter';
import SpeedBoostOverlay from '@/components/SpeedBoostOverlay';
import { Play } from 'lucide-react-native';

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

function ReelItemInactive({ item }: { item: Property }) {
  // Render a lightweight placeholder when Reels is not focused.
  // Intentionally does NOT create a video player.
  return <View style={styles.propertyContainer} />;
}

function ReelItemActive({ item, index, isViewable, isLiked, isSaved, scrollY, onToggleLike, onToggleSave, onOpenComments, onNavigateToProperty }: ReelItemProps) {
  const registerPlayer = useVideoPlaybackRegistryStore((s) => s.register);
  const unregisterPlayer = useVideoPlaybackRegistryStore((s) => s.unregister);
  const [isPaused, setIsPaused] = useState(false);

  const playOverlayOpacity = useRef(new Animated.Value(0)).current;
  const [showPlayOverlay, setShowPlayOverlay] = useState(false);

  React.useEffect(() => {
    if (isPaused) {
      setShowPlayOverlay(true);
      Animated.timing(playOverlayOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(playOverlayOpacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setShowPlayOverlay(false);
    });
  }, [isPaused, playOverlayOpacity]);

  const player = useVideoPlayer(item.videoUrl, (player) => {
    player.loop = true;
    player.muted = false;
    player.volume = 0.8;
    try {
      (player as any).timeUpdateEventInterval = 0.25;
    } catch {}
  });

  const playSafeWithRetry = useCallback(() => {
    const tryPlay = () => {
      try {
        player.play();
      } catch {}
    };

    tryPlay();
    const t1 = setTimeout(tryPlay, 120);
    const t2 = setTimeout(tryPlay, 320);
    const t3 = setTimeout(tryPlay, 600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [player]);

  React.useEffect(() => {
    if (!player) return;
    registerPlayer('reels', item.videoUrl, player);
    return () => unregisterPlayer('reels', item.videoUrl, player);
  }, [item.videoUrl, player, registerPlayer, unregisterPlayer]);

  // `player.currentTime` is not React state. Track it locally so UI (progress bar) updates live.
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  React.useEffect(() => {
    if (isViewable) {
      if (isPaused) {
        player.pause();
        return;
      }
      return playSafeWithRetry();
    }

    // Ensure we never keep a reel at 2x when it leaves the viewport.
    try {
      (player as any).playbackRate = 1;
    } catch {}
    try {
      (player as any).rate = 1;
    } catch {}

    try {
      player.pause();
    } catch {}
  }, [isPaused, isViewable, player, playSafeWithRetry]);

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

  const EDGE_ZONE_WIDTH = scaleWidth(40);
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
      //   const { dx } = gestureState;
      //   if (dx < -60 && !swipeHandledRef.current) {
      //     swipeHandledRef.current = true;
      //     player.pause();
      //     setIsPaused(true);
      //     onNavigateToProperty(item.id);
      //   }
      //   setTimeout(() => {
      //     swipeHandledRef.current = false;
      //   }, 250);
      // },
      // onPanResponderTerminate: () => {
      //   swipeHandledRef.current = false;
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

          {/* <Pressable
            style={{
              width: EDGE_ZONE_WIDTH,
              height: '100%',
              backgroundColor: 'transparent',
            }}
            onPressIn={startSpeed}
            onPressOut={stopSpeed}
          /> */}
        </View>

        {/* Centered just above the progress bar */}
        <SpeedBoostOverlay visible={isSpeeding} bottom={bottomTabBarHeight + scaleHeight(10)} />

        {showPlayOverlay ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: '42%',
              left: 0,
              right: 0,
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 250,
              opacity: playOverlayOpacity,
            }}
          >
            <View
              style={{
                width: scaleWidth(72),
                height: scaleWidth(72),
                borderRadius: scaleWidth(36),
                opacity: 0.60,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Play size={36} color="#fff" fill="#fff" />
            </View>
          </Animated.View>
        ) : null}

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
            // try {
            //   player.pause();
            // } catch {}
            // setIsPaused(true);
            // //onNavigateToProperty(item.id);
          }}
        />
      </View>
  );
}

export default function ReelsScreen() {
  const router = useRouter();
  useUserPreferences();

  const pauseAllRegistry = useVideoPlaybackRegistryStore((s) => s.pauseAll);
  const [screenActive, setScreenActive] = useState(false);

  const [items, setItems] = useState<Property[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const currentIndexRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      setScreenActive(true);
      let cancelled = false;

      (async () => {
        try {
          setIsFetching(true);
          const res = await fetchPublicVideos({ page: 1, perPage: 30 });
          const mapped = (res?.data ?? []).map(mapPublicVideoToProperty);
          const offplanOnly = mapped.filter((p) => (p.type ?? '').toLowerCase() === 'offplan');
          if (!cancelled) {
            setItems(offplanOnly);
            const first = offplanOnly[0];
            currentIndexRef.current = 0;
            setActiveItemId(first?.id ?? null);
          }
        } catch {
          if (!cancelled) setItems([]);
        } finally {
          if (!cancelled) setIsFetching(false);
        }
      })();

      return () => {
        cancelled = true;
        setScreenActive(false);
        pauseAllRegistry('reels');
      };
    }, [pauseAllRegistry]) 
  );

  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        pauseAllRegistry('reels');
      }
    });
    return () => sub.remove();
  }, [pauseAllRegistry]);

  const filteredProperties = items;

  const [likedProperties, setLikedProperties] = useState<Set<string>>(new Set());
  const [savedProperties, setSavedProperties] = useState<Set<string>>(new Set());
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [locationsModalVisible, setLocationsModalVisible] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

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
    const isActive = item.id === activeItemId || (index === 0 && !activeItemId);

    return screenActive ? (
      <ReelItemActive
        item={item}
        index={index}
        isViewable={isActive}
        isLiked={likedProperties.has(item.id)}
        isSaved={savedProperties.has(item.id)}
        scrollY={scrollY}
        onToggleLike={toggleLike}
        onToggleSave={toggleSave}
        onOpenComments={(id) => {
          setSelectedPropertyId(id);
          setCommentsModalVisible(true);
        }}
        onNavigateToProperty={(id) => router.push(buildPropertyDetailsRoute({ propertyReference: id, id }))}
      />
    ) : (
      <ReelItemInactive item={item} />
    );
  };

  if (!isFetching && filteredProperties.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No videos found</Text>
        <Text style={styles.emptyText}>Please try again later.</Text>
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
        pagingEnabled={Platform.OS === 'ios'}
        showsVerticalScrollIndicator={false}
        snapToInterval={Platform.OS === 'android' ? SCREEN_HEIGHT : undefined}
        snapToAlignment="start"
        decelerationRate={Platform.OS === 'ios' ? 'fast' : 0.98}
        disableIntervalMomentum={Platform.OS === 'android'}
        // Avoid native clipping with video to prevent teardown glitches.
        removeClippedSubviews={false}
        initialNumToRender={2}
        maxToRenderPerBatch={3}
        windowSize={5}
        updateCellsBatchingPeriod={16}
        getItemLayout={(_data, index) => ({ length: SCREEN_HEIGHT, offset: SCREEN_HEIGHT * index, index })}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        onScrollEndDrag={(e) => {
          const offsetY = e.nativeEvent.contentOffset.y;
          const nextIndex = Math.max(0, Math.round(offsetY / SCREEN_HEIGHT));
          currentIndexRef.current = nextIndex;
          const next = filteredProperties[nextIndex];
          if (next?.id) setActiveItemId(next.id);
        }}
        onMomentumScrollEnd={(e) => {
          const offsetY = e.nativeEvent.contentOffset.y;
          const nextIndex = Math.max(0, Math.round(offsetY / SCREEN_HEIGHT));
          currentIndexRef.current = nextIndex;
          const next = filteredProperties[nextIndex];
          if (next?.id) setActiveItemId(next.id);
        }}
      />
      <CommentsModal
        visible={commentsModalVisible}
        onClose={() => setCommentsModalVisible(false)}
        propertyId={selectedPropertyId || ''}
        commentsCount={
          selectedPropertyId
            ? filteredProperties.find((p) => p.id === selectedPropertyId)?.commentsCount || 0
            : 0
        }
      />
      <LocationsModal
        visible={locationsModalVisible}
        onClose={() => setLocationsModalVisible(false)}
      />
    </View>
  );
}


