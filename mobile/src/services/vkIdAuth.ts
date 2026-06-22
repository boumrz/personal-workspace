import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { VK_ID_REDIRECT_SCHEME } from "../constants/config";

WebBrowser.maybeCompleteAuthSession();

const VK_AUTHORIZATION_ENDPOINT = "https://id.vk.ru/authorize";
const VK_TOKEN_ENDPOINT = "https://id.vk.ru/oauth2/auth";

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

function getVkRedirectUri(): string {
  return AuthSession.makeRedirectUri({
    scheme: VK_ID_REDIRECT_SCHEME,
    path: "vkid",
  });
}

async function exchangeVkCodeForToken({
  appId,
  code,
  codeVerifier,
  deviceId,
  redirectUri,
  state,
}: ExchangeVkCodeParams): Promise<string> {
  const query = new URLSearchParams({
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    client_id: appId,
    code_verifier: codeVerifier,
    state,
    device_id: deviceId,
  });

  const response = await fetch(`${VK_TOKEN_ENDPOINT}?${query.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code }).toString(),
  });
  const payload = (await response.json().catch(() => null)) as VkTokenResponse | null;

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
  const redirectUri = getVkRedirectUri();
  const request = new AuthSession.AuthRequest({
    clientId: appId,
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    scopes: ["email"],
    usePKCE: true,
    extraParams: { v: "2.3" },
  });

  const authUrl = await request.makeAuthUrlAsync({
    authorizationEndpoint: VK_AUTHORIZATION_ENDPOINT,
  });
  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

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
      return await nativeLogin();
    } catch (error) {
      if (!isVkCertificatePinningError(error)) {
        throw error;
      }
    }
  }

  return loginWithVkIdBrowser(appId);
}
