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
} from 'react-native';
import { useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { scaleHeight, scaleWidth } from '@/utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Property } from '@/types';
import { fetchPublicVideos } from '@/utils/publicVideosApi';
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
  onNavigateToProperty: (id: string) => void;
}

function FeedItem({ item, index, isViewable, isLiked, isSaved, scrollY, onToggleLike, onToggleSave, onOpenComments, onNavigateToProperty }: FeedItemProps) {
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
        return Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.8;
      },
      onPanResponderRelease: (_evt, gestureState) => {
        const { dx } = gestureState;
        // Right -> Left swipe
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

export default function FeedScreen() {
  const router = useRouter();
  useUserPreferences();

  const [items, setItems] = useState<FeedVideoItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMorePages, setHasMorePages] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const endReachedCalledDuringMomentum = useRef(false);

  // NOTE: Backend videos don't currently include the fields our local filters expect
  // (listingType/location/lifestyle). For now, we display the fetched videos as-is.
  const filteredProperties = useMemo(() => items, [items]);

  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  const firstItemId = filteredProperties[0]?.id;

  const toAbsoluteUrl = (maybePath: string) => {
    if (!maybePath) return '';
    if (maybePath.startsWith('http://') || maybePath.startsWith('https://')) return maybePath;
    if (maybePath.startsWith('/')) return `https://api.saqan.com${maybePath}`;
    return `https://api.saqan.com/${maybePath}`;
  };

  const pickPlaybackUrl = (v: any): { url: string } => {
    // Prefer HLS when backend says it can stream.
    if (v?.playback?.can_stream && v?.playback?.stream_url) {
      return { url: v.playback.stream_url };
    }

    // Cloudflare fallback (if present and not signed).
    if (
      v?.cloudflare?.playback_url &&
      v?.cloudflare?.requires_signed_urls === false &&
      v?.cloudflare?.status === 'READY'
    ) {
      return { url: v.cloudflare.playback_url };
    }

    // Local MP4 fallback (API returns relative path).
    if (v?.playback?.local_url) {
      return { url: toAbsoluteUrl(v.playback.local_url) };
    }

    return { url: '' };
  };

  const mapVideoToProperty = (v: any): FeedVideoItem => {
    const picked = pickPlaybackUrl(v);
    const videoUrl = picked.url;
    const thumbUrl = v?.cloudflare?.thumbnail_url || v?.playback?.thumbnail_url;

    return {
      id: String(v.video_id),
      title: v.title || 'Untitled',
      description: v.description || '',
      price: 0,
      currency: 'AED',
      listingType: 'BUY',
      propertyType: 'apartment',
      bedrooms: 0,
      bathrooms: 0,
      sizeSqft: 0,
      location: { city: '', area: '', latitude: 0, longitude: 0 },
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
    if (isFetching) return;
    if (!hasMorePages && nextPage !== 1) return;

    try {
      setIsFetching(true);
      const res = await fetchPublicVideos({ page: nextPage, perPage: 20 });
      const newItems = (res?.data ?? [])
        .map(mapVideoToProperty);

      setHasMorePages(Boolean(res?.meta?.has_more_pages));
      setPage(nextPage);
      setItems((prev) => (nextPage === 1 ? newItems : [...prev, ...newItems]));
    } catch (err: any) {
      // Keep existing items on error.
      const message = err?.message || 'Failed to load videos.';
      Alert.alert('Error', message);
    } finally {
      setIsFetching(false);
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
    // With pagingEnabled, at most one item should be predominantly visible.
    const active = items.find((it) => it.isViewable);
    setActiveItemId((active?.key as string) || null);
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

  const renderProperty = ({ item, index }: { item: FeedVideoItem; index: number }) => {
    return (
      <FeedItem
        item={item}
        index={index}
        isViewable={activeItemId === item.id}
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

  if (isFetching && filteredProperties.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>Loading…</Text>
        <Text style={styles.emptyText}>Fetching videos</Text>
      </View>
    );
  }

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
        onMomentumScrollBegin={() => {
          endReachedCalledDuringMomentum.current = false;
        }}
        onEndReached={() => {
          if (endReachedCalledDuringMomentum.current) return;
          endReachedCalledDuringMomentum.current = true;

          if (hasMorePages && !isFetching) {
            loadPage(page + 1);
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


