import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type AuthFlow = 'login' | 'register' | 'broker_update';

export type AuthTokens = {
  saqancomToken?: string | null;
  backofficeToken?: string | null;
  propertiesToken?: string | null;
};

export type AuthAgent = {
  id: number;
  name: string;
};

export type AuthSession = {
  tokens: AuthTokens;
  agent?: AuthAgent | null;
};

export interface AuthState {
  isAuthenticated: boolean;
  phoneNumber: string | null;

  /** Backend session details (tokens/agent) */
  session: AuthSession | null;

  pendingPhoneNumber: string | null;
  pendingFlow: AuthFlow | null;
  pendingMessage: string | null;
  pendingBrokerUpdate: {
    brokerNumber: string;
    emirate: string;
  } | null;

  setPendingAuth: (params: {
    phoneNumber: string;
    flow: AuthFlow;
    message?: string | null;
    brokerUpdate?: { brokerNumber: string; emirate: string } | null;
  }) => void;
  clearPendingAuth: () => void;
  setPendingMessage: (message: string | null) => void;

  setSession: (session: AuthSession | null) => void;

  /**
   * Mark user as authenticated.
   * Optionally accepts a session payload from OTP verify response.
   */
  completeOtpVerification: (session?: AuthSession | null) => void;

  logout: () => void;
}

const STORAGE_KEY = '@saqan_auth';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      phoneNumber: null,
      session: null,
      pendingPhoneNumber: null,
      pendingFlow: null,
      pendingMessage: null,
      pendingBrokerUpdate: null,

      setPendingAuth: ({ phoneNumber, flow, message, brokerUpdate }) => {
        const normalized = phoneNumber.replace(/\s+/g, '');
        set({
          pendingPhoneNumber: normalized,
          pendingFlow: flow,
          pendingMessage: message ?? null,
          pendingBrokerUpdate: brokerUpdate ?? null,
        });
      },

      clearPendingAuth: () =>
        set({
          pendingPhoneNumber: null,
          pendingFlow: null,
          pendingMessage: null,
          pendingBrokerUpdate: null,
        }),

      setPendingMessage: (message) => set({ pendingMessage: message }),

      setSession: (session) => set({ session }),

      completeOtpVerification: (session) => {
        const pending = get().pendingPhoneNumber;
        set({
          isAuthenticated: true,
          phoneNumber: pending ?? get().phoneNumber,
          session: session ?? get().session,
          pendingPhoneNumber: null,
          pendingFlow: null,
          pendingMessage: null,
          pendingBrokerUpdate: null,
        });
      },

      logout: () =>
        set({
          isAuthenticated: false,
          phoneNumber: null,
          session: null,
          pendingPhoneNumber: null,
          pendingFlow: null,
          pendingMessage: null,
          pendingBrokerUpdate: null,
        }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist what we need across app restarts.
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        phoneNumber: state.phoneNumber,
        session: state.session,
      }),
    }
  )
);
