import React, { useCallback } from "react";
import * as VKID from "@vkid/sdk";

interface VKIdWidgetProps {
  appId: string;
  onSuccess: (accessToken: string) => Promise<void>;
  onError?: (error: Error) => void;
  redirectUrl?: string;
  loading?: boolean;
  /** Текст кнопки (по умолчанию "Войти через VK ID") */
  label?: string;
}

function generateCodeVerifier(): string {
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 128);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export const VKIdWidget: React.FC<VKIdWidgetProps> = ({
  appId,
  onSuccess,
  onError,
  redirectUrl,
  loading = false,
  label = "Войти через VK ID",
}) => {
  const redirect = redirectUrl || (typeof window !== "undefined" ? `${window.location.origin}/vk-id-callback.html` : "");

  const handleClick = useCallback(async () => {
    if (!appId) return;

    const state = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const authUrl = `https://id.vk.ru/authorize?client_id=${appId}&redirect_uri=${encodeURIComponent(redirect)}&response_type=code&scope=email&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256&v=2.3`;

    const popup = window.open(authUrl, "VK ID", `width=${width},height=${height},left=${left},top=${top}`);

    if (!popup) {
      onError?.(new Error("Всплывающее окно заблокировано"));
      return;
    }

    const messageHandler = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data?.payload) return;

      if (data.payload.error) {
        window.removeEventListener("message", messageHandler);
        onError?.(new Error(data.payload.error?.error_description || data.payload.error?.error || "Ошибка VK ID"));
        popup.close();
        return;
      }

      const { code, device_id: deviceId } = data.payload;
      if (code && deviceId) {
        window.removeEventListener("message", messageHandler);
        popup.close();

        try {
          VKID.Config.init({
            app: Number(appId),
            redirectUrl: redirect,
            state,
            codeVerifier,
            scope: "email",
          });
          const expires = new Date(Date.now() + 15 * 60 * 1000).toUTCString();
          const secure = window.location.protocol === "https:" ? "; Secure" : "";
          document.cookie = `vkid_sdk:codeVerifier=${encodeURIComponent(codeVerifier)}; expires=${expires}; path=/; SameSite=Strict${secure}`;
          document.cookie = `vkid_sdk:state=${encodeURIComponent(state)}; expires=${expires}; path=/; SameSite=Strict${secure}`;
          const tokens = await VKID.Auth.exchangeCode(code, deviceId);
          const token = (tokens as { access_token?: string })?.access_token;
          if (token) {
            await onSuccess(token);
          } else {
            onError?.(new Error("Не удалось получить токен"));
          }
        } catch (err) {
          onError?.(err instanceof Error ? err : new Error(String(err)));
        }
      }
    };

    window.addEventListener("message", messageHandler);

    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        window.removeEventListener("message", messageHandler);
      }
    }, 500);
  }, [appId, redirect, onSuccess, onError]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="vk-id-button"
      style={{
        width: "100%",
        height: 44,
        borderRadius: 8,
        fontSize: 16,
        fontWeight: 500,
        border: "none",
        cursor: loading ? "not-allowed" : "pointer",
        background: "#0077ff",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      {loading ? "Проверка..." : label}
    </button>
  );
};
