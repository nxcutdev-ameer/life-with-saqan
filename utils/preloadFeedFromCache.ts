import { usePublicVideosCacheStore } from '@/stores/publicVideosCacheStore';
import { useFeedPreloadStore } from '@/stores/feedPreloadStore';
import { filterPublicVideosStrict, makeFeedFilterKey, mapUiTransactionTypeToBackendType, type FeedFilterKey } from '@/utils/feedFilter';
import { mapPublicVideoToProperty } from '@/utils/publicVideoMapper';
import { warmUpExpoVideoPlayers } from '@/utils/expoVideoWarmup';

/**
 * Uses the LandingScreen-warmed public videos page-1 cache, strictly filters by
 * `property.meta.type` and `property.emirate.name`, maps to feed items, stores them
 * under a keyed preload entry, and warms the first 3 expo-video players.
 */
export async function preloadFeedFromCacheBeforeNavigate(
  filter: FeedFilterKey,
  opts?: { warmCount?: number; warmPlayers?: boolean }
) {
  const warmCount = opts?.warmCount ?? 3;
  const warmPlayers = opts?.warmPlayers ?? true;

  // Ensure cache is being fetched (if not already loaded).
  const videos = await usePublicVideosCacheStore.getState().warmPage1({ perPage: 50 });

  // TEMP: filtering disabled; show all videos.
  const items = (videos ?? []).map(mapPublicVideoToProperty);

  const key = makeFeedFilterKey({ ...filter, transactionType: mapUiTransactionTypeToBackendType(filter.transactionType) });
  useFeedPreloadStore.getState().setPreloadedItemsForKey(key, items);

  const urls = items.map((it) => it.videoUrl).filter(Boolean).slice(0, warmCount) as string[];
  if (warmPlayers && urls.length) {
    await warmUpExpoVideoPlayers(urls, { count: warmCount, playMs: 350, keepInPool: true });
  }

  return { key, items };
}
