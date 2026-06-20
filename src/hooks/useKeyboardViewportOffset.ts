import { useEffect } from "react";

const MOBILE_VIEWPORT_WIDTH = 768;

export function useKeyboardViewportOffset(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof document === "undefined") {
      return undefined;
    }

    const root = document.documentElement;
    let animationFrame = 0;

    const applyViewportVariables = () => {
      const viewportWidth = window.innerWidth;
      const layoutHeight = window.innerHeight;
      const visualViewport = window.visualViewport;

      if (viewportWidth > MOBILE_VIEWPORT_WIDTH || !visualViewport) {
        root.style.setProperty("--app-viewport-height", `${layoutHeight}px`);
        root.style.setProperty("--keyboard-offset", "0px");
        return;
      }

      const visualHeight = Math.round(visualViewport.height);
      const keyboardOffset = Math.max(0, Math.round(layoutHeight - visualViewport.height - visualViewport.offsetTop));

      root.style.setProperty("--app-viewport-height", `${visualHeight}px`);
      root.style.setProperty("--keyboard-offset", `${keyboardOffset}px`);
    };

    const scheduleUpdate = () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      animationFrame = requestAnimationFrame(() => {
        animationFrame = 0;
        applyViewportVariables();
      });
    };

    applyViewportVariables();

    window.addEventListener("resize", scheduleUpdate);
    window.visualViewport?.addEventListener("resize", scheduleUpdate);
    window.visualViewport?.addEventListener("scroll", scheduleUpdate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      root.style.removeProperty("--app-viewport-height");
      root.style.removeProperty("--keyboard-offset");
      window.removeEventListener("resize", scheduleUpdate);
      window.visualViewport?.removeEventListener("resize", scheduleUpdate);
      window.visualViewport?.removeEventListener("scroll", scheduleUpdate);
    };
  }, [enabled]);
}
