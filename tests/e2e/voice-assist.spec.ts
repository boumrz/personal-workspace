import { test, expect, type Page } from "@playwright/test";
import dayjs from "dayjs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REAL_RECEIPT_FIXTURES = [
  {
    filename: "cloud-payments-390.png",
    source: "qr" as const,
    amount: 390,
    date: "2017-12-18",
    description: "Чек ФН 8710000100983019",
    fiscalDriveNumber: "8710000100983019",
    qrPayload: "t=20171218T131500&s=390.00&fn=8710000100983019&i=13513&fp=3647700053&n=1",
    ocrEngine: undefined,
  },
  {
    filename: "four-paws-419-49.png",
    source: "qr" as const,
    amount: 419.49,
    date: "2026-06-09",
    description: "Чек ФН 7380440902817443",
    fiscalDriveNumber: "7380440902817443",
    qrPayload: "t=20260609T1021&s=419.49&fn=7380440902817443&i=3267&fp=2742137682&n=1",
    ocrEngine: undefined,
  },
  {
    filename: "four-paws-phone-419-49.png",
    source: "qr" as const,
    amount: 419.49,
    date: "2026-06-09",
    description: "Чек ФН 7380440902817443",
    fiscalDriveNumber: "7380440902817443",
    qrPayload: "t=20260609T1021&s=419.49&fn=7380440902817443&i=3267&fp=2742137682&n=1",
    ocrEngine: undefined,
  },
  {
    filename: "receipt-photo-polza-300.png",
    source: "ocr" as const,
    amount: 300,
    date: "2026-06-22",
    description: "Флэт Уайт 350 мл",
    fiscalDriveNumber: "7382410900253926",
    qrPayload: undefined,
    ocrEngine: "tesseract",
  },
];

type TransactionPayload = {
  type: "income" | "expense";
  amount: number;
  description: string;
  category: { id: string; name: string; color: string; icon: string };
  date: string;
};

type DraftPayload = {
  type: "income" | "expense";
  amount: number;
  description?: string;
  categoryHint?: string;
  categoryResolution?: "matched_existing" | "suggest_create" | "unknown";
  suggestedCategoryToCreate?: string;
  date?: string;
};

type DraftResponse = {
  items: DraftPayload[];
  confidence: number;
  warnings: string[];
  unparsedText?: string;
  receiptMeta?: {
    source: "qr" | "ocr";
    qrPayload?: string;
    ocrEngine?: string;
    fiscalDriveNumber: string;
    fiscalDocumentNumber: string;
    fiscalSign: string;
    operationType: string;
    operationDateTime: string;
    amount: number;
  };
};

type ApiState = {
  categories: Array<{ id: string; name: string; color: string; icon: string; type?: "income" | "expense" | "both" }>;
  profile: {
    id: string;
    login: string;
    name: string;
    voiceLlmProvider: string | null;
    voiceLlmProviderChain: string[] | null;
  };
  transactions: TransactionPayload[];
  plannedExpenses: unknown[];
  savings: unknown[];
  parseResponse: DraftResponse;
  receiptParseResponse: DraftResponse;
  receiptParseError?: {
    status: number;
    body?: unknown;
    contentType?: string;
  };
  createdCategories: Array<{ id: string; name: string; color: string; icon: string; type?: "income" | "expense" | "both" }>;
  createdTransactions: TransactionPayload[];
  parseCalls: number;
  receiptCalls: number;
};

