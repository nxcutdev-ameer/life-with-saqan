import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Text,
  View,
  Pressable,
  Dimensions,
  ViewToken,
  Animated,
  PanResponder,
  Alert,
  Share,
  RefreshControl,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { scaleHeight, scaleWidth } from '@/utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Property } from '@/types';
import { fetchPublicVideos, sharePublicVideo } from '@/utils/publicVideosApi';
import { mapPublicVideoToProperty } from '@/utils/publicVideoMapper';
import { useEngagementStore } from '@/stores/engagementStore';
import { useSubtitleStore } from '@/stores/subtitleStore';
import { findActiveCue, parseVtt } from '@/utils/vtt';
import * as Haptics from 'expo-haptics';
import CommentsModal from '@/components/CommentsModal';
import AppHeader from '@/components/AppHeader';
import LocationsModal from '@/components/LocationsModal';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import { feedStyles as styles } from '@/constants/feedStyles';
import { buildPropertyDetailsRoute } from '@/utils/routes';
import PropertyFooter from '@/components/PropertyFooter';
import SpeedBoostOverlay from '@/components/SpeedBoostOverlay';
import { Play } from 'lucide-react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type FeedVideoItem = Property;

interface FeedItemProps {
  item: FeedVideoItem;
  index: number;
  /** Active in viewport (should play / update progress). */
  isViewable: boolean;
  isSaved: boolean;
  scrollY: Animated.Value;
  bottomTabBarHeight: number;
  overlayTop: number;
  overlayBottom: number;
  onToggleLike: (id: string) => void;
  onToggleSave: (id: string) => void;
  onOpenComments: (id: string) => void;
  onNavigateToProperty: (propertyReference: string) => void;
  onShare: (id: string) => void;
  globalSubtitleLanguageCode?: string;
  onGlobalSubtitleLanguageChange?: (languageCode: string) => void;
  onSpeedingChange?: (isSpeeding: boolean) => void;
  onScrubbingChange?: (isScrubbing: boolean) => void;
}

