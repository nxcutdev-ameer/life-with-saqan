import { create } from 'zustand';
import type { VideoPlayer } from 'expo-video';

export type PlaybackOwner = 'feed' | 'reels';

type Entry = { owner: PlaybackOwner; url: string; player: VideoPlayer; createdAt: number };

type VideoPlaybackRegistryState = {
  byOwnerUrl: Record<string, Entry>; // key = `${owner}:${url}`
  register: (owner: PlaybackOwner, url: string, player: VideoPlayer) => void;
  unregister: (owner: PlaybackOwner, url: string, player?: VideoPlayer) => void;
  pauseAll: (owner?: PlaybackOwner) => void;
  pauseAllExcept: (owner: PlaybackOwner, keepUrls: string[]) => void;
};

function keyOf(owner: PlaybackOwner, url: string) {
  return `${owner}:${url}`;
}

function pauseAndMute(player: VideoPlayer) {
  try {
    player.muted = true;
    player.volume = 0;
  } catch {}
  try {
    player.pause();
  } catch {}
}

export const useVideoPlaybackRegistryStore = create<VideoPlaybackRegistryState>((set, get) => ({
  byOwnerUrl: {},

  register: (owner, url, player) => {
    if (!owner || !url || !player) return;
    set((st) => ({
      byOwnerUrl: {
        ...st.byOwnerUrl,
        [keyOf(owner, url)]: { owner, url, player, createdAt: Date.now() },
      },
    }));
  },

  unregister: (owner, url, player) => {
    if (!owner || !url) return;
    set((st) => {
      const k = keyOf(owner, url);
      const existing = st.byOwnerUrl[k];
      if (!existing) return st;
      if (player && existing.player !== player) return st;
      const next = { ...st.byOwnerUrl };
      delete next[k];
      return { byOwnerUrl: next };
    });
  },

  pauseAll: (owner) => {
    const entries = Object.values(get().byOwnerUrl);
    for (const e of entries) {
      if (owner && e.owner !== owner) continue;
      pauseAndMute(e.player);
    }
  },

  pauseAllExcept: (owner, keepUrls) => {
    const keep = new Set(keepUrls.filter(Boolean));
    const entries = Object.values(get().byOwnerUrl);
    for (const e of entries) {
      if (e.owner !== owner) continue;
      if (keep.has(e.url)) continue;
      pauseAndMute(e.player);
    }
  },
}));