function buildDefaultState(): ApiState {
  return {
    categories: [
      { id: "1", name: "Food", color: "#4a9ed6", icon: "Utensils", type: "expense" },
      { id: "2", name: "Transport", color: "#5fb972", icon: "Car", type: "expense" },
      { id: "3", name: "Другое", color: "#888888", icon: "Tag", type: "both" },
    ],
    profile: {
      id: "42",
      login: "e2e-user",
      name: "E2E User",
      voiceLlmProvider: "heuristic",
      voiceLlmProviderChain: ["heuristic"],
    },
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
          date: "2026-03-12",
        },
      ],
      confidence: 0.93,
      warnings: [],
      unparsedText: "",
    },
    receiptParseResponse: {
      items: [
        {
          type: "expense",
          amount: 540,
          description: "Cafe receipt",
          categoryHint: "Food",
          categoryResolution: "matched_existing",
          date: "2026-03-17",
        },
      ],
      confidence: 0.89,
      warnings: [],
      unparsedText: "",
    },
    createdCategories: [],
    createdTransactions: [],
    parseCalls: 0,
    receiptCalls: 0,
    receiptUploadBodies: [],
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

    if (method === "GET" && path === "/api/profile") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(state.profile) });
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

    if (method === "POST" && path === "/api/v2/transactions/receipt/parse") {
      state.receiptCalls += 1;
      state.receiptUploadBodies.push(request.postDataBuffer()?.toString("latin1") || "");
      if (state.receiptParseError) {
        const { status, body = "", contentType = "application/json" } = state.receiptParseError;
        return route.fulfill({
          status,
          contentType,
          body: typeof body === "string" ? body : JSON.stringify(body),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(state.receiptParseResponse),
      });
    }

    if (method === "POST" && path === "/api/categories") {
      const payload = request.postDataJSON() as { name: string; color: string; icon: string; type?: "income" | "expense" | "both" };
      const created = {
        id: String(100 + state.createdCategories.length + 1),
        name: payload.name,
        color: payload.color,
        icon: payload.icon,
        type: payload.type ?? "expense",
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

    if (method === "POST" && path === "/api/planned-expenses") {
      const payload = request.postDataJSON() as TransactionPayload;
      state.createdTransactions.push(payload);
      state.plannedExpenses.push(payload);

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: String(300 + state.createdTransactions.length), ...payload }),
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
  await expect(getVoiceModal(page)).toBeVisible();
}

function getVoiceModal(page: Page) {
  return page.locator(".ant-modal:visible").last();
}

async function ensureVoiceModalVisible(page: Page) {
  const modal = getVoiceModal(page);
  if ((await modal.count()) === 0) {
    await openVoiceModal(page);
    return;
  }
  if (!(await modal.first().isVisible())) {
    await openVoiceModal(page);
  }
}

async function clickVoiceProcessAction(page: Page) {
  await ensureVoiceModalVisible(page);
  const actionButton = getVoiceModal(page).locator("button").last();
  await expect(actionButton).toBeVisible();
  await actionButton.click({ force: true });
}

async function processVoiceInput(page: Page, state: ApiState) {
  await clickVoiceProcessAction(page);
  try {
    await expect.poll(() => state.parseCalls, { timeout: 6_000 }).toBe(1);
  } catch {
    // Mobile emulation may occasionally require a second explicit tap.
    await clickVoiceProcessAction(page);
    await expect.poll(() => state.parseCalls).toBe(1);
  }
}

async function clickVoiceSaveAction(page: Page) {
  await ensureVoiceModalVisible(page);
  const actionButton = getVoiceModal(page).locator("button").last();
  await expect(actionButton).toBeVisible();
  await actionButton.click({ force: true });
}

async function openDataToolsModal(page: Page) {
  const openButton = page.locator('[data-testid="data-tools-open-button"]').first();
  await expect(openButton).toBeVisible();
  await openButton.click();

  const drawer = getDataToolsModal(page);
  await expect(drawer).toBeVisible();
  await expect(drawer.locator('[data-testid="receipt-gallery-file-input"]')).toHaveCount(1);
  await expect(drawer.locator('[data-testid="receipt-camera-file-input"]')).toHaveCount(1);
}

async function expectReceiptDraftForm(
  modal: ReturnType<typeof getDataToolsModal>,
  draft: { description: string; amount: number }
) {
  await expect(modal.getByPlaceholder("Описание операции")).toHaveValue(draft.description);
  const amountValue = await modal.locator(".ant-input-number-input").first().inputValue();
  expect(Number(amountValue.replace(/\s+/g, "").replace(",", "."))).toBe(draft.amount);
}

async function createWebpBuffer(page: Page) {
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 2;
    const context = canvas.getContext("2d");
    if (!context) return [];
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, 2, 2);
    context.fillStyle = "#111111";
    context.fillRect(0, 0, 1, 1);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp"));
    if (!blob) return [];
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  return Buffer.from(bytes);
}