const FeedItem = React.memo(function FeedItem({ item, index, isViewable, isSaved, scrollY, bottomTabBarHeight, overlayTop, overlayBottom, onToggleLike, onToggleSave, onOpenComments, onNavigateToProperty, onShare, globalSubtitleLanguageCode, onGlobalSubtitleLanguageChange, onSpeedingChange, onScrubbingChange }: FeedItemProps) {
  // Subscribe per-item so only the affected cell re-renders when likes change.
  const isLiked = useEngagementStore((s) => s.isLiked(item.id));
  const [isPaused, setIsPaused] = useState(false);

  const playOverlayOpacity = useRef(new Animated.Value(0)).current;
  const [showPlayOverlay, setShowPlayOverlay] = useState(false);

  useEffect(() => {
    if (isPaused) {
      setShowPlayOverlay(true);
      Animated.timing(playOverlayOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
      return;
    }

    // Fade out then unmount
    Animated.timing(playOverlayOpacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setShowPlayOverlay(false);
    });
  }, [isPaused, playOverlayOpacity]);

  const player = useVideoPlayer(item.videoUrl, (p) => {
    p.loop = true;
    p.muted = false;
    p.volume = 0.8;
  });

  // `player.currentTime` is not React state. Track it locally so UI (progress bar) updates live.
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const normalizeSubtitleUrl = (u: string) => (u.startsWith('/') ? `https://api.saqan.com${u}` : u);

  const [selectedSubtitleUrl, setSelectedSubtitleUrl] = useState<string>('');

  useEffect(() => {
    // When global language changes (or video changes), choose the matching subtitle track for this video.
    if (!globalSubtitleLanguageCode) {
      setSelectedSubtitleUrl('');
      return;
    }

    const match = (item.subtitles ?? []).find((t: any) => t.code === globalSubtitleLanguageCode);
    if (match?.url) {
      setSelectedSubtitleUrl(normalizeSubtitleUrl(match.url));
    } else {
      setSelectedSubtitleUrl('');
    }
  }, [item.id, globalSubtitleLanguageCode]);
  const [subtitleCues, setSubtitleCues] = useState<Array<{ start: number; end: number; text: string }>>([]);
  const [activeSubtitle, setActiveSubtitle] = useState('');
  React.useEffect(() => {
    if (!player) return;

    if (isViewable) {
      if (isPaused) {
        player.pause();
      } else {
        player.play();
      }
    } else {
      // Ensure we never keep a feed item at 2x when it leaves the viewport.
      setIsSpeeding(false);
      onSpeedingChange?.(false);
      try {
        (player as any).playbackRate = 1;
      } catch {}
      try {
        (player as any).rate = 1;
      } catch {}

      // Pause when not viewable, but DO NOT reset time/isPaused.
      try {
        player.pause();
      } catch {}
    }
  }, [isPaused, isViewable, player, onSpeedingChange]);

  React.useEffect(() => {
    if (!player) return;
    if (!isViewable) return;

    let rafId: number | null = null;
    let lastUpdate = 0;

    const tick = (t: number) => {
      if (t - lastUpdate >= 100) {
        lastUpdate = t;
        const ct = player.currentTime;
        setCurrentTime(ct);
        setDuration(player.duration);

        if (subtitleCues.length) {
          setActiveSubtitle(findActiveCue(subtitleCues, ct));
        } else {
          setActiveSubtitle('');
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [isViewable, player, subtitleCues]);

  const handleSeek = (timestamp: number) => {
    if (!player) return;
    player.currentTime = timestamp;
    setCurrentTime(timestamp);
    if (subtitleCues.length) {
      setActiveSubtitle(findActiveCue(subtitleCues, timestamp));
    }
  };

  React.useEffect(() => {
    if (!player) return;
    if (!isViewable) return;

    // No subtitle selected.
    if (!selectedSubtitleUrl) {
      setSubtitleCues([]);
      setActiveSubtitle('');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(selectedSubtitleUrl);
        if (cancelled) return;
        const text = await res.text();
        if (cancelled) return;

        const cues = parseVtt(text);
        setSubtitleCues(cues);

        setActiveSubtitle(findActiveCue(cues, player.currentTime));
      } catch (e: any) {
        // backend may have missing/bad urls for now
        setSubtitleCues([]);
        setActiveSubtitle('');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isViewable, selectedSubtitleUrl, player]);

  const EDGE_ZONE_WIDTH = scaleWidth(70);

  const togglePause = () => {
    if (!player) return;
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

  const setPlaybackRate = (rate: number) => {
    if (!player) return;
    try {
      (player as any).playbackRate = rate;
    } catch {}
    try {
      (player as any).rate = rate;
    } catch {}
  };

  const [isSpeeding, setIsSpeeding] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const wasPausedBeforeSpeedRef = useRef(false);
  const wasPausedBeforeScrubRef = useRef(false);

  const startSpeed = () => {
    if (!player) return;
    wasPausedBeforeSpeedRef.current = isPaused;

    // If the video was paused, temporarily resume while holding for 2x.
    if (isPaused) {
      setIsPaused(false);
      try {
        player.play();
      } catch {}
    }

    setIsSpeeding(true);
    onSpeedingChange?.(true);
    setPlaybackRate(2);
  };
  const stopSpeed = () => {
    if (!player) return;
    setIsSpeeding(false);
    onSpeedingChange?.(false);
    setPlaybackRate(1);

    // If it was paused before the speed-hold started, restore paused state.
    if (wasPausedBeforeSpeedRef.current) {
      try {
        player.pause();
      } catch {}
      setIsPaused(true);
      wasPausedBeforeSpeedRef.current = false;
    }
  };

  const swipeHandledRef = useRef(false);
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        const { dx, dy } = gestureState;
        // Capture mostly-horizontal swipes so we don't fight the vertical feed scroll.
        return Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 5; //1.8
      },
      onPanResponderRelease: (_evt, gestureState) => {
        const { dx } = gestureState;
        // Right -> Left swipe
        if (dx < -60 && !swipeHandledRef.current) {
          swipeHandledRef.current = true;
          if (player) {
            player.pause();
            setIsPaused(true);
          }
          onNavigateToProperty(item.propertyReference || item.id);
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
        {item.videoUrl ? (
          <VideoView player={player} style={styles.video} contentFit="cover" nativeControls={false} />
        ) : (
          <View style={[styles.video, { alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ color: '#fff', opacity: 0.9, fontWeight: '600' }}>Video unavailable</Text>
          </View>
        )}

        {showPlayOverlay && !isSpeeding ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 50,
              opacity: playOverlayOpacity,
            }}
          >
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                //backgroundColor: 'rgba(0,0,0,0.45)',
                opacity: 0.60,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Play size={36} color="#fff" fill="#fff" />
            </View>
          </Animated.View>
        ) : null}

         {activeSubtitle ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 16,
              right: 16,
              bottom: 180 + bottomTabBarHeight,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: '#fff',
                fontSize: 16,
                fontWeight: '700',
                textAlign: 'center',
                backgroundColor: 'rgba(0,0,0,0.55)',
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 10,
              }}
            >
              {activeSubtitle}
            </Text>
          </View>
        ) : null}

      </View>

      {/* Overlay touch zones: left/right hold = 2x speed, center tap = pause/play */}
      <View
        pointerEvents={isScrubbing ? 'none' : 'auto'}
        style={{
          position: 'absolute',
          top: overlayTop,
          left: 0,
          right: 0,
          bottom: overlayBottom,
          flexDirection: 'row',
          zIndex: 150,
          elevation: 150,
          backgroundColor: 'transparent',
        }}
      >
        <Pressable
          style={{ width: EDGE_ZONE_WIDTH, height: '100%', backgroundColor: 'transparent' }}
          onPressIn={startSpeed}
          onPressOut={stopSpeed}
        />

        <Pressable
          style={{ flex: 1, height: '100%', backgroundColor: 'transparent' }}
          onPress={togglePause}
        />

        <Pressable
          style={{ width: EDGE_ZONE_WIDTH, height: '100%', backgroundColor: 'transparent' }}
          onPressIn={startSpeed}
          onPressOut={stopSpeed}
        />
      </View>

     {/* Centered just above the progress bar */}
     <SpeedBoostOverlay visible={isSpeeding} bottom={bottomTabBarHeight + scaleHeight(10)} />

     {!isSpeeding ? (
       <PropertyFooter
         item={item}
         onNavigateAway={() => {
           if (player) {
             try {
               player.pause();
             } catch {}
             setIsPaused(true);
           }
         }}
         currentTime={currentTime}
         duration={duration}
         isLiked={isLiked}
         isSaved={isSaved}
         onToggleLike={onToggleLike}
         onToggleSave={onToggleSave}
         onOpenComments={onOpenComments}
         onShare={onShare}
         onSeek={handleSeek}
         scrubbing={isScrubbing}
         onScrubStart={() => {
           if (!player) return;

           // Remember the pre-scrub state so we can restore it on end.
           wasPausedBeforeScrubRef.current = isPaused;

           // If user starts scrubbing, stop any 2x hold and disable overlay zones.
           stopSpeed();

           // Pause video while scrubbing.
           player.pause();
           setIsPaused(true);

           setIsScrubbing(true);
           onScrubbingChange?.(true);
         }}
         onScrubEnd={() => {
           setIsScrubbing(false);
           onScrubbingChange?.(false);

           // Resume only if the video was playing before scrubbing.
           if (!player) return;
           if (!wasPausedBeforeScrubRef.current) {
             try {
               player.play();
             } catch {}
             setIsPaused(false);
           } else {
             // Keep paused if it was paused before scrubbing.
             try {
               player.pause();
             } catch {}
             setIsPaused(true);
           }

           wasPausedBeforeScrubRef.current = false;
         }}
         selectedSubtitleCode={globalSubtitleLanguageCode}
         onSubtitleSelect={(subtitleUrl, languageCode) => {
           setSelectedSubtitleUrl(subtitleUrl);
           onGlobalSubtitleLanguageChange?.(languageCode);
         }}
         onNavigateToProperty={() => {
           if (player) {
             player.pause();
             setIsPaused(true);
           }
           onNavigateToProperty(item.propertyReference || item.id);
         }}
       />
     ) : null}
    </View>
  );
});

export default function FeedScreen() {
  const router = useRouter();
  useUserPreferences();
  const insets = useSafeAreaInsets();
  const bottomTabBarHeight = useBottomTabBarHeight?.() ?? 0;

  // Constrain the touch overlay so it doesn't steal interactions from the AppHeader (top)
  // or the engagement/video controls (bottom).
  const overlayTop = insets.top + scaleHeight(12) + scaleHeight(16) + scaleHeight(32);
  const overlayBottom = scaleHeight(140) + bottomTabBarHeight;

  const [items, setItems] = useState<FeedVideoItem[]>([]);
  const [page, setPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMorePages, setHasMorePages] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  // Refs to avoid stale closures inside FlatList callbacks.
  const pageRef = useRef(1);
  const hasMorePagesRef = useRef(true);
  const isFetchingRef = useRef(false);

  const endReachedCalledDuringMomentum = useRef(false);

  // NOTE: Backend videos don't currently include the fields our local filters expect
  // (listingType/location/lifestyle). For now, we display the fetched videos as-is.
  const filteredProperties = useMemo(() => items, [items]);

  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const isFocused = useIsFocused();
  const [isHoldingSpeed, setIsHoldingSpeed] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const globalSubtitleLanguageCode = useSubtitleStore((st) => st.languageCode);
  const setGlobalSubtitleLanguageCode = useSubtitleStore((st) => st.setLanguageCode);

  const firstItemId = filteredProperties[0]?.id;

  const mapVideoToProperty = (v: any): FeedVideoItem => mapPublicVideoToProperty(v);


  const loadPage = async (nextPage: number) => {
    if (isFetchingRef.current) return;
    if (!hasMorePagesRef.current && nextPage !== 1) return;

    try {
      isFetchingRef.current = true;
      setIsFetching(true);
      const res = await fetchPublicVideos({ page: nextPage, perPage: 20 });
      const newItems = (res?.data ?? []).map(mapVideoToProperty);

      const meta = res?.meta;
      // API may omit `has_more_pages` but include `current_page`/`last_page`/`total`.
      const nextHasMore =
        typeof meta?.has_more_pages === 'boolean'
          ? meta.has_more_pages
          : typeof meta?.current_page === 'number' && typeof meta?.last_page === 'number'
            ? meta.current_page < meta.last_page
            : typeof meta?.to === 'number' && typeof meta?.total === 'number'
              ? meta.to < meta.total
              : (res?.data?.length ?? 0) > 0;

      hasMorePagesRef.current = nextHasMore;
      pageRef.current = nextPage;
      setHasMorePages(nextHasMore);
      setPage(nextPage);
      setItems((prev) => {
        if (nextPage === 1) return newItems;
        // De-dupe by id (video_id) to avoid key collisions that prevent rendering.
        const seen = new Set(prev.map((p) => p.id));
        const merged = [...prev];
        for (const it of newItems) {
          if (!seen.has(it.id)) {
            seen.add(it.id);
            merged.push(it);
          }
        }
        return merged;
      });
    } catch (err: any) {
      // Keep existing items on error.
      const message = err?.message || 'Failed to load videos.';
      Alert.alert('Error', message);
    } finally {
      isFetchingRef.current = false;
      setIsFetching(false);
    }
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;
    if (isFetchingRef.current) return;

    try {
      setIsRefreshing(true);
      // Reset pagination so the feed truly refreshes from the first page.
      hasMorePagesRef.current = true;
      setHasMorePages(true);
      pageRef.current = 1;
      setPage(1);
      setActiveItemId(null);
      await loadPage(1);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ensure the first item is considered viewable when landing on the feed,
  // so the first video starts playing immediately.
  useEffect(() => {
    if (!firstItemId) return;
    setActiveItemId((prev) => prev ?? firstItemId);
  }, [firstItemId]);
  const { hydrated: likesHydrated, hydrate: hydrateLikes, toggleLike: toggleLikeGlobal } = useEngagementStore();

  useEffect(() => {
    if (!likesHydrated) {
      hydrateLikes();
    }
  }, [hydrateLikes, likesHydrated]);
  const [savedProperties, setSavedProperties] = useState<Set<string>>(new Set());
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [locationsModalVisible, setLocationsModalVisible] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  const viewabilityConfig = useRef({
    // Aggressive threshold for instant video transitions during fast swipes.
    itemVisiblePercentThreshold: 15,
    minimumViewTime: 10,
    waitForInteraction: false,
  }).current;

  const onViewableItemsChanged = useRef(({ viewableItems: viewable }: { viewableItems: ViewToken[] }) => {
    // With pagingEnabled, at most one item should be predominantly visible.
    const active = viewable.find((it) => it.isViewable);
    const activeId = (active?.key as string) || null;
    setActiveItemId(activeId);

    // Prefetch the next page when the user is within the last ~3 items.
    if (!activeId) return;
    const activeIndex = items.findIndex((p) => p.id === activeId);
    if (activeIndex >= 0 && items.length - activeIndex <= 4) {
      if (hasMorePagesRef.current && !isFetchingRef.current) {
        loadPage(pageRef.current + 1);
      }
    }
  }).current;

  const toggleLike = useCallback(
    async (propertyId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      try {
        await toggleLikeGlobal(propertyId);
        // Do NOT mutate the items array here. Likes count is derived from engagementStore per-item,
        // which avoids triggering expensive FlatList re-renders.
      } catch (err: any) {
        const message = err?.message || 'Failed to update like.';
        Alert.alert('Error', message);
      }
    },
    [toggleLikeGlobal]
  );

  const toggleSave = useCallback((propertyId: string) => {
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
  }, []);

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
     // const thumb = item?.thumbnailUrl ? toAbsoluteUrl(item.thumbnailUrl) : '';
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

  const canPlay = isFocused && !locationsModalVisible && !commentsModalVisible;

  const handleOpenComments = useCallback((id: string) => {
    setSelectedPropertyId(id);
    setCommentsModalVisible(true);
  }, []);

  const handleSpeedingChange = useCallback((speeding: boolean) => {
    // Hide header while the user is holding left/right for 2x
    setIsHoldingSpeed(speeding);
  }, []);

  const handleScrubbingChange = useCallback((scrubbing: boolean) => {
    setIsScrubbing(scrubbing);
  }, []);

  const handleNavigateToProperty = useCallback(
    (propertyReference: string, videoId: string) => {
      router.push(buildPropertyDetailsRoute({ propertyReference, id: videoId }));
    },
    [router]
  );

  const renderProperty = useCallback(
    ({ item, index }: { item: FeedVideoItem; index: number }) => (
      <FeedItem
        item={item}
        index={index}
        isViewable={canPlay && activeItemId === item.id}
        isSaved={savedProperties.has(item.id)}
        scrollY={scrollY}
        bottomTabBarHeight={bottomTabBarHeight}
        overlayTop={overlayTop}
        overlayBottom={overlayBottom}
        onToggleLike={toggleLike}
        onToggleSave={toggleSave}
        onOpenComments={handleOpenComments}
        onSpeedingChange={handleSpeedingChange}
        onScrubbingChange={handleScrubbingChange}
        onNavigateToProperty={(propertyReference) => handleNavigateToProperty(propertyReference, item.id)}
        onShare={handleShare}
        globalSubtitleLanguageCode={globalSubtitleLanguageCode}
        onGlobalSubtitleLanguageChange={(code) => setGlobalSubtitleLanguageCode(code)}
      />
    ),
    [
      activeItemId,
      canPlay,
      globalSubtitleLanguageCode,
      handleNavigateToProperty,
      handleOpenComments,
      handleScrubbingChange,
      handleShare,
      handleSpeedingChange,
      savedProperties,
      scrollY,
      setGlobalSubtitleLanguageCode,
      toggleLike,
      toggleSave,
    ]
  );

  const keyExtractor = useCallback((item: FeedVideoItem) => item.id, []);

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
      {!isHoldingSpeed && !isScrubbing ? (
        <AppHeader 
          onSearchPress={() => {
            router.push('/search');
          }}
          onSelectionsPress={() => {
            setLocationsModalVisible(true);
          }}
        />
      ) : null}
      <Animated.FlatList
        data={filteredProperties}
        renderItem={renderProperty}
        keyExtractor={keyExtractor}
        scrollEnabled={!isScrubbing && !isHoldingSpeed}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        // Offset the spinner so it doesn't sit under the absolute AppHeader.
        progressViewOffset={insets.top + scaleHeight(75)}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#FFFFFF"
            progressViewOffset={insets.top + scaleHeight(75)}
          />
        }
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate={Platform.OS === 'ios' ? 0.98 : 0.98}
        disableIntervalMomentum={false}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        removeClippedSubviews={false}
        // Optimized for fast swiping: keep more items mounted and render batches faster
        initialNumToRender={4}
        maxToRenderPerBatch={6}
        // Larger window ensures videos are ready during fast swipes
        // windowSize={11} means ~5 screens above + current + 5 screens below
        windowSize={11}
        updateCellsBatchingPeriod={5}
        getItemLayout={(_data, index) => ({ length: SCREEN_HEIGHT, offset: SCREEN_HEIGHT * index, index })}
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
        }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={8}
        onMomentumScrollBegin={() => {
          endReachedCalledDuringMomentum.current = false;
        }}
        onEndReached={() => {
          if (endReachedCalledDuringMomentum.current) return;
          endReachedCalledDuringMomentum.current = true;

          if (hasMorePagesRef.current && !isFetchingRef.current) {
            loadPage(pageRef.current + 1);
          }
        }}
        onEndReachedThreshold={0.8} // Prefetch next page a bit before the end without over-triggering
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


