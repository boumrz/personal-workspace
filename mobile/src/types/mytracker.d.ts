declare module "@mytracker/react-native-mytracker" {
  interface TrackerParams {
    setCustomUserIds(ids: string[]): void;
  }

  interface MyTrackerModule {
    setDebugMode(enabled: boolean): void;
    initTracker(key: string): void;
    getTrackerParams(): TrackerParams | null;
    trackEvent(name: string, params?: Record<string, string>): void;
    trackRegistrationEvent(userId: string): void;
    trackLoginEvent(userId: string): void;
    flush(): void;
  }

  const myTracker: MyTrackerModule;
  export default myTracker;
}