function getDataToolsModal(page: Page) {
  return page.locator(".ant-drawer-content-wrapper:visible").last();
}

async function openTransactionForm(page: Page) {
  const floatButton = page.locator(".ant-float-btn").first();
  if (await floatButton.isVisible().catch(() => false)) {
    await floatButton.click();
    return;
  }

  const plusButton = page.locator("button:has(.anticon-plus)").first();
  await expect(plusButton).toBeVisible();
  await plusButton.click();
}

async function chooseDateInTransactionForm(page: Page, targetDate: dayjs.Dayjs) {
  const datePicker = page.locator(".ant-picker:visible").first();
  await expect(datePicker).toBeVisible();
  await datePicker.click();

  const dropdown = page.locator(".ant-picker-dropdown:visible").last();
  await expect(dropdown).toBeVisible();

  const dayCell = dropdown
    .locator(".ant-picker-cell-in-view:not(.ant-picker-cell-disabled) .ant-picker-cell-inner")
    .filter({ hasText: String(targetDate.date()) })
    .first();

  await expect(dayCell).toBeVisible();
  await dayCell.click();
}

test("voice assistant parses speech and saves transaction with existing category", async ({ page }) => {
  const state = buildDefaultState();

  await setupAuthStorage(page);
  await setupSpeechRecognitionMock(page, "spent 450 on food");
  await setupApiMocks(page, state);

  await page.goto("/finance/transactions");
  await expect(page).toHaveURL(/\/finance\/transactions/);

  await openVoiceModal(page);
  await processVoiceInput(page, state);
  await expect(getVoiceModal(page).locator(".ant-modal-body")).toContainText("450");
  await clickVoiceSaveAction(page);

  await expect.poll(() => state.createdTransactions.length).toBe(1);
  expect(state.createdTransactions[0].amount).toBe(450);
  expect(state.createdTransactions[0].date).toBe("2026-03-12");
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
  await processVoiceInput(page, state);
  await expect(
    getVoiceModal(page).getByPlaceholder("Введите категорию (создадим автоматически)")
  ).toHaveValue("Coffee Shops");
  await clickVoiceSaveAction(page);

  await expect.poll(() => state.createdCategories.length).toBe(1);
  await expect.poll(() => state.createdTransactions.length).toBe(1);
  expect(state.createdCategories[0].name).toBe("Coffee Shops");
});

