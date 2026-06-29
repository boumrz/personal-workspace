export type NativeVkLogin = (() => Promise<string>) | undefined;
export type BrowserVkLogin = (appId: string) => Promise<string>;
export type AuthSessionCleanupReason = "before_start" | "after_failure";
export type AuthSessionCleanup = (
  reason: AuthSessionCleanupReason,
) => void | Promise<void>;

type Logger = (event: string, payload?: Record<string, unknown>) => void;

export interface GetVkIdAccessTokenCoreParams {
  appId: string;
  nativeLogin?: NativeVkLogin;
  browserLogin: BrowserVkLogin;
  nativeTimeoutMs: number;
  logger?: Logger;
}

export function buildVkRedirectUri(scheme: string) {
  const normalized = String(scheme || "").trim().replace(/:$/, "");
  return `${normalized || "financeassistant"}://vkid`;
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function getErrorCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code?: unknown }).code || "");
  }
  return "";
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message || "");
  }
  return "";
}

export function isVkCertificatePinningError(error: unknown): boolean {
  return /certificate pinning|pinning failure/i.test(getErrorMessage(error));
}

export function isVkUserCancellationError(error: unknown): boolean {
  const text = `${getErrorCode(error)} ${getErrorMessage(error)}`;
  return /cancel|cancelled|canceled|user denied|user rejected|authorization denied/i.test(text);
}

export function isRecoverableNativeVkError(error: unknown): boolean {
  if (isVkUserCancellationError(error)) {
    return false;
  }

  const text = `${getErrorCode(error)} ${getErrorMessage(error)}`;
  return (
    isVkCertificatePinningError(error) ||
    /timeout|timed out|did not return control|already in progress|already open|only one can be open|auth session is in an invalid state|VKID_AUTH_CODE_UNEXPECTED|VKID_AUTH_FAILED|VKID_EXCEPTION|VKID_NO_ACTIVITY|VKID_NO_LIFECYCLE|VKID_EMPTY_TOKEN|token exchange/i.test(text)
  );
}

async function cleanupAuthSession(
  cleanupSession: AuthSessionCleanup | undefined,
  reason: AuthSessionCleanupReason,
): Promise<void> {
  try {
    await cleanupSession?.(reason);
  } catch {
    // Cleanup is best-effort: failing to dismiss a stale browser must not block a new login attempt.
  }
}

export async function runAuthSessionWithCleanup<T>({
  openSession,
  timeoutMs,
  timeoutMessage,
  cleanupSession,
}: {
  openSession: () => Promise<T>;
  timeoutMs: number;
  timeoutMessage: string;
  cleanupSession?: AuthSessionCleanup;
}): Promise<T> {
  await cleanupAuthSession(cleanupSession, "before_start");

  try {
    return await withTimeout(openSession(), timeoutMs, timeoutMessage);
  } catch (error) {
    await cleanupAuthSession(cleanupSession, "after_failure");
    throw error;
  }
}

export async function getVkIdAccessTokenCore({
  appId,
  nativeLogin,
  browserLogin,
  nativeTimeoutMs,
  logger,
}: GetVkIdAccessTokenCoreParams): Promise<string> {
  if (nativeLogin) {
    try {
      const token = await withTimeout(
        nativeLogin(),
        nativeTimeoutMs,
        "VK ID did not return control to the app. Falling back to browser authorization."
      );
      if (String(token || "").trim()) {
        return token;
      }
      throw Object.assign(new Error("VK ID native authorization returned an empty token."), {
        code: "VKID_EMPTY_TOKEN",
      });
    } catch (error) {
      if (!isRecoverableNativeVkError(error)) {
        throw error;
      }

      logger?.("vkid_native_fallback", {
        code: getErrorCode(error) || undefined,
        message: getErrorMessage(error) || undefined,
      });
    }
  }

  return browserLogin(appId);
}
