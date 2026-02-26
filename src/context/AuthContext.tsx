import React, { createContext, useContext, useState, useEffect } from "react";
import { getApiBaseUrl } from "../utils/apiConfig";
import { useLoginMutation, useRegisterMutation, useLoginWithTelegramMutation, useLoginWithVkIdMutation, User, api } from "../store/api";
import { store } from "../store";

export type { User };

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (login: string, password: string) => Promise<void>;
  register: (login: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithVkId: (accessToken: string) => Promise<void>;
  loginWithTelegram: (telegramData: {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    auth_date: number;
    hash: string;
  }) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthContext");
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginMutation] = useLoginMutation();
  const [registerMutation] = useRegisterMutation();
  const [loginWithTelegramMutation] = useLoginWithTelegramMutation();
  const [loginWithVkIdMutation] = useLoginWithVkIdMutation();

  useEffect(() => {
    // Check for stored token on mount (refreshToken хранится в api/store для refresh)
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (loginValue: string, password: string) => {
    try {
      // Очищаем кэш RTK Query перед входом, чтобы получить свежие данные нового пользователя
      store.dispatch(api.util.resetApiState());
      
      const result = await loginMutation({ login: loginValue, password }).unwrap();
      setToken(result.token);
      setUser(result.user);
      localStorage.setItem("token", result.token);
      localStorage.setItem("user", JSON.stringify(result.user));
      if (result.refreshToken) {
        localStorage.setItem("refreshToken", result.refreshToken);
      }
    } catch (error: any) {
      // Ошибка уже обработана в интерцепторе, но можем пробросить дальше
      throw new Error(error?.data?.error || error?.error || "Login failed");
    }
  };

  const register = async (loginValue: string, password: string) => {
    try {
      // Очищаем кэш RTK Query перед регистрацией
      store.dispatch(api.util.resetApiState());
      
      const result = await registerMutation({ login: loginValue, password }).unwrap();
      setToken(result.token);
      setUser(result.user);
      localStorage.setItem("token", result.token);
      localStorage.setItem("user", JSON.stringify(result.user));
      if (result.refreshToken) {
        localStorage.setItem("refreshToken", result.refreshToken);
      }
    } catch (error: any) {
      // Ошибка уже обработана в интерцепторе, но можем пробросить дальше
      throw new Error(error?.data?.error || error?.error || "Registration failed");
    }
  };

  const loginWithTelegram = async (telegramData: {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    auth_date: number;
    hash: string;
  }) => {
    store.dispatch(api.util.resetApiState());
    const result = await loginWithTelegramMutation(telegramData).unwrap();
    setToken(result.token);
    setUser(result.user);
    localStorage.setItem("token", result.token);
    localStorage.setItem("user", JSON.stringify(result.user));
    if (result.refreshToken) {
      localStorage.setItem("refreshToken", result.refreshToken);
    }
  };

  const loginWithGoogle = async () => {
    // OAuth 2.0 flow через Google
    const apiBaseUrl = getApiBaseUrl();
    
    // Открываем popup для авторизации Google
    // Не используем fetch, так как это редирект на Google
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const popup = window.open(
      `${apiBaseUrl}/auth/google`,
      "Google Login",
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
    );

    if (!popup) {
      throw new Error("Popup blocked. Please allow popups for this site.");
    }

    // Ждем сообщение от popup с токеном
    return new Promise<void>((resolve, reject) => {
      const messageListener = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) {
          return;
        }

        if (event.data.type === "GOOGLE_AUTH_SUCCESS") {
          const { token, user } = event.data;
          
          // Очищаем кэш RTK Query перед входом через Google
          store.dispatch(api.util.resetApiState());
          
          setToken(token);
          setUser(user);
          localStorage.setItem("token", token);
          localStorage.setItem("user", JSON.stringify(user));
          window.removeEventListener("message", messageListener);
          popup.close();
          resolve();
        } else if (event.data.type === "GOOGLE_AUTH_ERROR") {
          window.removeEventListener("message", messageListener);
          popup.close();
          reject(new Error(event.data.error || "Google authentication failed"));
        }
      };

      window.addEventListener("message", messageListener);

      // Проверяем, не закрыл ли пользователь popup
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener("message", messageListener);
          reject(new Error("Authentication cancelled"));
        }
      }, 1000);
    });
  };

  const loginWithVkId = async (accessToken: string) => {
    store.dispatch(api.util.resetApiState());
    const result = await loginWithVkIdMutation({ access_token: accessToken }).unwrap();
    setToken(result.token);
    setUser(result.user);
    localStorage.setItem("token", result.token);
    localStorage.setItem("user", JSON.stringify(result.user));
    if (result.refreshToken) {
      localStorage.setItem("refreshToken", result.refreshToken);
    }
  };

  const logout = () => {
    // Очищаем кэш RTK Query при выходе, чтобы данные не остались от предыдущего пользователя
    store.dispatch(api.util.resetApiState());
    
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("refreshToken");
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, loginWithGoogle, loginWithVkId, loginWithTelegram, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