test("transaction tools receipt flow parses QR photo and saves operations", async ({ page }) => {
  const state = buildDefaultState();
  state.receiptParseResponse = {
    items: [
      {
        type: "expense",
        amount: 390,
        description: "Чек ФН 8710000100983019",
        categoryHint: "Другое",
        categoryResolution: "suggest_create",
        suggestedCategoryToCreate: "Другое",
        date: "2017-12-18",
      },
    ],
    confidence: 0.98,
    warnings: [],
    unparsedText: "",
    receiptMeta: {
      source: "qr",
      qrPayload: "t=20171218T1312&s=390.00&fn=8710000100983019&i=3647700053&fp=13513&n=1",
      fiscalDriveNumber: "8710000100983019",
      fiscalDocumentNumber: "3647700053",
      fiscalSign: "13513",
      operationType: "1",
      operationDateTime: "2017-12-18T13:12:00",
      amount: 390,
    },
  };

  await setupAuthStorage(page);
  await setupApiMocks(page, state);

  await page.goto("/finance/transactions");
  await openDataToolsModal(page);

  const modal = getDataToolsModal(page);
  const webpBuffer = await createWebpBuffer(page);
  expect(webpBuffer.length).toBeGreaterThan(0);
  await modal.locator('[data-testid="receipt-gallery-file-input"]').setInputFiles({
    name: "1000014568.webp",
    mimeType: "image/webp",
    buffer: webpBuffer,
  });

  await expect.poll(() => state.receiptCalls).toBe(1);
  expect(state.receiptUploadBodies[0]).toContain('filename="1000014568.png"');
  expect(state.receiptUploadBodies[0]).toContain("Content-Type: image/png");
  await expect(modal).not.toContainText("Фото готово к распознаванию");
  await expectReceiptDraftForm(modal, {
    description: "Чек ФН 8710000100983019",
    amount: 390,
  });

  await modal.locator(".ant-btn:has(.anticon-upload)").first().click();

  await expect.poll(() => state.createdCategories.length).toBe(0);
  await expect.poll(() => state.createdTransactions.length).toBe(1);
  expect(state.createdTransactions[0].category.id).toBe("3");
  expect(state.createdTransactions[0].date).toBe("2017-12-18");
  expect(state.createdTransactions[0].amount).toBe(390);
});

for (const fixture of REAL_RECEIPT_FIXTURES) {
  test(`transaction tools receipt flow shows draft for real receipt fixture ${fixture.filename}`, async ({ page }) => {
    const state = buildDefaultState();
    state.receiptParseResponse = {
      items: [
        {
          type: "expense",
          amount: fixture.amount,
          description: fixture.description,
          categoryHint: "Другое",
          categoryResolution: "suggest_create",
          suggestedCategoryToCreate: "Другое",
          date: fixture.date,
        },
      ],
      confidence: fixture.source === "ocr" ? 0.72 : 0.98,
      warnings: fixture.source === "ocr" ? ["QR-код не прочитан, реквизиты извлечены OCR."] : [],
      unparsedText: "",
      receiptMeta: {
        source: fixture.source,
        ...(fixture.qrPayload ? { qrPayload: fixture.qrPayload } : {}),
        ...(fixture.ocrEngine ? { ocrEngine: fixture.ocrEngine } : {}),
        fiscalDriveNumber: fixture.fiscalDriveNumber,
        fiscalDocumentNumber: "",
        fiscalSign: "",
        operationType: "1",
        operationDateTime: `${fixture.date}T00:00:00`,
        amount: fixture.amount,
      },
    };

    await setupAuthStorage(page);
    await setupApiMocks(page, state);

    await page.goto("/finance/transactions");
    await openDataToolsModal(page);

    const modal = getDataToolsModal(page);
    const image = readFileSync(path.join(__dirname, "../../server/test/fixtures/receipts", fixture.filename));
    await modal.locator('[data-testid="receipt-gallery-file-input"]').setInputFiles({
      name: fixture.filename,
      mimeType: "image/png",
      buffer: image,
    });

    await expect.poll(() => state.receiptCalls).toBe(1);
    expect(state.receiptUploadBodies[0]).toContain(`filename="${fixture.filename}"`);
    await expectReceiptDraftForm(modal, {
      description: fixture.description,
      amount: fixture.amount,
    });
  });
}

test("transaction tools receipt flow shows server error inline and allows retry", async ({ page }) => {
  const state = buildDefaultState();
  state.receiptParseError = {
    status: 400,
    body: { error: "Uploaded file must be an image." },
  };

  await setupAuthStorage(page);
  await setupApiMocks(page, state);

  await page.goto("/finance/transactions");
  await openDataToolsModal(page);

  const modal = getDataToolsModal(page);
  await modal.locator('[data-testid="receipt-gallery-file-input"]').setInputFiles({
    name: "receipt.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not-an-image"),
  });

  await expect.poll(() => state.receiptCalls).toBe(1);
  await expect(modal.locator('[data-testid="receipt-error-alert"]')).toContainText(
    "Uploaded file must be an image."
  );
  await expect(modal).not.toContainText("Фото готово к распознаванию");

  state.receiptParseError = undefined;
  const retryButton = modal.getByRole("button", { name: /Повторить распознавание/i });
  await expect(retryButton).toBeEnabled();
  await retryButton.click();

  await expect.poll(() => state.receiptCalls).toBe(2);
  await expect(modal.locator('[data-testid="receipt-error-alert"]')).toHaveCount(0);
  await expectReceiptDraftForm(modal, {
    description: "Cafe receipt",
    amount: 540,
  });
});

