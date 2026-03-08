import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ApiClient, setAnalyticsAuthToken, track, getAnalyticsPlatform } from "@finance-assistant/shared";
import { trackMyTrackerLogin, trackMyTrackerRegistration, clearMyTrackerUserId } from "../analytics";
import type { User } from "@finance-assistant/shared";

const TOKEN_KEY = "token";
const REFRESH_TOKEN_KEY = "refreshToken";
const USER_KEY = "user";

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (login: string, password: string) => Promise<void>;
  register: (login: string, password: string) => Promise<void>;
  loginWithVkId: (accessToken: string, appId?: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
  api: ApiClient;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const tokenRef = useRef<string | null>(null);
  const refreshTokenRef = useRef<string | null>(null);
  tokenRef.current = token;

  const logout = async () => {
    track("logout");
    clearMyTrackerUserId();
    setAnalyticsAuthToken(null);
    setToken(null);
    setUser(null);
    refreshTokenRef.current = null;
    await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY]);
  };
  const logoutRef = useRef(logout);
  logoutRef.current = logout;

  const api = useMemo(
    () =>
      new ApiClient({
        getToken: () => tokenRef.current,
        getRefreshToken: () => refreshTokenRef.current,
        onTokensRefreshed: (newToken, newRefreshToken, newUser) => {
          setToken(newToken);
          if (newRefreshToken) refreshTokenRef.current = newRefreshToken;
          if (newUser) setUser(newUser);
          setAnalyticsAuthToken(newToken);
          AsyncStorage.setItem(TOKEN_KEY, newToken);
          if (newRefreshToken) AsyncStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);
          if (newUser) AsyncStorage.setItem(USER_KEY, JSON.stringify(newUser));
        },
        onSessionExpired: () => {
          AsyncStorage.setItem("sessionExpired", "1").catch(() => {});
          void logoutRef.current?.();
        },
      }),
    []
  );

  useEffect(() => {
    let cancelled = false;
    const TIMEOUT_MS = 4000; // На части Android AsyncStorage может зависнуть — не блокируем экран дольше 4 сек

    const load = async () => {
      try {
        const [storedToken, storedRefreshToken, storedUser] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(REFRESH_TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);
        if (!cancelled && storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          if (storedRefreshToken) refreshTokenRef.current = storedRefreshToken;
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const t = setTimeout(() => {
      if (cancelled) return;
      setLoading(false);
    }, TIMEOUT_MS);

    load().finally(() => {
      clearTimeout(t);
    });

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  const login = async (loginValue: string, password: string) => {
    const res = await api.login({ login: loginValue, password, platform: getAnalyticsPlatform() });
    setToken(res.token);
    setUser(res.user);
    if (res.refreshToken) {
      refreshTokenRef.current = res.refreshToken;
      await AsyncStorage.setItem(REFRESH_TOKEN_KEY, res.refreshToken);
    }
    setAnalyticsAuthToken(res.token);
    await AsyncStorage.setItem(TOKEN_KEY, res.token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(res.user));
    track("login_success");
    trackMyTrackerLogin(String(res.user.id));
  };

  const register = async (loginValue: string, password: string) => {
    // Поле fullName временно заполняем логином, т.к. backend ожидает это поле при регистрации.
    const res = await api.register({ fullName: loginValue, login: loginValue, password });
    setToken(res.token);
    setUser(res.user);
    if (res.refreshToken) {
      refreshTokenRef.current = res.refreshToken;
      await AsyncStorage.setItem(REFRESH_TOKEN_KEY, res.refreshToken);
    }
    setAnalyticsAuthToken(res.token);
    await AsyncStorage.setItem(TOKEN_KEY, res.token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(res.user));
    track("register_success");
    trackMyTrackerRegistration(String(res.user.id));
  };

  const loginWithVkId = async (accessToken: string, appId?: string) => {
    const res = await api.loginWithVkId({
      access_token: accessToken,
      app_id: appId,
      platform: getAnalyticsPlatform(),
    });
    setToken(res.token);
    setUser(res.user);
    if (res.refreshToken) {
      refreshTokenRef.current = res.refreshToken;
      await AsyncStorage.setItem(REFRESH_TOKEN_KEY, res.refreshToken);
    }
    setAnalyticsAuthToken(res.token);
    await AsyncStorage.setItem(TOKEN_KEY, res.token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(res.user));
    track("login_vkid_success");
    trackMyTrackerLogin(String(res.user.id));
  };

  const value: AuthContextType = useMemo(
    () => ({ user, token, login, register, loginWithVkId, logout, loading, api }),
    [user, token, loading, api]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
