/**
 * Static theme tokens for use in static StyleSheet.create()
 * For dynamic theming, use useTheme() from context
 */

export const theme = {
  // Фоны (светлая тема как на веб)
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

  // Тени (для StyleSheet — только цвет)
  shadowSm: "rgba(0, 0, 0, 0.06)",
  shadowMd: "rgba(0, 0, 0, 0.08)",
  shadowLg: "rgba(0, 0, 0, 0.12)",

  // Радиусы (как на веб)
  radiusXs: 6,
  radiusSm: 8,
  radiusMd: 10,
  radiusLg: 12,
  radiusXl: 14,
  radius2xl: 16,
  radius3xl: 20,

  // Высоты кнопок
  btnHeight: 44,
  inputHeight: 48,
} as const;

export type Theme = typeof theme;
