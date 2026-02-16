import { createVideoPlayer } from 'expo-video';
import { useVideoPlayerPoolStore } from '@/stores/videoPlayerPoolStore';

/**
 * Best-effort warm up for expo-video.
 *
 * The goal is to force the native player to initialize and begin buffering
 * for the first few videos *before* the user swipes to them.
 *
 * Notes:
 * - We keep players muted to avoid audio glitches.
 * - We release players after a short window to avoid memory leaks.
 */
export async function warmUpExpoVideoPlayers(
  urls: string[],
  opts?: { count?: number; playMs?: number; keepInPool?: boolean }
) {
  const count = opts?.count ?? 3;
  const playMs = opts?.playMs ?? 350;
  const keepInPool = opts?.keepInPool ?? false;

  const slice = urls.filter(Boolean).slice(0, count);
  const players = slice.map((url) => {
    // If we already have a pooled player, reuse it.
    const existing = useVideoPlayerPoolStore.getState().get(url);
    if (existing) return { url, player: existing };

    const isHls = /\.m3u8(\?|$)/i.test(url);
    const player = createVideoPlayer({
      uri: url,
      // iOS can't use cache with HLS; enabling it can cause failures.
      useCaching: !isHls,
      contentType: isHls ? 'hls' : 'auto',
    });
    player.muted = true;
    player.volume = 0;
    player.loop = true;
    try {
      // more frequent status updates can help some devices get to readyToPlay faster
      player.timeUpdateEventInterval = 0.25;
    } catch {}

    if (keepInPool) {
      useVideoPlayerPoolStore.getState().upsert(url, player);
    }

    return { url, player };
  });

  // Kick off buffering.
  for (const { player } of players) {
    try {
      player.play();
    } catch {}
  }

  await new Promise((r) => setTimeout(r, playMs));

  for (const { player } of players) {
    try {
      player.pause();
    } catch {}
  }

  if (!keepInPool) {
    for (const { player } of players) {
      try {
        player.release();
      } catch {}
    }
  }
}
