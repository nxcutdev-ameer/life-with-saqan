import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Dimensions,
  Animated,
  Pressable,
  PanResponder,
  AppState,
  Platform,
  Share,
  Alert,
} from 'react-native';
import { scaleHeight, scaleWidth } from '@/utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';
import { useEngagementStore } from '@/stores/engagementStore';
import { useFocusEffect } from '@react-navigation/native';
import { useVideoPlaybackRegistryStore } from '@/stores/videoPlaybackRegistryStore';
import { buildPropertyDetailsRoute } from '@/utils/routes';
import { VideoView, useVideoPlayer } from 'expo-video';
import { fetchPublicGenericVideos, sharePublicVideo } from '@/utils/publicVideosApi';
import { mapPublicVideoToProperty } from '@/utils/publicVideoMapper';
import { Property } from '@/types';
import * as Haptics from 'expo-haptics';
import CommentsModal from '@/components/CommentsModal';
import AppHeader from '@/components/AppHeader';
import LocationsModal from '@/components/LocationsModal';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import { EngagementActionsProvider } from '@/contexts/EngagementActionsContext';
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
  onNavigateToProperty: (id: string) => void;
}

function ReelItemInactive({ item }: { item: Property }) {
  // Render a lightweight placeholder when Reels is not focused.
  // Intentionally does NOT create a video player.
  return <View style={styles.propertyContainer} />;
}

function ReelItemActive({ item, index, isViewable, isLiked, isSaved, scrollY, onNavigateToProperty }: ReelItemProps) {
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
          onSeek={handleSeek}
         // onNavigateToProperty={() => onNavigateToProperty(item.id)}
        />
      </View>
  );
}

export default function ReelsScreen() {
  const router = useRouter();
  useUserPreferences();

  const pauseAllRegistry = useVideoPlaybackRegistryStore((s) => s.pauseAll);
  const [screenActive, setScreenActive] = useState(false);

  const {
    hydrated: likesHydrated,
    hydrate: hydrateLikes,
    isLiked: isVideoLiked,
    setLikesCount,
    toggleLike: toggleVideoLike,
  } = useEngagementStore();

  const [items, setItems] = useState<Property[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const currentIndexRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      setScreenActive(true);
      let cancelled = false;

      (async () => {
        try {
          setIsFetching(true);
          const res = await fetchPublicGenericVideos({ page: 1, perPage: 30, sortBy: 'views_count' });
          const mapped = (res?.data ?? []).map(mapPublicVideoToProperty);

          const meta = res?.meta;
          const computedHasMore =
            typeof meta?.has_more_pages === 'boolean'
              ? meta.has_more_pages
              : typeof meta?.current_page === 'number' && typeof meta?.last_page === 'number'
                ? meta.current_page < meta.last_page
                : mapped.length > 0;

          // Seed likes counts so UI + optimistic updates have a baseline.
          mapped.forEach((p) => setLikesCount(p.id, p.likesCount));

          if (!cancelled) {
            setItems(mapped);
            setPage(1);
            setHasMore(computedHasMore);
            const first = mapped[0];
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
    }, [pauseAllRegistry, setLikesCount])
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
  const [savedProperties, setSavedProperties] = useState<Set<string>>(new Set());
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [locationsModalVisible, setLocationsModalVisible] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!likesHydrated) hydrateLikes();
  }, [hydrateLikes, likesHydrated]);

  const toggleLike = async (videoId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await toggleVideoLike(videoId);
    } catch {
      // ignore
    }
  };

  const toggleSave = (propertyId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSavedProperties((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(propertyId)) {
        newSet.delete(propertyId);
      } else {
        newSet.add(propertyId);
      }
      return newSet;
    });
  };

  const handleShare = useCallback(
    async (id: string) => {
      const item = items.find((p) => p.id === id);
      const url = item?.videoUrl;
      if (!url) {
        Alert.alert('Error', 'No shareable video URL found.');
        return;
      }

      try {
        const title = item?.title || 'Video';
        const message = `${title}\n${url}`;
        const result = await Share.share({ message, title });

        // If the user dismissed the share sheet, don't record it.
        if ((result as any)?.action === (Share as any).dismissedAction) return;

        const res = await sharePublicVideo({ videoId: id });
        const sharesCount = res?.data?.shares_count;
        if (typeof sharesCount === 'number') {
          setItems((prev) => prev.map((it) => (it.id === id ? { ...it, sharesCount } : it)));
        }
      } catch (err: any) {
        const message = err?.message || 'Failed to share.';
        Alert.alert('Error', message);
      }
    },
    [items]
  );

  const renderProperty = ({ item, index }: { item: Property; index: number }) => {
    const isActive = item.id === activeItemId || (index === 0 && !activeItemId);

    return screenActive ? (
      <ReelItemActive
        item={item}
        index={index}
        isViewable={isActive}
        isLiked={isVideoLiked(item.id)}
        isSaved={savedProperties.has(item.id)}
        scrollY={scrollY}
        onNavigateToProperty={(id) =>
          router.push(
            buildPropertyDetailsRoute({
              propertyReference: item.propertyReference ?? id,
              id,
              mode: item.type === 'offplan' ? 'offplan' : undefined,
            })
          )
        }
      />
    ) : (
      <ReelItemInactive item={item} />
    );
  };

  const loadMore = useCallback(async () => {
    if (isFetching || isFetchingMore || !hasMore) return;

    const nextPage = page + 1;
    try {
      setIsFetchingMore(true);
      const res = await fetchPublicGenericVideos({ page: nextPage, perPage: 30, sortBy: 'views_count' });
      const mapped = (res?.data ?? []).map(mapPublicVideoToProperty);

      const meta = res?.meta;
      const computedHasMore =
        typeof meta?.has_more_pages === 'boolean'
          ? meta.has_more_pages
          : typeof meta?.current_page === 'number' && typeof meta?.last_page === 'number'
            ? meta.current_page < meta.last_page
            : mapped.length > 0;

      // Seed likes counts for newly fetched items.
      mapped.forEach((p) => setLikesCount(p.id, p.likesCount));

      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const deduped = mapped.filter((p) => !seen.has(p.id));
        return [...prev, ...deduped];
      });
      setPage(nextPage);
      setHasMore(computedHasMore);
    } catch {
      // ignore
    } finally {
      setIsFetchingMore(false);
    }
  }, [hasMore, isFetching, isFetchingMore, page, setLikesCount]);

  return (
    <EngagementActionsProvider
      value={{
        onShare: (id) => void handleShare(id),
        onToggleLike: (id) => void toggleLike(id),
        onToggleSave: (id) => toggleSave(id),
        onOpenComments: (id) => {
          setSelectedPropertyId(id);
          setCommentsModalVisible(true);
        },
      }}
    >
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
        onEndReachedThreshold={0.8}
        onEndReached={() => {
          void loadMore();
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
    </EngagementActionsProvider>
  );
}


