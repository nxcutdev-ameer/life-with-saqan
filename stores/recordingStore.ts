import { create } from 'zustand';

type RecordingState = {
  recordedVideoUri: string | null;
  setRecordedVideoUri: (uri: string | null) => void;
  consumeRecordedVideoUri: () => string | null;
};

/**
 * Simple cross-screen handoff for the in-app recorder.
 * We avoid passing long URIs through params and keep navigation simple.
 */
export const useRecordingStore = create<RecordingState>((set, get) => ({
  recordedVideoUri: null,
  setRecordedVideoUri: (uri) => set({ recordedVideoUri: uri }),
  consumeRecordedVideoUri: () => {
    const uri = get().recordedVideoUri;
    set({ recordedVideoUri: null });
    return uri;
  },
}));