test("transaction tools receipt flow shows QR-specific retake instruction", async ({ page }) => {
  const state = buildDefaultState();
  state.receiptParseError = {
    status: 422,
    body: {
      error: "QR-код чека не распознан. Попробуйте сфотографировать нижнюю часть чека крупнее или введите операцию вручную.",
      code: "receipt_qr_not_found",
    },
  };

  await setupAuthStorage(page);
  await setupApiMocks(page, state);

  await page.goto("/finance/transactions");
  await openDataToolsModal(page);

  const modal = getDataToolsModal(page);
  await modal.locator('[data-testid="receipt-camera-file-input"]').setInputFiles({
    name: "receipt.png",
    mimeType: "image/png",
    buffer: Buffer.from("fake-image"),
  });

  await expect.poll(() => state.receiptCalls).toBe(1);
  await expect(modal.locator('[data-testid="receipt-error-alert"]')).toContainText(
    "Сфотографируйте нижнюю часть чека крупнее"
  );
  await expect(modal.getByRole("button", { name: /Повторить распознавание/i })).toBeVisible();
});

test("transaction tools receipt flow shows HTTP status when API body is empty", async ({ page }) => {
  const state = buildDefaultState();
  state.receiptParseError = {
    status: 502,
    body: "",
    contentType: "text/plain",
  };

  await setupAuthStorage(page);
  await setupApiMocks(page, state);

  await page.goto("/finance/transactions");
  await openDataToolsModal(page);

  const modal = getDataToolsModal(page);
  await modal.locator('[data-testid="receipt-camera-file-input"]').setInputFiles({
    name: "receipt.png",
    mimeType: "image/png",
    buffer: Buffer.from("fake-image"),
  });

  await expect.poll(() => state.receiptCalls).toBe(1);
  await expect(modal.locator('[data-testid="receipt-error-alert"]')).toContainText(
    /API error: HTTP 502/
  );
});

test("transaction form lets you choose a date from the calendar", async ({ page }) => {
  const state = buildDefaultState();
  const targetDate = dayjs().date(dayjs().date() === 15 ? 16 : 15);

  await setupAuthStorage(page);
  await setupApiMocks(page, state);

  await page.goto("/finance/transactions");
  await openTransactionForm(page);

  const form = page.locator(".ant-modal:visible, .ant-drawer-content-wrapper:visible").last();
  await expect(form).toBeVisible();

  const amountInput = form.locator('input[placeholder="0.00"]').first();
  await expect(amountInput).toBeVisible();
  await amountInput.fill("100+100");
  await expect(form).toContainText("200,00");

  await chooseDateInTransactionForm(page, targetDate);

  const selectedDateText = targetDate.format("DD.MM.YYYY");
  const dateInput = form.locator(".ant-picker input").first();
  await expect(dateInput).toHaveValue(selectedDateText);

  const submitButton = form
    .locator(".ant-modal-footer .ant-btn-primary, .ant-drawer-footer .ant-btn-primary")
    .first();
  await expect(submitButton).toBeVisible();
  await submitButton.click();

  await expect.poll(() => state.createdTransactions.length).toBe(1);
  expect(state.createdTransactions[0].amount).toBe(200);
  expect(state.createdTransactions[0].date).toBe(targetDate.format("YYYY-MM-DD"));
});
