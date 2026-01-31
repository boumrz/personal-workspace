import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ApiClient, setAnalyticsAuthToken, track } from "@finance-assistant/shared";
import type { User } from "@finance-assistant/shared";

const TOKEN_KEY = "token";
const USER_KEY = "user";

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (login: string, password: string) => Promise<void>;
  register: (fullName: string, login: string, password: string) => Promise<void>;
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
  tokenRef.current = token;

  const api = useMemo(
    () =>
      new ApiClient({
        getToken: () => tokenRef.current,
      }),
    []
  );

  useEffect(() => {
    (async () => {
      try {
        const [storedToken, storedUser] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (loginValue: string, password: string) => {
    const res = await api.login({ login: loginValue, password });
    setToken(res.token);
    setUser(res.user);
    setAnalyticsAuthToken(res.token);
    await AsyncStorage.setItem(TOKEN_KEY, res.token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(res.user));
    track("login_success");
  };

  const register = async (fullName: string, loginValue: string, password: string) => {
    const res = await api.register({ fullName, login: loginValue, password });
    setToken(res.token);
    setUser(res.user);
    setAnalyticsAuthToken(res.token);
    await AsyncStorage.setItem(TOKEN_KEY, res.token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(res.user));
    track("register_success");
  };

  const logout = async () => {
    track("logout");
    setAnalyticsAuthToken(null);
    setToken(null);
    setUser(null);
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
  };

  const value: AuthContextType = useMemo(
    () => ({ user, token, login, register, logout, loading, api }),
    [user, token, loading, api]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
