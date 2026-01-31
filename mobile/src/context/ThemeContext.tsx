import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemeMode = "light" | "dark";

// Theme tokens type (shared structure)
interface ThemeTokensType {
  bgBase: string;
  bgCard: string;
  bgSurface: string;
  bgElevated: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentHover: string;
  accentMuted: string;
  accentMutedHover: string;
  accentMutedLight: string;
  income: string;
  incomeLight: string;
  incomeMuted: string;
  incomeMutedDark: string;
  incomeMutedDarker: string;
  expense: string;
  expenseLight: string;
  warning: string;
  warningLight: string;
  purple: string;
  purpleLight: string;
  shadowSm: string;
  shadowMd: string;
  shadowLg: string;
  radiusXs: number;
  radiusSm: number;
  radiusMd: number;
  radiusLg: number;
  radiusXl: number;
  radius2xl: number;
  radius3xl: number;
  btnHeight: number;
  inputHeight: number;
}

// Light theme tokens
const lightTheme: ThemeTokensType = {
  // Фоны
  bgBase: "#e8e8ed",
  bgCard: "#f2f2f6",
  bgSurface: "#dedee3",
  bgElevated: "#ececf0",

  // Текст
  textPrimary: "#2c2c2e",
  textSecondary: "#6c6c70",
  textTertiary: "#8e8e93",

  // Границы
  border: "#dcdce1",
  borderStrong: "#ceced3",

  // Акценты
  accent: "#0a84ff",
  accentHover: "#409cff",
  accentMuted: "#4a9ed6",
  accentMutedHover: "#6ab0de",
  accentMutedLight: "rgba(74, 158, 214, 0.12)",

  // Доходы / расходы
  income: "#34c759",
  incomeLight: "rgba(52, 199, 89, 0.12)",
  incomeMuted: "#5bb87a",
  incomeMutedDark: "#4ba872",
  incomeMutedDarker: "#3d8f5a",
  expense: "#d96560",
  expenseLight: "rgba(217, 101, 96, 0.12)",
  warning: "#ff9500",
  warningLight: "rgba(255, 149, 0, 0.12)",
  purple: "#af52de",
  purpleLight: "rgba(175, 82, 222, 0.12)",

  // Тени
  shadowSm: "rgba(0, 0, 0, 0.06)",
  shadowMd: "rgba(0, 0, 0, 0.08)",
  shadowLg: "rgba(0, 0, 0, 0.12)",

  // Радиусы
  radiusXs: 6,
  radiusSm: 8,
  radiusMd: 10,
  radiusLg: 12,
  radiusXl: 14,
  radius2xl: 16,
  radius3xl: 20,

  // Высоты
  btnHeight: 44,
  inputHeight: 48,
} as const;

// Dark theme tokens
const darkTheme: ThemeTokensType = {
  // Фоны
  bgBase: "#000000",
  bgCard: "#1c1c1e",
  bgSurface: "#2c2c2e",
  bgElevated: "#3a3a3c",

  // Текст
  textPrimary: "#f2f2f6",
  textSecondary: "#aeaeb2",
  textTertiary: "#8e8e93",

  // Границы
  border: "#38383a",
  borderStrong: "#48484a",

  // Акценты
  accent: "#0a84ff",
  accentHover: "#409cff",
  accentMuted: "#4a9ed6",
  accentMutedHover: "#6ab0de",
  accentMutedLight: "rgba(74, 158, 214, 0.18)",

  // Доходы / расходы
  income: "#30d158",
  incomeLight: "rgba(48, 209, 88, 0.18)",
  incomeMuted: "#5bb87a",
  incomeMutedDark: "#4ba872",
  incomeMutedDarker: "#3d8f5a",
  expense: "#ff6b6b",
  expenseLight: "rgba(255, 107, 107, 0.18)",
  warning: "#ff9f0a",
  warningLight: "rgba(255, 159, 10, 0.18)",
  purple: "#bf5af2",
  purpleLight: "rgba(191, 90, 242, 0.18)",

  // Тени
  shadowSm: "rgba(0, 0, 0, 0.3)",
  shadowMd: "rgba(0, 0, 0, 0.4)",
  shadowLg: "rgba(0, 0, 0, 0.5)",

  // Радиусы (same as light)
  radiusXs: 6,
  radiusSm: 8,
  radiusMd: 10,
  radiusLg: 12,
  radiusXl: 14,
  radius2xl: 16,
  radius3xl: 20,

  // Высоты
  btnHeight: 44,
  inputHeight: 48,
} as const;

export type ThemeTokens = ThemeTokensType;

interface ThemeContextType {
  mode: ThemeMode;
  theme: ThemeTokens;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "@theme_mode";

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("light");
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved theme on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (stored === "light" || stored === "dark") {
          setModeState(stored);
        } else if (systemColorScheme) {
          setModeState(systemColorScheme);
        }
      } catch {
        // Use default
      } finally {
        setIsLoaded(true);
      }
    };
    loadTheme();
  }, [systemColorScheme]);

  const setMode = useCallback(async (newMode: ThemeMode) => {
    setModeState(newMode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setMode(mode === "light" ? "dark" : "light");
  }, [mode, setMode]);

  const theme = useMemo(() => (mode === "dark" ? darkTheme : lightTheme), [mode]);
  const isDark = mode === "dark";

  const value = useMemo(
    () => ({ mode, theme, setMode, toggleTheme, isDark }),
    [mode, theme, setMode, toggleTheme, isDark]
  );

  if (!isLoaded) {
    return null; // or a loading indicator
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

// Export static themes for screens that need them during StyleSheet creation
export const themes = { light: lightTheme, dark: darkTheme };
