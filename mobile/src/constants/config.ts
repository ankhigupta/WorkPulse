import { Platform } from "react-native";

// EXPO_PUBLIC_-prefixed vars are inlined at build time by Expo — set one in
// mobile/.env (see .env.example) to point at a real backend instead of
// localhost. Never hardcode a production URL here.
const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL;

// Android emulators can't reach the host machine via "localhost" — 10.0.2.2
// is the documented alias back to it. Physical devices need EXPO_PUBLIC_API_URL
// set explicitly to the host machine's LAN IP; there's no way to guess that.
const defaultApiUrl =
  Platform.OS === "android" ? "http://10.0.2.2:8000/api" : "http://localhost:8000/api";

export const API_BASE_URL = configuredApiUrl ?? defaultApiUrl;
