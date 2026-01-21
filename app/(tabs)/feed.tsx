import React, { useEffect, useMemo, useRef, useState } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VideoView, useVideoPlayer } from 'expo-video';
import { scaleHeight, scaleWidth } from '@/utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Property } from '@/types';
import { fetchPublicVideos, sharePublicVideo } from '@/utils/publicVideosApi';
import { useEngagementStore } from '@/stores/engagementStore';
import { useSubtitleStore } from '@/stores/subtitleStore';
import { findActiveCue, parseVtt } from '@/utils/vtt';
import * as Haptics from 'expo-haptics';
import CommentsModal from '@/components/CommentsModal';
import AppHeader from '@/components/AppHeader';
import LocationsModal from '@/components/LocationsModal';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import { feedStyles as styles } from '@/constants/feedStyles';
import PropertyFooter from '@/components/PropertyFooter';
import SpeedBoostOverlay from '@/components/SpeedBoostOverlay';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type FeedVideoItem = Property;

interface FeedItemProps {
  item: FeedVideoItem;
  index: number;
  isViewable: boolean;
  isLiked: boolean;
  isSaved: boolean;
  scrollY: Animated.Value;
  onToggleLike: (id: string) => void;
  onToggleSave: (id: string) => void;
  onOpenComments: (id: string) => void;
  onNavigateToProperty: (propertyReference: string) => void;
  onShare: (id: string) => void;
  globalSubtitleLanguageCode?: string;
  onGlobalSubtitleLanguageChange?: (languageCode: string) => void;
}

