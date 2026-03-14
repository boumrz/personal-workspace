/**
 * MyTracker SDK wrapper for mobile analytics.
 * Docs: https://docs.tracker.my.com/en/sdk/react-native/api
 */

import { MYTRACKER_SDK_KEY } from "../constants/config";

type MyTrackerModule = typeof import("@mytracker/react-native-mytracker").default;

let myTracker: MyTrackerModule | null = null;
let initialized = false;

try {
  const moduleRef = require("@mytracker/react-native-mytracker");
  myTracker = (moduleRef.default || moduleRef) as MyTrackerModule;
} catch {
  // Native module may be unavailable (e.g. Expo Go)
}

function isAvailable(): boolean {
  return Boolean(MYTRACKER_SDK_KEY && myTracker);
}

/**
 * Initialize MyTracker. Call once at app startup (e.g. in App.tsx).
 */
export function initMyTracker(): void {
  if (!MYTRACKER_SDK_KEY || !myTracker || initialized) return;
  try {
    myTracker.setDebugMode(__DEV__);
    myTracker.initTracker(MYTRACKER_SDK_KEY);
    initialized = true;
  } catch {
    // Ignore init errors (e.g. native not linked)
  }
}

/**
 * Set user id for attribution (call after login/register).
 */
export function setMyTrackerUserId(userId: string): void {
  if (!myTracker || !initialized) return;
  try {
    const params = myTracker.getTrackerParams();
    if (params && typeof params.setCustomUserIds === "function") {
      params.setCustomUserIds([userId]);
    }
  } catch {
    // no-op
  }
}

/**
 * Clear user id (call on logout).
 */
export function clearMyTrackerUserId(): void {
  if (!myTracker || !initialized) return;
  try {
    const params = myTracker.getTrackerParams();
    if (params && typeof params.setCustomUserIds === "function") {
      params.setCustomUserIds([]);
    }
  } catch {
    // no-op
  }
}

/**
 * Track custom event.
 */
export function trackMyTrackerEvent(
  name: string,
  eventParams?: Record<string, string>
): void {
  if (!myTracker || !initialized) return;
  try {
    if (eventParams && Object.keys(eventParams).length > 0) {
      myTracker.trackEvent(name, eventParams);
    } else {
      myTracker.trackEvent(name);
    }
  } catch {
    // no-op
  }
}

/**
 * Track registration. Call right after user registered.
 */
export function trackMyTrackerRegistration(userId: string): void {
  if (!myTracker || !initialized) return;
  try {
    setMyTrackerUserId(userId);
    myTracker.trackRegistrationEvent(userId);
  } catch {
    // no-op
  }
}

/**
 * Track login. Call right after user authorized.
 */
export function trackMyTrackerLogin(userId: string): void {
  if (!myTracker || !initialized) return;
  try {
    setMyTrackerUserId(userId);
    myTracker.trackLoginEvent(userId);
  } catch {
    // no-op
  }
}

/**
 * Flush events to server (e.g. before important navigation).
 */
export function flushMyTracker(): void {
  if (!myTracker || !initialized) return;
  try {
    myTracker.flush();
  } catch {
    // no-op
  }
}

export { isAvailable as isMyTrackerAvailable };
