import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildVkRedirectUri,
  getVkIdAccessTokenCore,
  runAuthSessionWithCleanup,
  isVkUserCancellationError,
} from "./vkIdAuthCore.ts";

test("uses native VK ID token when native flow succeeds", async () => {
  const token = await getVkIdAccessTokenCore({
    appId: "54468830",
    nativeTimeoutMs: 50,
    nativeLogin: async () => "native-token",
    browserLogin: async () => {
      throw new Error("browser fallback should not be used");
    },
  });

  assert.equal(token, "native-token");
});

test("falls back to browser VK ID when native flow returns code-only error", async () => {
  const events: string[] = [];
  const token = await getVkIdAccessTokenCore({
    appId: "54468830",
    nativeTimeoutMs: 50,
    nativeLogin: async () => {
      throw Object.assign(new Error("SDK returned code only"), {
        code: "VKID_AUTH_CODE_UNEXPECTED",
      });
    },
    browserLogin: async (appId) => `browser-token-${appId}`,
    logger: (event) => events.push(event),
  });

  assert.equal(token, "browser-token-54468830");
  assert.deepEqual(events, ["vkid_native_fallback"]);
});

test("falls back to browser VK ID when native flow times out", async () => {
  const token = await getVkIdAccessTokenCore({
    appId: "54468830",
    nativeTimeoutMs: 5,
    nativeLogin: () => new Promise(() => {}),
    browserLogin: async () => "browser-token",
  });

  assert.equal(token, "browser-token");
});

test("falls back to browser VK ID when native flow reports in-progress authorization", async () => {
  const token = await getVkIdAccessTokenCore({
    appId: "54468830",
    nativeTimeoutMs: 50,
    nativeLogin: async () => {
      throw new Error("VK ID authorization is already in progress");
    },
    browserLogin: async () => "browser-token-after-stale-native-session",
  });

  assert.equal(token, "browser-token-after-stale-native-session");
});

test("does not restart VK ID when user cancels native authorization", async () => {
  await assert.rejects(
    () =>
      getVkIdAccessTokenCore({
        appId: "54468830",
        nativeTimeoutMs: 50,
        nativeLogin: async () => {
          throw Object.assign(new Error("Authorization canceled"), {
            code: "VKID_AUTH_CANCELED",
          });
        },
        browserLogin: async () => {
          throw new Error("browser fallback should not be used");
        },
      }),
    /Authorization canceled/
  );
});

test("builds browser fallback redirect on the app-owned scheme", () => {
  assert.equal(buildVkRedirectUri("financeassistant"), "financeassistant://vkid");
  assert.equal(isVkUserCancellationError(Object.assign(new Error("User cancelled"), { code: "VKID_AUTH_FAILED" })), true);
});

test("cleans up a stale browser VK ID auth session before starting and after timeout", async () => {
  const cleanupEvents: string[] = [];

  await assert.rejects(
    () =>
      runAuthSessionWithCleanup({
        timeoutMs: 5,
        timeoutMessage: "VK ID browser auth timed out",
        cleanupSession: async (reason) => {
          cleanupEvents.push(reason);
        },
        openSession: () => new Promise(() => {}),
      }),
    /VK ID browser auth timed out/
  );

  assert.deepEqual(cleanupEvents, ["before_start", "after_failure"]);
});

test("cleans up a stale browser VK ID auth session when Expo refuses another session", async () => {
  const cleanupEvents: string[] = [];

  await assert.rejects(
    () =>
      runAuthSessionWithCleanup({
        timeoutMs: 50,
        timeoutMessage: "VK ID browser auth timed out",
        cleanupSession: async (reason) => {
          cleanupEvents.push(reason);
        },
        openSession: async () => {
          throw new Error("WebBrowser is already open, only one can be open at a time");
        },
      }),
    /WebBrowser is already open/
  );

  assert.deepEqual(cleanupEvents, ["before_start", "after_failure"]);
});

test("ignores browser auth cleanup errors before opening a fresh VK ID session", async () => {
  const result = await runAuthSessionWithCleanup({
    timeoutMs: 50,
    timeoutMessage: "VK ID browser auth timed out",
    cleanupSession: async () => {
      throw new Error("No browser session to dismiss");
    },
    openSession: async () => ({ type: "success", url: "financeassistant://vkid?code=abc" }),
  });

  assert.deepEqual(result, { type: "success", url: "financeassistant://vkid?code=abc" });
});
