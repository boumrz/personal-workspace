import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildVkRedirectUri,
  getVkIdAccessTokenCore,
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