function FeedItem({ item, index, isViewable, isLiked, isSaved, scrollY, onToggleLike, onToggleSave, onOpenComments, onNavigateToProperty, onShare, globalSubtitleLanguageCode, onGlobalSubtitleLanguageChange }: FeedItemProps) {
  const [isPaused, setIsPaused] = useState(false);

  const player = useVideoPlayer(item.videoUrl, (player) => {
    player.loop = true;
    player.muted = false;
    player.volume = 0.8;
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
    if (isViewable) {
      if (isPaused) {
        player.pause();
      } else {
        player.play();
      }
    } else {
      // Ensure we never keep a feed item at 2x when it leaves the viewport.
      try {
        (player as any).playbackRate = 1;
      } catch {}
      try {
        (player as any).rate = 1;
      } catch {}

      // Hard-stop when leaving viewport.
      try {
        player.pause();
        player.currentTime = 0;
      } catch {}

      // Ensure next time it becomes active, it will play from start unless user paused.
      setIsPaused(false);
    }
  }, [isPaused, isViewable, player]);

  React.useEffect(() => {
    if (!isViewable) return;

    let rafId: number | null = null;
    let lastUpdate = 0;

    const tick = (t: number) => {
      // Update the progress bar animates between updates for smoothness.
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
    player.currentTime = timestamp;
    // Keep UI in sync immediately on manual seeks.
    setCurrentTime(timestamp);
    if (subtitleCues.length) {
      setActiveSubtitle(findActiveCue(subtitleCues, timestamp));
    }
  };

  React.useEffect(() => {
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

  const insets = useSafeAreaInsets();
  const bottomTabBarHeight = useBottomTabBarHeight?.() ?? 0;

  const EDGE_ZONE_WIDTH = scaleWidth(70);

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

  const setPlaybackRate = (rate: number) => {
    try {
      (player as any).playbackRate = rate;
    } catch {}
    try {
      (player as any).rate = rate;
    } catch {}
  };

  const [isSpeeding, setIsSpeeding] = useState(false);

  const startSpeed = () => {
    setIsSpeeding(true);
    setPlaybackRate(2);
  };
  const stopSpeed = () => {
    setIsSpeeding(false);
    setPlaybackRate(1);
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
          player.pause();
          setIsPaused(true);
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
          <VideoView
            player={player}
            style={styles.video}
            contentFit="cover"
            nativeControls={false}
          />
        ) : (
          <View style={[styles.video, { alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ color: '#fff', opacity: 0.9, fontWeight: '600' }}>Video unavailable</Text>
          </View>
        )}

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
        style={{
          position: 'absolute',
          top: OVERLAY_TOP,
          left: 0,
          right: 0,
          bottom: OVERLAY_BOTTOM,
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

     <PropertyFooter
       item={item}
        currentTime={currentTime}
        duration={duration}
        isLiked={isLiked}
        isSaved={isSaved}
        onToggleLike={onToggleLike}
        onToggleSave={onToggleSave}
        onOpenComments={onOpenComments}
        onShare={onShare}
        onSeek={handleSeek}
        selectedSubtitleCode={globalSubtitleLanguageCode}
        onSubtitleSelect={(subtitleUrl, languageCode) => {
          setSelectedSubtitleUrl(subtitleUrl);
          onGlobalSubtitleLanguageChange?.(languageCode);
        }}
        onNavigateToProperty={() => {
          player.pause();
          setIsPaused(true);
          onNavigateToProperty(item.propertyReference || item.id);
        }}
      />
    </View>
  );
}

export default function FeedScreen() {
  const router = useRouter();
  useUserPreferences();
  const insets = useSafeAreaInsets();

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

  const globalSubtitleLanguageCode = useSubtitleStore((st) => st.languageCode);
  const setGlobalSubtitleLanguageCode = useSubtitleStore((st) => st.setLanguageCode);

  const firstItemId = filteredProperties[0]?.id;

  const toAbsoluteUrl = (maybePath: string) => {
    if (!maybePath) return '';
    if (maybePath.startsWith('http://') || maybePath.startsWith('https://')) return maybePath;
    if (maybePath.startsWith('/')) return `https://api.saqan.com${maybePath}`;
    return `https://api.saqan.com/${maybePath}`;
  };

  const isDirectMediaUrl = (url?: string | null) => {
    if (!url) return false;
    const u = url.toLowerCase();
    // We only want URLs that point to actual media, not Cloudflare's HTML watch page.
    return u.endsWith('.m3u8') || u.endsWith('.mp4') || u.includes('/manifest/') || u.includes('manifest/video.m3u8');
  };

  const pickPlaybackUrl = (v: any): { url: string } => {
    // 1) Prefer HLS manifest URLs.
    if (v?.playback?.can_stream && isDirectMediaUrl(v?.playback?.stream_url)) {
      return { url: v.playback.stream_url };
    }

    if (
      v?.cloudflare?.status === 'READY' &&
      v?.cloudflare?.requires_signed_urls === false &&
      isDirectMediaUrl(v?.cloudflare?.stream_url)
    ) {
      return { url: v.cloudflare.stream_url };
    }

    if (
      v?.cloudflare?.status === 'READY' &&
      v?.cloudflare?.requires_signed_urls === false &&
      isDirectMediaUrl(v?.cloudflare?.playback_url)
    ) {
      return { url: v.cloudflare.playback_url };
    }

    // 2) MP4 fallback.
    if (isDirectMediaUrl(v?.playback?.local_url)) {
      return { url: toAbsoluteUrl(v.playback.local_url) };
    }

    // If local_url exists, it's mp4 even if it doesn't match the above checks.
    if (v?.playback?.local_url) {
      return { url: toAbsoluteUrl(v.playback.local_url) };
    }

    // 3) As a last resort, if playback.stream_url exists but is a /watch URL, it will likely NOT play in-app.
    // Return empty so we show the "Video unavailable" placeholder instead of a broken player.
    return { url: '' };
  };

  const prettifyRoomKey = (key: string) => {
    if (!key) return '';
    return key
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .trim()
      .replace(/\b\w/g, (m) => m.toUpperCase());
  };

  const mapRoomTimestampsToRooms = (roomTimestamps: any): { name: string; timestamp: number }[] => {
    if (!roomTimestamps || typeof roomTimestamps !== 'object') return [];
    return Object.entries(roomTimestamps)
      .map(([key, value]: any) => ({
        name: prettifyRoomKey(String(key)),
        timestamp: Number(value?.start ?? 0),
      }))
      .filter((r) => Number.isFinite(r.timestamp) && r.timestamp >= 0)
      .sort((a, b) => a.timestamp - b.timestamp);
  };

  const toNumberOrZero = (value: any) => {
    const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;
    return Number.isFinite(n) ? n : 0;
  };

  const mapVideoToProperty = (v: any): FeedVideoItem => {
    const picked = pickPlaybackUrl(v);
    const videoUrl = picked.url;
    const thumbUrl = v?.cloudflare?.thumbnail_url || v?.playback?.thumbnail_url;
    const rooms = mapRoomTimestampsToRooms(v?.property_video_metadata?.room_timestamps);
    const subtitles = (v?.cloudflare?.subtitles ?? [])
      .map((s: any) => ({
        code: String(s?.language_code || ''),
        label: s?.label,
        url: s?.url ?? null,
        filePath: s?.file_path ?? null,
      }))
      .filter((s: any) => Boolean(s.code));

    const backendProperty = v?.property;
    const meta = backendProperty?.meta;

    const title = backendProperty?.title || backendProperty?.name || v.title || 'Untitled';
    const defaultPricing = backendProperty?.default_pricing || 'month';
    const priceField =
      defaultPricing === 'week'
        ? meta?.week_price
        : defaultPricing === 'year'
          ? meta?.year_price
          : meta?.month_price;
    const price = toNumberOrZero(priceField);

    const bedrooms = toNumberOrZero(meta?.bedrooms);
    const bathrooms = toNumberOrZero(meta?.bathrooms);
    const sizeSqft = toNumberOrZero(meta?.size);

    const city = backendProperty?.emirate?.name || '';
    const area = backendProperty?.district?.name || '';

    return {
      id: String(v.video_id),
      propertyReference: v?.property_reference,
      title,
      description: backendProperty?.description || v.description || '',
      rooms,
      subtitles,
      defaultPricing,
      price,
      currency: 'AED',
      listingType: backendProperty?.type === 'rent' ? 'RENT' : 'BUY',
      propertyType: 'apartment',
      bedrooms,
      bathrooms,
      sizeSqft,
      location: { city, area, latitude: 0, longitude: 0 },
      videoUrl,
      thumbnailUrl: thumbUrl || '',
      images: [],
      amenities: [],
      lifestyle: [],
      agent: {
        id: '1',
        name: 'Saqan',
        agency: 'Saqan',
        photo: '',
        phone: '',
        email: '',
        isVerified: true,
      },
      agentName: 'Saqan',
      agentPhoto: '',
      likesCount: v?.engagement?.likes_count ?? 0,
      savesCount: 0,
      sharesCount: v?.engagement?.shares_count ?? 0,
      commentsCount: v?.engagement?.comments_count ?? 0,
    };
  };

  const loadPage = async (nextPage: number) => {
    if (isFetchingRef.current) return;
    if (!hasMorePagesRef.current && nextPage !== 1) return;

    try {
      isFetchingRef.current = true;
      setIsFetching(true);
      const res = await fetchPublicVideos({ page: nextPage, perPage: 20 });
      const newItems = (res?.data ?? [])
        .map(mapVideoToProperty);

      const nextHasMore = Boolean(res?.meta?.has_more_pages);
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
  const { hydrated: likesHydrated, hydrate: hydrateLikes, toggleLike: toggleLikeGlobal, isLiked: isLikedGlobal } = useEngagementStore();

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
    itemVisiblePercentThreshold: 80,
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

  const toggleLike = async (propertyId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const res = await toggleLikeGlobal(propertyId);
      const likesCount = res?.likesCount;
      if (typeof likesCount === 'number') {
        setItems((prev) => prev.map((it) => (it.id === propertyId ? { ...it, likesCount } : it)));
      }
    } catch (err: any) {
      const message = err?.message || 'Failed to update like.';
      Alert.alert('Error', message);
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

  const handleShare = async (id: string) => {
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
  };

  const renderProperty = ({ item, index }: { item: FeedVideoItem; index: number }) => {
    return (
      <FeedItem
        item={item}
        index={index}
        isViewable={activeItemId === item.id}
        isLiked={isLikedGlobal(item.id)}
        isSaved={savedProperties.has(item.id)}
        scrollY={scrollY}
        onToggleLike={toggleLike}
        onToggleSave={toggleSave}
        onOpenComments={(id) => {
          setSelectedPropertyId(id);
          setCommentsModalVisible(true);
        }}
        onNavigateToProperty={async (propertyReference) => {
          // Cache item data for the details screen (until a dedicated property endpoint is wired).
          try {
            const current = items.find((p) => p.propertyReference === propertyReference || p.id === propertyReference);
            if (current?.propertyReference) {
              await AsyncStorage.setItem(
                `@property_cache_${current.propertyReference}`,
                JSON.stringify(current)
              );
            }
          } catch {}

          router.push(`/property/${propertyReference}`);
        }}
        onShare={handleShare}
        globalSubtitleLanguageCode={globalSubtitleLanguageCode}
        onGlobalSubtitleLanguageChange={(code) => setGlobalSubtitleLanguageCode(code)}
      />
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
        decelerationRate="fast"
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        removeClippedSubviews
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={5}
        updateCellsBatchingPeriod={50}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
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
        onEndReachedThreshold={0.6}
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


