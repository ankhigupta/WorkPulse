import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

const PENDING_ACCESS_REQUEST_KEY = "workpulse.pendingAccessRequest";

export interface PendingAccessRequest {
  requestId: string;
  statusToken: string;
  organizationName: string;
}

interface PendingAccessRequestState {
  loaded: boolean;
  data: PendingAccessRequest | null;
  /** Reads SecureStore into memory. Call before reading `data`. */
  load: () => Promise<void>;
  save: (request: PendingAccessRequest) => Promise<void>;
  clear: () => Promise<void>;
}

// A single pending-request slot, deliberately separate from authStore —
// this models an unauthenticated claim ticket (no User, no session), not
// an authentication session. SecureStore only, same as the refresh token,
// since statusToken is a bearer credential for a real (if narrow) API
// call. Never AsyncStorage. Submitting a new request overwrites this slot
// wholesale — no history is kept.
export const usePendingAccessRequestStore = create<PendingAccessRequestState>((set) => ({
  loaded: false,
  data: null,

  load: async () => {
    const raw = await SecureStore.getItemAsync(PENDING_ACCESS_REQUEST_KEY);
    set({ data: raw ? (JSON.parse(raw) as PendingAccessRequest) : null, loaded: true });
  },

  save: async (request) => {
    await SecureStore.setItemAsync(PENDING_ACCESS_REQUEST_KEY, JSON.stringify(request));
    set({ data: request, loaded: true });
  },

  clear: async () => {
    await SecureStore.deleteItemAsync(PENDING_ACCESS_REQUEST_KEY);
    set({ data: null, loaded: true });
  },
}));
