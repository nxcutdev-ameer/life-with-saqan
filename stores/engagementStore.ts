import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { setPublicVideoLike } from '@/utils/publicVideosApi';

const STORAGE_KEY = '@liked_videos_v1';

type EngagementState = {
  likedVideoIds: Set<string>;

  /** Latest known likes count for a given video id (from API responses). */
  likesCountByVideoId: Record<string, number>;

  hydrated: boolean;
  hydrate: () => Promise<void>;

  isLiked: (videoId: string | number) => boolean;

  /**
   * Returns the best known likes count. If we don't have an override, returns `fallback`.
   */
  getLikesCount: (videoId: string | number, fallback: number) => number;

  toggleLike: (videoId: string | number) => Promise<{ likesCount?: number } | null>;
};

export const useEngagementStore = create<EngagementState>((set, get) => ({
  likedVideoIds: new Set(),
  likesCountByVideoId: {},
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const ids = JSON.parse(raw);
        if (Array.isArray(ids)) {
          set({ likedVideoIds: new Set(ids.map(String)) });
        }
      }
    } catch {
      // ignore
    } finally {
      set({ hydrated: true });
    }
  },

  isLiked: (videoId) => {
    return get().likedVideoIds.has(String(videoId));
  },

  getLikesCount: (videoId, fallback) => {
    const id = String(videoId);
    const override = get().likesCountByVideoId[id];
    return typeof override === 'number' ? override : fallback;
  },

  toggleLike: async (videoId) => {
    const id = String(videoId);
    const wasLiked = get().likedVideoIds.has(id);
    const nextLiked = !wasLiked;

    // optimistic update (liked state)
    set((state) => {
      const next = new Set(state.likedVideoIds);
      if (nextLiked) next.add(id);
      else next.delete(id);

      // optimistic count update only if we already know a baseline
      const currentCount = state.likesCountByVideoId[id];
      const nextCounts = { ...state.likesCountByVideoId };
      if (typeof currentCount === 'number') {
        nextCounts[id] = Math.max(0, currentCount + (nextLiked ? 1 : -1));
      }

      return { likedVideoIds: next, likesCountByVideoId: nextCounts };
    });

    try {
      const res = await setPublicVideoLike({ videoId: id, liked: nextLiked });
      const likesCount = res?.data?.likes_count;

      // If backend returns a count, treat it as the source of truth
      if (typeof likesCount === 'number') {
        set((state) => ({
          likesCountByVideoId: {
            ...state.likesCountByVideoId,
            [id]: likesCount,
          },
        }));
      }

      // persist liked ids
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(get().likedVideoIds))).catch(() => {
        // ignore
      });

      return typeof likesCount === 'number' ? { likesCount } : {};
    } catch (e) {
      // revert liked state (and revert optimistic count, if we changed it)
      set((state) => {
        const next = new Set(state.likedVideoIds);
        if (wasLiked) next.add(id);
        else next.delete(id);

        // revert count optimistic change if baseline exists
        const currentCount = state.likesCountByVideoId[id];
        const nextCounts = { ...state.likesCountByVideoId };
        if (typeof currentCount === 'number') {
          nextCounts[id] = Math.max(0, currentCount + (wasLiked ? 1 : -1));
        }

        return { likedVideoIds: next, likesCountByVideoId: nextCounts };
      });

      // persist reverted state
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(get().likedVideoIds))).catch(() => {
        // ignore
      });

      throw e;
    }
  },
}));
