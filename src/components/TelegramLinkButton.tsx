import React, { useState, useEffect, useCallback } from "react";
import { LoginButton } from "@telegram-auth/react";
import { getApiBaseUrl } from "../utils/apiConfig";

interface TelegramAuthData {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface TelegramLinkButtonProps {
  botUsername: string;
  onAuthCallback: (data: TelegramAuthData) => Promise<void>;
  loading?: boolean;
  className?: string;
  /** Текст кнопки на мобильных (десктоп использует виджет Telegram) */
  label?: string;
}

const WIDGET_SCRIPT = "https://telegram.org/js/telegram-widget.js?22";

function loadTelegramWidgetScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if ((window as any).Telegram?.Login?.auth) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${WIDGET_SCRIPT}"]`);
    if (existing) {
      if ((window as any).Telegram?.Login?.auth) {
        resolve();
      } else {
        existing.addEventListener("load", () => resolve());
      }
      return;
    }

    const script = document.createElement("script");
    script.src = WIDGET_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Telegram widget"));
    document.head.appendChild(script);
  });
}

async function getBotId(): Promise<string> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/auth/telegram/bot-id`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Telegram не настроен");
  }
  const data = await res.json();
  return data.bot_id;
}

function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Кнопка привязки Telegram.
 * На мобильных использует Telegram.Login.auth() (popup) вместо iframe —
 * iframe не получает touch-события на iOS/Android.
 */
export const TelegramLinkButton: React.FC<TelegramLinkButtonProps> = ({
  botUsername,
  onAuthCallback,
  loading = false,
  className = "",
  label = "Log in with Telegram",
}) => {
  const [useMobileFlow, setUseMobileFlow] = useState(false);
  const [mobileLoading, setMobileLoading] = useState(false);

  useEffect(() => {
    setUseMobileFlow(isMobile());
    const onResize = () => setUseMobileFlow(isMobile());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleMobileAuth = useCallback(async () => {
    if (loading || mobileLoading) return;
    setMobileLoading(true);
    try {
      await loadTelegramWidgetScript();
      const botId = await getBotId();
      const Telegram = (window as any).Telegram;
      if (!Telegram?.Login?.auth) {
        throw new Error("Telegram widget не загружен");
      }

      Telegram.Login.auth(
        { bot_id: botId, request_access: true },
        async (data: TelegramAuthData | false) => {
          setMobileLoading(false);
          if (data) {
            await onAuthCallback(data);
          }
        }
      );
    } catch (err) {
      setMobileLoading(false);
      throw err;
    }
  }, [onAuthCallback, loading, mobileLoading]);

  if (useMobileFlow) {
    return (
      <button
        type="button"
        className={className}
        onClick={handleMobileAuth}
        disabled={loading || mobileLoading}
        style={{
          width: "100%",
          minHeight: 44,
          padding: "10px 16px",
          borderRadius: 8,
          fontSize: 16,
          fontWeight: 500,
          border: "none",
          cursor: loading || mobileLoading ? "not-allowed" : "pointer",
          background: "#0088cc",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {loading || mobileLoading ? "Проверка..." : label}
      </button>
    );
  }

  return (
    <div
      className={className}
      style={{
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <LoginButton
        botUsername={botUsername}
        buttonSize="large"
        cornerRadius={8}
        showAvatar={false}
        onAuthCallback={onAuthCallback}
      />
    </div>
  );
};
