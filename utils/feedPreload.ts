import { fetchPublicVideos } from '@/utils/publicVideosApi';
import { mapPublicVideoToProperty } from '@/utils/publicVideoMapper';
import { useFeedPreloadStore } from '@/stores/feedPreloadStore';
import { warmUpVideoUrls } from '@/utils/videoWarmup';

/**
 * Fetch the first feed page and warm up the first few video URLs.
 *
 * This is used to reduce initial playback latency (DNS/TLS + first buffer) when navigating
 * into the feed for the first time in production builds.
 */
export async function preloadFeedBeforeNavigate(opts?: { perPage?: number; warmCount?: number }) {
  const perPage = opts?.perPage ?? 20;
  const warmCount = opts?.warmCount ?? 3;

  const res = await fetchPublicVideos({ page: 1, perPage });
  const items = (res?.data ?? []).map(mapPublicVideoToProperty);

  // Store so feed screen can render immediately without waiting for its own request.
  useFeedPreloadStore.getState().setPreloadedItems(items);

  // Best-effort warm up.
  const urls = items.map((it) => it.videoUrl).filter(Boolean).slice(0, warmCount);
  await warmUpVideoUrls(urls);

  return { items, meta: res?.meta };
}
