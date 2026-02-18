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
  AppState,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { scaleHeight, scaleWidth } from '@/utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Property } from '@/types';
import { fetchPublicVideos, sharePublicVideo } from '@/utils/publicVideosApi';
import { mapPublicVideoToProperty } from '@/utils/publicVideoMapper';
import { useEngagementStore } from '@/stores/engagementStore';
import { useFeedPreloadStore } from '@/stores/feedPreloadStore';
import { makeFeedFilterKey } from '@/utils/feedFilter';
import { useLocalSearchParams } from 'expo-router';
import { warmUpExpoVideoPlayers } from '@/utils/expoVideoWarmup';
import { useVideoPlayerPoolStore } from '@/stores/videoPlayerPoolStore';
import { useVideoPlaybackRegistryStore } from '@/stores/videoPlaybackRegistryStore';
import { useSubtitleStore } from '@/stores/subtitleStore';
import { findActiveCue, parseVtt } from '@/utils/vtt';
import { fetchSubtitleSegmentUrisFromPlaylist, resolveSubtitleTrackFromHlsMaster } from '@/utils/hlsSubtitles';
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
  pooledPlayer?: any;
  autoPlay?: boolean;
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

const FeedItem = React.memo(function FeedItem({ item, index, pooledPlayer, autoPlay, isViewable, isSaved, scrollY, bottomTabBarHeight, overlayTop, overlayBottom, onToggleLike, onToggleSave, onOpenComments, onNavigateToProperty, onShare, globalSubtitleLanguageCode, onGlobalSubtitleLanguageChange, onSpeedingChange, onScrubbingChange }: FeedItemProps) {
  const registerPlayer = useVideoPlaybackRegistryStore((s) => s.register);
  const unregisterPlayer = useVideoPlaybackRegistryStore((s) => s.unregister);
  const OWNER: 'feed' = 'feed';
  // Subscribe per-item so only the affected cell re-renders when likes change.
  const isLiked = useEngagementStore((s) => s.isLiked(item.id));
  const [isPaused, setIsPaused] = useState(false);

  // Do not persist pause state across videos: whenever a cell becomes viewable again,
  // it should autoplay (unless the user pauses it while currently viewable).
  useEffect(() => {
    if (isViewable) {
      setIsPaused(false);
    }
  }, [isViewable]);

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

  const hookPlayer = useVideoPlayer(item.videoUrl, (p) => {
    // Setup for the hook-managed player.
    p.loop = true;
    p.muted = false;
    p.volume = 0.8;
    try {
      p.timeUpdateEventInterval = 0.25;
    } catch {}
  });

  const pooledOk = pooledPlayer && (pooledPlayer as any).status !== 'error';
  const player = pooledOk ? pooledPlayer : hookPlayer;

  // Register the *actual* player used for this cell so the feed can hard-pause everything on fast scroll.
  useEffect(() => {
    if (!player) return;
    registerPlayer('feed', item.videoUrl, player);
    return () => unregisterPlayer('feed', item.videoUrl, player);
  }, [item.videoUrl, player, registerPlayer, unregisterPlayer]);

  // Ensure pooled players get the same setup as hook players.
  useEffect(() => {
    if (!player) return;
    player.loop = true;
    try {
      player.timeUpdateEventInterval = 0.25;
    } catch {}
  }, [player]);

  // `player.currentTime` is not React state. Track it locally so UI (progress bar) updates live.
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const setAudible = useCallback(() => {
    if (!player) return;
    try {
      player.muted = false;
      player.volume = 0.8;
    } catch {}
  }, [player]);

  const setSilent = useCallback(() => {
    if (!player) return;
    try {
      player.muted = true;
      player.volume = 0;
    } catch {}
  }, [player]);

  const pauseSafe = useCallback(() => {
    if (!player) return;
    try {
      player.pause();
    } catch {}
  }, [player]);

  const playSafeWithRetry = useCallback(() => {
    if (!player) return () => {};

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

  const [selectedSubtitleUrl, setSelectedSubtitleUrl] = useState<string>('');

  useEffect(() => {
    // When global language changes (or video changes), choose the matching subtitle track for this video.
    if (!globalSubtitleLanguageCode) {
      setSelectedSubtitleUrl('');
      return;
    }

    const match = (item.subtitles ?? []).find((t: any) => t.code === globalSubtitleLanguageCode);
    if (match?.url) {
      setSelectedSubtitleUrl(match.url);
    } else {
      setSelectedSubtitleUrl('');
    }
  }, [item.id, globalSubtitleLanguageCode]);
  const [subtitleCues, setSubtitleCues] = useState<Array<{ start: number; end: number; text: string }>>([]);
  const [activeSubtitle, setActiveSubtitle] = useState('');
  React.useEffect(() => {
    if (!player) return;

    if (isViewable) {
      setAudible();

      if (isPaused) {
        pauseSafe();
        return;
      }

      return playSafeWithRetry();
    }

    // Not viewable => silent + paused.
    setSilent();

    // Ensure we never keep a feed item at 2x when it leaves the viewport.
    setIsSpeeding(false);
    onSpeedingChange?.(false);
    try {
      (player as any).playbackRate = 1;
    } catch {}
    try {
      (player as any).rate = 1;
    } catch {}

    pauseSafe();
  }, [isPaused, isViewable, onSpeedingChange, pauseSafe, playSafeWithRetry, setAudible, setSilent, player]);

  // Forced autoplay fallback for the first cell. This handles cases where FlatList viewability
  // doesn't fire immediately on navigation (common with fast mounts + pagingEnabled).
  React.useEffect(() => {
    if (!autoPlay) return;
    if (isPaused) return;

    setAudible();
    return playSafeWithRetry();
  }, [autoPlay, isPaused, playSafeWithRetry, setAudible]);

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
        const tryFetchVtt = async (url: string) => {
          const res = await fetch(url, { headers: { Accept: 'text/vtt' } });
          if (!res.ok) return null;
          const contentType = res.headers.get('content-type') ?? '';
          const text = await res.text();
          // Some servers return HTML on 403/redirect; ignore those.
          if (contentType.includes('text/html') || /^\s*<!doctype html/i.test(text)) return null;
          return text;
        };

        // Prefer Cloudflare subtitle tracks from the HLS manifest. The backend-provided `/storage/...` VTT
        // URLs are frequently protected (403), which breaks captions in production builds.
        let vttText: string | null = null;

        // If the selected URL is already a direct, fetchable VTT (e.g. Cloudflare `text/*.vtt`), use it.
        if (selectedSubtitleUrl && !selectedSubtitleUrl.includes('/storage/')) {
          vttText = await tryFetchVtt(selectedSubtitleUrl);
        }

        // Resolve subtitle track from the HLS master manifest and fetch first VTT segment.
        if (!vttText && item.videoUrl) {
          const subtitlePlaylistUrl = await resolveSubtitleTrackFromHlsMaster({
            masterUrl: item.videoUrl,
            languageCode: globalSubtitleLanguageCode ?? '',
          });

          if (subtitlePlaylistUrl) {
            const segs = await fetchSubtitleSegmentUrisFromPlaylist(subtitlePlaylistUrl);
            const firstSeg = segs[0];
            if (firstSeg) {
              // Fetch first segment; usually enough to show subtitles quickly.
              vttText = await tryFetchVtt(firstSeg);
            }
          }
        }

        if (cancelled) return;

        if (!vttText) {
          setSubtitleCues([]);
          setActiveSubtitle('');
          return;
        }

        const cues = parseVtt(vttText);
        setSubtitleCues(cues);
        setActiveSubtitle(findActiveCue(cues, player.currentTime));
      } catch (e: any) {
        setSubtitleCues([]);
        setActiveSubtitle('');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isViewable, selectedSubtitleUrl, player]);

  const EDGE_ZONE_WIDTH = scaleWidth(40);

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
  const params = useLocalSearchParams<{ transactionType?: string; location?: string }>();
  const preloadKey = useMemo(() => {
    const transactionType = String(params.transactionType ?? '');
    const city = String(params.location ?? '');
    if (!transactionType || !city) return null;
    return makeFeedFilterKey({ transactionType, city });
  }, [params.location, params.transactionType]);
  useUserPreferences();
  const insets = useSafeAreaInsets();
  const bottomTabBarHeight = useBottomTabBarHeight?.() ?? 0;

  // Constrain the touch overlay so it doesn't steal interactions from the AppHeader (top)
  // or the engagement/video controls (bottom).
  const overlayTop = insets.top + scaleHeight(12) + scaleHeight(16) + scaleHeight(32);
  const overlayBottom = scaleHeight(140) + bottomTabBarHeight;

  const [items, setItems] = useState<FeedVideoItem[]>([]);
  const itemsLenRef = useRef(0);
  useEffect(() => {
    itemsLenRef.current = items.length;
  }, [items.length]);

  const preloadedItems = useFeedPreloadStore((s) => s.preloadedItems);
  const consumePreloadedItems = useFeedPreloadStore((s) => s.consumePreloadedItems);
  const consumePreloadedItemsForKey = useFeedPreloadStore((s) => s.consumePreloadedItemsForKey);
  const keyedPreloads = useFeedPreloadStore((s) => s.byKey);

  const warmupDoneRef = useRef(false);
  const [page, setPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMorePages, setHasMorePages] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  // Refs to avoid stale closures inside FlatList callbacks.
  const pageRef = useRef(1);
  const hasMorePagesRef = useRef(true);
  const isFetchingRef = useRef(false);

  const endReachedCalledDuringMomentum = useRef(false);

  // Apply strict filters client-side (until backend supports server-side filtering).
  // This must match `preloadFeedFromCacheBeforeNavigate` so the feed remains consistent across pagination.
  // `items` is already filtered in `loadPage()` when params are present.
  const filteredProperties = useMemo(() => items, [items]);

  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const listRef = useRef<Animated.FlatList<any> | null>(null);
  // NOTE: `useIsFocused` is intentionally not used for playback gating; useFocusEffect is more reliable here.
  const _isFocused = useIsFocused();
  const [screenActive, setScreenActive] = useState(false);
  const currentIndexRef = useRef(0);

  const pooledByUrl = useVideoPlayerPoolStore((s) => s.byUrl);
  const releasePoolExcept = useVideoPlayerPoolStore((s) => s.releaseExcept);
  const pauseAllPool = useVideoPlayerPoolStore((s) => s.pauseAll);
  const pauseAllPoolExcept = useVideoPlayerPoolStore((s) => s.pauseAllExcept);
  const pauseAllRegistry = useVideoPlaybackRegistryStore((s) => s.pauseAll);
  const pauseAllRegistryExcept = useVideoPlaybackRegistryStore((s) => s.pauseAllExcept);

  useFocusEffect(
    useCallback(() => {
      setScreenActive(true);

      // Set active immediately on focus to avoid a "paused on landing" frame.
      const item = filteredProperties[currentIndexRef.current] ?? filteredProperties[0];
      if (item?.id) {
        setActiveItemId(item.id);
      }

      return () => {
        // Stop all playback when leaving the feed screen.
        setScreenActive(false);
        setActiveItemId(null);
        // Hard stop any pooled players (prevents audio continuing after fast navigation/reloads).
        pauseAllPool();
        pauseAllRegistry();
      };
    }, [filteredProperties, pauseAllPool, pauseAllRegistry])
  );
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
      const fetched = (res?.data ?? []).map(mapVideoToProperty);
      
      // TEMP: filtering disabled; show all videos.
      const newItems = fetched;

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

      // Refresh should reset the pool to avoid reusing stale players.
      releasePoolExcept([]);
      warmupDoneRef.current = false;

      await loadPage(1);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const applyItems = (next: FeedVideoItem[]) => {
      setItems(next);
      pageRef.current = 1;
      setPage(1);
      hasMorePagesRef.current = true;
      setHasMorePages(true);

      // Force list to start at the very top so we don't sometimes land on index 1.
      requestAnimationFrame(() => {
        try {
          (listRef.current as any)?.scrollToOffset?.({ offset: 0, animated: false });
        } catch {}
      });
    };

    // 1) Prefer keyed preloads (transactionType+city) coming from selection screens.
    if (preloadKey) {
      const entry = keyedPreloads[preloadKey];
      if (entry?.items?.length) {
        const consumed = consumePreloadedItemsForKey(preloadKey);
        if (consumed && consumed.length) {
          applyItems(consumed);
          return;
        }
      }
    }

    // 2) Legacy single-slot preload.
    if (preloadedItems && preloadedItems.length) {
      const consumed = consumePreloadedItems();
      if (consumed && consumed.length) {
        applyItems(consumed);
        return;
      }
    }

    // 3) Fall back to network load.
    loadPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preloadKey, keyedPreloads, consumePreloadedItemsForKey]);

  useEffect(() => {
    // If a keyed preload arrives shortly after mount, hydrate from it.
    if (itemsLenRef.current > 0) return;

    if (preloadKey) {
      const entry = keyedPreloads[preloadKey];
      if (entry?.items?.length) {
        const consumed = consumePreloadedItemsForKey(preloadKey);
        if (consumed && consumed.length) {
          setItems(consumed);
          pageRef.current = 1;
          setPage(1);
          hasMorePagesRef.current = true;
          setHasMorePages(true);
          return;
        }
      }
    }

    // Legacy preloads.
    if (!preloadedItems || preloadedItems.length === 0) return;

    const consumed = consumePreloadedItems();
    if (!consumed || consumed.length === 0) return;

    setItems(consumed);
    pageRef.current = 1;
    setPage(1);
    hasMorePagesRef.current = true;
    setHasMorePages(true);
  }, [consumePreloadedItems, consumePreloadedItemsForKey, keyedPreloads, preloadKey, preloadedItems]);

  // Warm up expo-video players for the first few items once we have data.
  useEffect(() => {
    if (warmupDoneRef.current) return;
    if (!items || items.length === 0) return;

    const urls = items
      .map((it) => it.videoUrl)
      .filter(Boolean)
      .slice(0, 3) as string[];

    if (urls.length === 0) return;

    warmupDoneRef.current = true;
    warmUpExpoVideoPlayers(urls, { count: 3, playMs: 350, keepInPool: true }).catch(() => {
      // ignore
    });
  }, [items]);

  // Ensure the first item is considered viewable when landing on the feed,
  // so the first video starts playing immediately.
  useEffect(() => {
    if (!firstItemId) return;

    // Always set an active item when we have data; avoids landing with all videos paused.
    setActiveItemId(firstItemId);

    // Ensure list offset is at 0 when first item becomes available.
    requestAnimationFrame(() => {
      try {
        (listRef.current as any)?.scrollToOffset?.({ offset: 0, animated: false });
      } catch {}
    });
  }, [firstItemId]);

  // When the screen becomes active, re-assert the current visible item to trigger the play effect.
  useEffect(() => {
    if (!screenActive) return;
    const item = filteredProperties[currentIndexRef.current] ?? filteredProperties[0];
    if (item?.id) setActiveItemId(item.id);
  }, [filteredProperties, screenActive]);

  // App background/foreground safety: pause everything when app goes inactive.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') {
        pauseAllPool();
        pauseAllRegistry();
      } else {
        // re-assert active item to resume (FeedItem will handle play)
        const item = filteredProperties[currentIndexRef.current] ?? filteredProperties[0];
        if (screenActive && item?.id) setActiveItemId(item.id);
      }
    });
    return () => sub.remove();
  }, [filteredProperties, pauseAllPool, screenActive]);

  // Ensure only the active item's player can keep playing. Best-effort: pause/mute others.
  useEffect(() => {
    if (!screenActive) return;
    const active = filteredProperties[currentIndexRef.current] ?? filteredProperties[0];
    const keepUrl = active?.videoUrl ? [active.videoUrl] : [];
    if (!keepUrl.length) return;

    pauseAllPoolExcept(keepUrl);
    pauseAllRegistryExcept('feed', keepUrl);
  }, [activeItemId, filteredProperties, pauseAllPoolExcept, pauseAllRegistryExcept, screenActive]);
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
    // Fast switching for instant playback, but still avoids tiny overlaps.
    itemVisiblePercentThreshold: 55,
    minimumViewTime: 0,
    waitForInteraction: false,
  }).current;

  const onViewableItemsChanged = useRef(({ viewableItems: viewable }: { viewableItems: ViewToken[] }) => {
    if (!screenActive) return;
    // With pagingEnabled, at most one item should be predominantly visible.
    const active = viewable.find((it) => it.isViewable);
    const activeId = (active?.key as string) || null;

    // During initial mount/layout, FlatList can report no viewable items briefly.
    // Don't clear activeItemId in that case (it would pause all videos).
    if (activeId) {
      setActiveItemId(activeId);
    } else {
      return;
    }

    const activeIndex = filteredProperties.findIndex((p) => p.id === activeId);
    if (activeIndex >= 0) {
      currentIndexRef.current = activeIndex;
    }

    // Once the user scrolls past the first few items, we can release pooled warmup players
    // to reduce memory usage.
    if (activeIndex >= 3) {
      const keepUrls = items
        .slice(activeIndex, activeIndex + 2)
        .map((it) => it.videoUrl)
        .filter(Boolean) as string[];
      // keep the current and next item (best-effort)
      releasePoolExcept(keepUrls);
    }

    // Prefetch the next page when the user is within the last ~3 items.
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

  // `useIsFocused()` can be flaky on initial mount with Expo Router + tabs.
  // Use a focus-effect-backed flag to ensure autoplay works immediately on navigation.
  const canPlay = screenActive && !locationsModalVisible && !commentsModalVisible;

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
    (propertyReference: string, videoId: string, type?: string) => {
      const mode = type === 'offplan' ? 'offplan' : undefined;
      router.push(buildPropertyDetailsRoute({ propertyReference, id: videoId, mode }));
    },
    [router]
  );

  const renderProperty = useCallback(
    ({ item, index }: { item: FeedVideoItem; index: number }) => (
      <FeedItem
        item={item}
        index={index}
        pooledPlayer={index < 3 && item.videoUrl ? pooledByUrl[item.videoUrl]?.player : undefined}
        autoPlay={canPlay && activeItemId === item.id}
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
        onNavigateToProperty={(propertyReference) => handleNavigateToProperty(propertyReference, item.id, item.type)}
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
      bottomTabBarHeight,
      overlayBottom,
      overlayTop,
      pooledByUrl,
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
        initialScrollIndex={0}
        ref={(r) => {
          // @ts-ignore
          listRef.current = r;
        }}
        data={filteredProperties}
        renderItem={renderProperty}
        keyExtractor={keyExtractor}
        scrollEnabled={!isScrubbing && !isHoldingSpeed}
        pagingEnabled={Platform.OS === 'ios'}
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
        snapToInterval={Platform.OS === 'android' ? SCREEN_HEIGHT : undefined}
        snapToAlignment="start"
        overScrollMode="never"
        decelerationRate={Platform.OS === 'ios' ? 'fast' : 0.98}
        disableIntervalMomentum={Platform.OS === 'android'}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        // NOTE: disabling clipping improves reliability for video players during fast swipes.
        // Clipping can tear down native views before pause/mute effects run, causing "ghost audio".
        removeClippedSubviews={false}
        // Tuned for snappy swipes: render fewer offscreen items to reduce JS/UI work per gesture.
        // (Players for first items are warmed separately.)
        initialNumToRender={2}
        maxToRenderPerBatch={3}
        windowSize={5}
        updateCellsBatchingPeriod={16}
        getItemLayout={(_data, index) => ({ length: SCREEN_HEIGHT, offset: SCREEN_HEIGHT * index, index })}
        // Avoid landing on index 1 due to "maintain visible position" heuristics when data changes.
        // We want the feed to always start from the top on entry.
        // maintainVisibleContentPosition={undefined as any}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => {
          // Hard-stop any lingering audio as the user starts a fast swipe,
          // but keep the currently active item playing for an instant/continuous feel.
          const active = filteredProperties[currentIndexRef.current];
          const keepUrl = active?.videoUrl ? [active.videoUrl] : [];
          if (keepUrl.length) {
            pauseAllRegistryExcept('feed', keepUrl);
            pauseAllPoolExcept(keepUrl);
          } else {
            pauseAllRegistry('feed');
            pauseAllPool();
          }
        }}
        onMomentumScrollBegin={() => {
          endReachedCalledDuringMomentum.current = false;
          const active = filteredProperties[currentIndexRef.current];
          const keepUrl = active?.videoUrl ? [active.videoUrl] : [];
          if (keepUrl.length) {
            pauseAllRegistryExcept('feed', keepUrl);
            pauseAllPoolExcept(keepUrl);
          } else {
            pauseAllRegistry('feed');
            pauseAllPool();
          }
        }}
        onEndReached={() => {
          if (endReachedCalledDuringMomentum.current) return;
          endReachedCalledDuringMomentum.current = true;

          if (hasMorePagesRef.current && !isFetchingRef.current) {
            loadPage(pageRef.current + 1);
          }
        }}
        onEndReachedThreshold={0.8} // Prefetch next page a bit before the end without over-triggering
        onMomentumScrollEnd={(e) => {
          // Deterministic active item selection.
          const offsetY = e.nativeEvent.contentOffset.y;
          const nextIndex = Math.max(0, Math.round(offsetY / SCREEN_HEIGHT));
          currentIndexRef.current = nextIndex;
          const item = filteredProperties[nextIndex];
          if (screenActive && item?.id) {
            setActiveItemId(item.id);
          }
        }}
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


