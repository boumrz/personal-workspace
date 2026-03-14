import { test, expect, type Page } from "@playwright/test";

type TransactionPayload = {
  type: "income" | "expense";
  amount: number;
  description: string;
  category: { id: string; name: string; color: string; icon: string };
  date: string;
};

type ApiState = {
  categories: Array<{ id: string; name: string; color: string; icon: string }>;
  transactions: TransactionPayload[];
  plannedExpenses: unknown[];
  savings: unknown[];
  parseResponse: {
    items: Array<{
      type: "income" | "expense";
      amount: number;
      description: string;
      categoryHint?: string;
      categoryResolution?: "matched_existing" | "suggest_create" | "unknown";
      suggestedCategoryToCreate?: string;
      date?: string;
      confidence?: number;
    }>;
    confidence: number;
    warnings: string[];
    unparsedText?: string;
  };
  createdCategories: Array<{ id: string; name: string; color: string; icon: string }>;
  createdTransactions: TransactionPayload[];
  parseCalls: number;
};

function buildDefaultState(): ApiState {
  return {
    categories: [
      { id: "1", name: "Food", color: "#4a9ed6", icon: "Utensils" },
      { id: "2", name: "Transport", color: "#5fb972", icon: "Car" },
    ],
    transactions: [],
    plannedExpenses: [],
    savings: [],
    parseResponse: {
      items: [
        {
          type: "expense",
          amount: 450,
          description: "Coffee",
          categoryHint: "Food",
          categoryResolution: "matched_existing",
        },
      ],
      confidence: 0.93,
      warnings: [],
      unparsedText: "",
    },
    createdCategories: [],
    createdTransactions: [],
    parseCalls: 0,
  };
}

async function setupAuthStorage(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("token", "e2e-token");
    window.localStorage.setItem("refreshToken", "e2e-refresh-token");
    window.localStorage.setItem(
      "user",
      JSON.stringify({ id: 42, login: "e2e-user", name: "E2E User" })
    );
  });
}

async function setupSpeechRecognitionMock(page: Page, transcript: string) {
  await page.addInitScript((mockTranscript) => {
    class FakeSpeechRecognition {
      lang = "ru-RU";
      interimResults = true;
      continuous = false;
      maxAlternatives = 1;
      onstart;
      onresult;
      onerror;
      onend;
      stopped = false;

      start() {
        this.stopped = false;
        setTimeout(() => {
          if (this.stopped) return;
          this.onstart?.();
        }, 0);

        setTimeout(() => {
          if (this.stopped) return;

          const entry = [{ transcript: mockTranscript }];
          // @ts-expect-error runtime shape from Web Speech API
          entry.isFinal = true;
          const results = [entry];

          this.onresult?.({
            resultIndex: 0,
            results,
          });
        }, 15);

        setTimeout(() => {
          if (this.stopped) return;
          this.onend?.();
        }, 30);
      }

      stop() {
        this.stopped = true;
        this.onend?.();
      }

      abort() {
        this.stopped = true;
        this.onend?.();
      }
    }

    Object.defineProperty(window, "SpeechRecognition", {
      configurable: true,
      writable: true,
      value: FakeSpeechRecognition,
    });

    Object.defineProperty(window, "webkitSpeechRecognition", {
      configurable: true,
      writable: true,
      value: FakeSpeechRecognition,
    });

    if (!navigator.mediaDevices) {
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {},
      });
    }

    navigator.mediaDevices.getUserMedia = async () => ({
      getTracks: () => [{ stop: () => {} }],
    });
  }, transcript);
}

async function setupApiMocks(page: Page, state: ApiState) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (method === "GET" && path === "/api/categories") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(state.categories) });
    }

    if (method === "GET" && path === "/api/transactions") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(state.transactions) });
    }

    if (method === "GET" && path === "/api/planned-expenses") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(state.plannedExpenses) });
    }

    if (method === "GET" && path === "/api/savings") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(state.savings) });
    }

    if (method === "POST" && path === "/api/v2/transactions/parse") {
      state.parseCalls += 1;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(state.parseResponse) });
    }

    if (method === "POST" && path === "/api/categories") {
      const payload = request.postDataJSON() as { name: string; color: string; icon: string };
      const created = {
        id: String(100 + state.createdCategories.length + 1),
        name: payload.name,
        color: payload.color,
        icon: payload.icon,
      };
      state.createdCategories.push(created);
      state.categories.push(created);

      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(created) });
    }

    if (method === "POST" && path === "/api/transactions") {
      const payload = request.postDataJSON() as TransactionPayload;
      state.createdTransactions.push(payload);
      state.transactions.push(payload);

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: String(200 + state.createdTransactions.length), ...payload }),
      });
    }

    if (method === "POST" && path === "/api/auth/refresh") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ token: "e2e-token", refreshToken: "e2e-refresh-token", user: { id: 42, login: "e2e-user" } }),
      });
    }

    if (method === "GET" && path === "/api/health") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok" }) });
    }

    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: `No mock for ${method} ${path}` }),
    });
  });
}

async function openVoiceModal(page: Page) {
  const voiceButton = page.locator("button:has(.anticon-audio)").first();
  await expect(voiceButton).toBeVisible();
  await voiceButton.click();
  await expect(page.locator(".ant-modal:visible")).toHaveCount(1);
}

async function clickPrimaryModalAction(page: Page) {
  const actionButtons = page.locator(".ant-modal .ant-modal-body button[type='button']");
  await expect(actionButtons).toHaveCount(2);
  await actionButtons.nth(1).click();
}

test("voice assistant parses speech and saves transaction with existing category", async ({ page }) => {
  const state = buildDefaultState();

  await setupAuthStorage(page);
  await setupSpeechRecognitionMock(page, "spent 450 on food");
  await setupApiMocks(page, state);

  await page.goto("/finance/transactions");
  await expect(page).toHaveURL(/\/finance\/transactions/);

  await openVoiceModal(page);
  await clickPrimaryModalAction(page);

  await expect.poll(() => state.parseCalls).toBe(1);
  await expect(page.locator(".ant-modal .ant-modal-body")).toContainText("450");
  await clickPrimaryModalAction(page);

  await expect.poll(() => state.createdTransactions.length).toBe(1);
  expect(state.createdTransactions[0].amount).toBe(450);
});

test("voice assistant creates missing category suggestion before saving", async ({ page }) => {
  const state = buildDefaultState();
  state.parseResponse = {
    items: [
      {
        type: "expense",
        amount: 320,
        description: "Coffee to go",
        categoryHint: "Coffee Shops",
        categoryResolution: "suggest_create",
        suggestedCategoryToCreate: "Coffee Shops",
      },
    ],
    confidence: 0.87,
    warnings: ["Category was not matched; create suggestion provided."],
    unparsedText: "",
  };

  await setupAuthStorage(page);
  await setupSpeechRecognitionMock(page, "spent 320 on coffee");
  await setupApiMocks(page, state);

  await page.goto("/finance/transactions");
  await openVoiceModal(page);
  await clickPrimaryModalAction(page);

  await expect.poll(() => state.parseCalls).toBe(1);
  await expect(page.locator(".ant-modal .ant-modal-body input")).toHaveCount(1);
  await clickPrimaryModalAction(page);

  await expect.poll(() => state.createdCategories.length).toBe(1);
  await expect.poll(() => state.createdTransactions.length).toBe(1);
  expect(state.createdCategories[0].name).toBe("Coffee Shops");
});
