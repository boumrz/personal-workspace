import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
WebBrowser.maybeCompleteAuthSession();

const VK_AUTHORIZATION_ENDPOINT = "https://id.vk.ru/authorize";
const VK_TOKEN_ENDPOINT = "https://id.vk.ru/oauth2/auth";
const VK_AUTH_SESSION_TIMEOUT_MS = 60000;
const VK_TOKEN_EXCHANGE_TIMEOUT_MS = 20000;

type NativeVkLogin = (() => Promise<string>) | undefined;

interface GetVkIdAccessTokenParams {
  appId: string;
  nativeLogin?: NativeVkLogin;
}

interface ExchangeVkCodeParams {
  appId: string;
  code: string;
  codeVerifier: string;
  deviceId: string;
  redirectUri: string;
  state: string;
}

interface VkTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

export function isVkCertificatePinningError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  return /certificate pinning|pinning failure/i.test(message);
}

function readUrlParam(url: string, key: string): string | null {
  const query = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
  const params = new URLSearchParams(query.split("#")[0]);
  return params.get(key);
}

function getVkRedirectUri(appId: string): string {
  return `vk${appId}://vk.ru/blank.html`;
}

async function exchangeVkCodeForToken({
  appId,
  code,
  codeVerifier,
  deviceId,
  redirectUri,
  state,
}: ExchangeVkCodeParams): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VK_TOKEN_EXCHANGE_TIMEOUT_MS);
  const query = new URLSearchParams({
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    client_id: appId,
    code_verifier: codeVerifier,
    state,
    device_id: deviceId,
  });

  let response: Response;
  let payload: VkTokenResponse | null;
  try {
    response = await fetch(`${VK_TOKEN_ENDPOINT}?${query.toString()}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: controller.signal,
      body: new URLSearchParams({ code }).toString(),
    });
    payload = (await response.json().catch(() => null)) as VkTokenResponse | null;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("VK ID не ответил при обмене кода на токен. Попробуйте ещё раз.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (response.ok && payload?.access_token) {
    return payload.access_token;
  }

  throw new Error(
    payload?.error_description ||
      payload?.error ||
      `VK ID token exchange failed: HTTP ${response.status}`,
  );
}

async function loginWithVkIdBrowser(appId: string): Promise<string> {
  const redirectUri = getVkRedirectUri(appId);
  const request = new AuthSession.AuthRequest({
    clientId: appId,
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    scopes: ["email"],
    usePKCE: true,
    extraParams: { v: "2.3", prompt: "login" },
  });

  const authUrl = await request.makeAuthUrlAsync({
    authorizationEndpoint: VK_AUTHORIZATION_ENDPOINT,
  });
  const result = await withTimeout(
    WebBrowser.openAuthSessionAsync(authUrl, redirectUri),
    VK_AUTH_SESSION_TIMEOUT_MS,
    `VK ID не вернул управление в приложение. Проверьте redirect URI ${redirectUri} в настройках VK ID.`,
  );

  if (result.type !== "success") {
    throw new Error(
      result.type === "cancel" ? "Авторизация VK ID отменена" : "Не удалось открыть VK ID",
    );
  }

  const error = readUrlParam(result.url, "error");
  if (error) {
    throw new Error(readUrlParam(result.url, "error_description") || error);
  }

  const code = readUrlParam(result.url, "code");
  const deviceId = readUrlParam(result.url, "device_id");
  if (!code || !deviceId || !request.codeVerifier) {
    throw new Error("VK ID не вернул данные для обмена токена");
  }

  return exchangeVkCodeForToken({
    appId,
    code,
    codeVerifier: request.codeVerifier,
    deviceId,
    redirectUri,
    state: request.state,
  });
}

export async function getVkIdAccessToken({
  appId,
  nativeLogin,
}: GetVkIdAccessTokenParams): Promise<string> {
  if (nativeLogin) {
    try {
      return await withTimeout(
        nativeLogin(),
        VK_AUTH_SESSION_TIMEOUT_MS,
        "VK ID не вернул управление в приложение. Попробуйте ещё раз.",
      );
    } catch (error) {
      if (!isVkCertificatePinningError(error)) {
        throw error;
      }
    }
  }

  return loginWithVkIdBrowser(appId);
}
