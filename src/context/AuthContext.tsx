import React, { createContext, useContext, useState, useEffect } from "react";
import { getApiBaseUrl } from "../utils/apiConfig";
import { useLoginMutation, useRegisterMutation, User } from "../store/api";

export type { User };

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (login: string, password: string) => Promise<void>;
  register: (fullName: string, login: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
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

  useEffect(() => {
    // Check for stored token on mount
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
      const result = await loginMutation({ login: loginValue, password }).unwrap();
      setToken(result.token);
      setUser(result.user);
      localStorage.setItem("token", result.token);
      localStorage.setItem("user", JSON.stringify(result.user));
    } catch (error: any) {
      // Ошибка уже обработана в интерцепторе, но можем пробросить дальше
      throw new Error(error?.data?.error || error?.error || "Login failed");
    }
  };

  const register = async (fullName: string, loginValue: string, password: string) => {
    try {
      const result = await registerMutation({ fullName, login: loginValue, password }).unwrap();
      setToken(result.token);
      setUser(result.user);
      localStorage.setItem("token", result.token);
      localStorage.setItem("user", JSON.stringify(result.user));
    } catch (error: any) {
      // Ошибка уже обработана в интерцепторе, но можем пробросить дальше
      throw new Error(error?.data?.error || error?.error || "Registration failed");
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

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, loginWithGoogle, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
