import assert from "node:assert/strict";
import { test } from "node:test";
import { createReceiptImportFlow } from "./receiptImport.ts";

class FakeFormData {
  entries: Array<[string, unknown]> = [];

  append(name: string, value: unknown) {
    this.entries.push([name, value]);
  }

  value(name: string) {
    return this.entries.find(([entryName]) => entryName === name)?.[1];
  }
}

function receiptPreviewResponse() {
  return {
    items: [
      {
        type: "expense",
        amount: 300,
        description: "Флэт Уайт 350 мл",
        categoryHint: "Другое",
        date: "2026-06-22",
      },
    ],
    warnings: ["QR-код не прочитан, реквизиты извлечены OCR."],
    confidence: 0.72,
    receiptMeta: {
      source: "ocr",
      ocrEngine: "tesseract",
      fiscalDriveNumber: "7382410900253926",
      fiscalDocumentNumber: "5201",
      fiscalSign: "1424567415",
      operationType: "1",
      operationDateTime: "2026-06-22T10:50:00",
      amount: 300,
    },
  };
}

function createJsonResponse(body: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 422,
    statusText: ok ? "OK" : "Unprocessable Entity",
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function createAndroidHarness(overrides: Partial<Parameters<typeof createReceiptImportFlow>[0]> = {}) {
  const fetchCalls: Array<{ url: string; init: RequestInit }> = [];
  const pickerCalls: string[] = [];
  const formData = new FakeFormData();

  const service = createReceiptImportFlow({
    platformOS: "android",
    createFormData: () => formData,
    getTimezone: () => "Europe/Moscow",
    fetchImpl: async (url, init) => {
      fetchCalls.push({ url: String(url), init: init ?? {} });
      return createJsonResponse(receiptPreviewResponse()) as Response;
    },
    imagePicker: {
      requestMediaLibraryPermissionsAsync: async () => ({ granted: true, status: "granted" }),
      requestCameraPermissionsAsync: async () => ({ granted: true, status: "granted" }),
      launchImageLibraryAsync: async () => {
        pickerCalls.push("gallery");
        return {
          canceled: false,
          assets: [
            {
              uri: "file:///storage/emulated/0/DCIM/receipt.jpg",
              fileName: "receipt.jpg",
              mimeType: "image/jpeg",
            },
          ],
        };
      },
      launchCameraAsync: async () => {
        pickerCalls.push("camera");
        return {
          canceled: false,
          assets: [
            {
              uri: "file:///cache/camera-capture",
              mimeType: "image/jpeg",
            },
          ],
        };
      },
    },
    openBrowserBridge: async () => {
      pickerCalls.push("bridge");
    },
    ...overrides,
  });

  return { service, fetchCalls, pickerCalls, formData };
}

test("uploads Android gallery receipt to the shared parser and returns a review preview", async () => {
  const { service, fetchCalls, pickerCalls, formData } = createAndroidHarness();

  const preview = await service.openReceiptImportFlow("http://10.0.2.2:3001/api/", "token-123", "gallery");

  assert.deepEqual(pickerCalls, ["gallery"]);
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, "http://10.0.2.2:3001/api/v2/transactions/receipt/parse");
  assert.deepEqual(fetchCalls[0].init.headers, { Authorization: "Bearer token-123" });
  assert.deepEqual(formData.value("file"), {
    uri: "file:///storage/emulated/0/DCIM/receipt.jpg",
    name: "receipt.jpg",
    type: "image/jpeg",
  });
  assert.equal(formData.value("locale"), "ru-RU");
  assert.equal(formData.value("timezone"), "Europe/Moscow");
  assert.equal(preview?.source, "receipt");
  assert.equal(preview?.drafts[0]?.amount, 300);
  assert.equal(preview?.receiptMeta?.source, "ocr");
});

test("uploads Android camera capture with a stable fallback filename", async () => {
  const { service, fetchCalls, pickerCalls, formData } = createAndroidHarness();

  const preview = await service.openReceiptImportFlow("http://10.0.2.2:3001/api", "token-123", "camera");

  assert.deepEqual(pickerCalls, ["camera"]);
  assert.equal(fetchCalls.length, 1);
  assert.deepEqual(formData.value("file"), {
    uri: "file:///cache/camera-capture",
    name: "receipt-camera.jpg",
    type: "image/jpeg",
  });
  assert.equal(preview?.drafts[0]?.description, "Флэт Уайт 350 мл");
});

test("returns null without upload when Android user cancels image input", async () => {
  const { service, fetchCalls } = createAndroidHarness({
    imagePicker: {
      requestMediaLibraryPermissionsAsync: async () => ({ granted: true, status: "granted" }),
      requestCameraPermissionsAsync: async () => ({ granted: true, status: "granted" }),
      launchImageLibraryAsync: async () => ({ canceled: true, assets: [] }),
      launchCameraAsync: async () => ({ canceled: true, assets: [] }),
    },
  });

  const preview = await service.openReceiptImportFlow("http://10.0.2.2:3001/api", "token-123", "gallery");

  assert.equal(preview, null);
  assert.equal(fetchCalls.length, 0);
});

test("throws actionable permission error before upload when Android camera access is denied", async () => {
  const { service, fetchCalls } = createAndroidHarness({
    imagePicker: {
      requestMediaLibraryPermissionsAsync: async () => ({ granted: true, status: "granted" }),
      requestCameraPermissionsAsync: async () => ({ granted: false, status: "denied" }),
      launchImageLibraryAsync: async () => ({ canceled: true, assets: [] }),
      launchCameraAsync: async () => {
        throw new Error("picker should not open");
      },
    },
  });

  await assert.rejects(
    () => service.openReceiptImportFlow("http://10.0.2.2:3001/api", "token-123", "camera"),
    /Нет доступа к камере/
  );
  assert.equal(fetchCalls.length, 0);
});

test("surfaces server receipt parse error text on Android", async () => {
  const { service } = createAndroidHarness({
    fetchImpl: async () =>
      createJsonResponse(
        {
          code: "receipt_ocr_not_found",
          error: "QR-код не прочитан, а OCR не смог извлечь фискальные реквизиты.",
        },
        false
      ) as Response,
  });

  await assert.rejects(
    () => service.openReceiptImportFlow("http://10.0.2.2:3001/api", "token-123", "gallery"),
    /OCR не смог извлечь/
  );
});

test("keeps browser bridge fallback for unsupported native platforms", async () => {
  const bridgeCalls: string[] = [];
  const { service, fetchCalls, pickerCalls } = createAndroidHarness({
    platformOS: "ios",
    openBrowserBridge: async ({ source }) => {
      bridgeCalls.push(source);
    },
  });

  const preview = await service.openReceiptImportFlow("http://10.0.2.2:3001/api", "token-123", "camera");

  assert.equal(preview, null);
  assert.deepEqual(bridgeCalls, ["camera"]);
  assert.deepEqual(pickerCalls, []);
  assert.equal(fetchCalls.length, 0);
});
