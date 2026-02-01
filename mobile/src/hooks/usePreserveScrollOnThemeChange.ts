import { useRef, useLayoutEffect, useCallback } from "react";
import { InteractionManager } from "react-native";
import type { NativeSyntheticEvent, NativeScrollEvent } from "react-native";

/**
 * Сохраняет позицию скролла при смене темы, чтобы экран не "прыгал" вверх.
 * Решает проблему сброса скролла при обновлении стилей (например, при переключении светлой/тёмной темы).
 */
export function usePreserveScrollOnThemeChange(themeMode: "light" | "dark") {
  const scrollOffsetY = useRef(0);
  const prevModeRef = useRef(themeMode);
  const scrollRef = useRef<any>(null);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsetY.current = e.nativeEvent.contentOffset.y;
  }, []);

  useLayoutEffect(() => {
    if (prevModeRef.current !== themeMode) {
      prevModeRef.current = themeMode;
      const savedY = scrollOffsetY.current;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const task = InteractionManager.runAfterInteractions(() => {
        timeoutId = setTimeout(() => {
          const ref = scrollRef.current;
          if (ref?.scrollTo) ref.scrollTo({ y: savedY, animated: false });
          else if (ref?.scrollToOffset) ref.scrollToOffset({ offset: savedY, animated: false });
        }, 80);
      });
      return () => {
        task.cancel();
        if (timeoutId) clearTimeout(timeoutId);
      };
    }
  }, [themeMode]);

  return {
    scrollRef,
    onScroll,
    scrollEventThrottle: 16 as const,
  };
}
