/**
 * API base URL for the backend.
 * Development: use your machine's IP or localhost (for emulator use 10.0.2.2:3001 for Android emulator).
 * Production: set to your deployed API URL, e.g. https://yourdomain.com/api
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001/api";
