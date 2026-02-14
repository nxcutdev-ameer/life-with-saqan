import { create } from 'zustand';
import type { Property } from '@/types';

type FeedPreloadState = {
  /** Items to use as the initial feed payload (e.g. loaded before navigation). */
  preloadedItems: Property[] | null;
  /** When these items were loaded (ms). */
  loadedAt: number | null;
  setPreloadedItems: (items: Property[]) => void;
  /** Consume and clear (one-shot) */
  consumePreloadedItems: () => Property[] | null;
  clear: () => void;
};

export const useFeedPreloadStore = create<FeedPreloadState>((set, get) => ({
  preloadedItems: null,
  loadedAt: null,
  setPreloadedItems: (items) => set({ preloadedItems: items, loadedAt: Date.now() }),
  consumePreloadedItems: () => {
    const items = get().preloadedItems;
    // Consume once so it doesn't override future refresh/pagination.
    set({ preloadedItems: null, loadedAt: null });
    return items;
  },
  clear: () => set({ preloadedItems: null, loadedAt: null }),
}));
