import { create } from 'zustand';
import type { Property } from '@/types';

export type FeedPreloadKey = string;

type PreloadEntry = {
  items: Property[];
  loadedAt: number;
};

type FeedPreloadState = {
  /** Legacy: single-slot preload (kept for backward compatibility). */
  preloadedItems: Property[] | null;
  loadedAt: number | null;

  /** Keyed preloads (transactionType+city). */
  byKey: Record<FeedPreloadKey, PreloadEntry | undefined>;

  setPreloadedItems: (items: Property[]) => void;
  consumePreloadedItems: () => Property[] | null;

  setPreloadedItemsForKey: (key: FeedPreloadKey, items: Property[]) => void;
  consumePreloadedItemsForKey: (key: FeedPreloadKey) => Property[] | null;

  clear: () => void;
  clearKey: (key: FeedPreloadKey) => void;
};

export const useFeedPreloadStore = create<FeedPreloadState>((set, get) => ({
  preloadedItems: null,
  loadedAt: null,
  byKey: {},

  setPreloadedItems: (items) => set({ preloadedItems: items, loadedAt: Date.now() }),

  consumePreloadedItems: () => {
    const items = get().preloadedItems;
    set({ preloadedItems: null, loadedAt: null });
    return items;
  },

  setPreloadedItemsForKey: (key, items) =>
    set((state) => ({
      byKey: {
        ...state.byKey,
        [key]: { items, loadedAt: Date.now() },
      },
    })),

  consumePreloadedItemsForKey: (key) => {
    const entry = get().byKey[key];
    set((state) => {
      const next = { ...state.byKey };
      delete next[key];
      return { byKey: next };
    });
    return entry?.items ?? null;
  },

  clearKey: (key) =>
    set((state) => {
      const next = { ...state.byKey };
      delete next[key];
      return { byKey: next };
    }),

  clear: () => set({ preloadedItems: null, loadedAt: null, byKey: {} }),
}));
