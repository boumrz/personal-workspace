import type {
  ReceiptMeta,
  TransactionDraft,
  TransactionImportPreview,
} from "@finance-assistant/shared";

const RECEIPT_PARSE_ENDPOINT = "/v2/transactions/receipt/parse";

export type ReceiptImportSource = "gallery" | "camera";

type PermissionResult = {
  granted?: boolean;
  status?: string;
};

export type ReceiptImageAsset = {
  uri?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
};

export type ReceiptImportSelection = {
  asset: ReceiptImageAsset;
  source: ReceiptImportSource;
};

type ImagePickerResult = {
  canceled?: boolean;
  assets?: ReceiptImageAsset[] | null;
};

type ReceiptImagePicker = {
  requestMediaLibraryPermissionsAsync?: () => Promise<PermissionResult>;
  requestCameraPermissionsAsync?: () => Promise<PermissionResult>;
  launchImageLibraryAsync: (options?: Record<string, unknown>) => Promise<ImagePickerResult>;
  launchCameraAsync: (options?: Record<string, unknown>) => Promise<ImagePickerResult>;
};

type AppendableFormData = {
  append(name: string, value: unknown): void;
};

type BrowserBridgeArgs = {
  apiBaseUrl: string;
  token: string;
  source: ReceiptImportSource;
};

type ReceiptImportFlowDependencies = {
  platformOS: string;
  imagePicker?: ReceiptImagePicker;
  fetchImpl?: (input: string, init?: RequestInit) => Promise<Response>;
  createFormData?: () => AppendableFormData;
  getTimezone?: () => string;
  openBrowserBridge?: (args: BrowserBridgeArgs) => Promise<void>;
};

type ReceiptParseResponse = {
  items?: TransactionDraft[];
  warnings?: string[];
  confidence?: number;
  receiptMeta?: ReceiptMeta;
  preview?: TransactionImportPreview;
  source?: "receipt";
  title?: string;
  drafts?: TransactionDraft[];
};

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function isPermissionGranted(result: PermissionResult | null | undefined) {
  return result?.granted === true || result?.status === "granted";
}

function inferMimeType(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic")) return "image/heic";
  if (lower.endsWith(".heif")) return "image/heif";
  return "image/jpeg";
}

function fallbackFilename(source: ReceiptImportSource) {
  return source === "camera" ? "receipt-camera.jpg" : "receipt-photo.jpg";
}

function filenameFromUri(uri: string) {
  const raw = uri.split(/[/?#]/).filter(Boolean).pop();
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function resolveFilename(asset: ReceiptImageAsset, source: ReceiptImportSource) {
  if (source === "camera" && !String(asset.fileName || "").trim()) {
    return fallbackFilename(source);
  }

  const name = String(asset.fileName || filenameFromUri(String(asset.uri || "")) || fallbackFilename(source)).trim();
  if (!name) return fallbackFilename(source);
  if (/\.[a-z0-9]{2,5}$/i.test(name)) return name;
  return `${name}.jpg`;
}

function normalizeReceiptPreview(data: ReceiptParseResponse): TransactionImportPreview {
  if (data.preview?.source === "receipt" && Array.isArray(data.preview.drafts)) {
    return data.preview;
  }

  if (data.source === "receipt" && Array.isArray(data.drafts)) {
    return {
      source: "receipt",
      title: data.title || "Распознанный чек",
      warnings: Array.isArray(data.warnings) ? data.warnings : [],
      drafts: data.drafts,
      confidence: data.confidence,
      receiptMeta: data.receiptMeta,
    };
  }

  if (Array.isArray(data.items)) {
    return {
      source: "receipt",
      title: "Распознанный чек",
      warnings: Array.isArray(data.warnings) ? data.warnings : [],
      drafts: data.items,
      confidence: data.confidence,
      receiptMeta: data.receiptMeta,
    };
  }

  throw new Error("Сервер вернул некорректный ответ распознавания чека.");
}

async function readReceiptError(response: Response) {
  const fallback = response.status
    ? `Ошибка распознавания чека: HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`
    : "Ошибка распознавания чека.";

  try {
    const jsonResponse = typeof response.clone === "function" ? response.clone() : response;
    const data = await jsonResponse.json();
    if (typeof data?.error === "string" && data.error.trim()) return data.error.trim();
    if (typeof data?.message === "string" && data.message.trim()) return data.message.trim();
    if (typeof data?.detail === "string" && data.detail.trim()) return data.detail.trim();
  } catch {
    try {
      const textResponse = typeof response.clone === "function" ? response.clone() : response;
      const text = await textResponse.text();
      if (text.trim()) return text.trim().slice(0, 200);
    } catch {
      // keep fallback
    }
  }

  return fallback;
}

function appendReceiptFormData({
  formData,
  asset,
  source,
  timezone,
}: {
  formData: AppendableFormData;
  asset: ReceiptImageAsset;
  source: ReceiptImportSource;
  timezone: string;
}) {
  const uri = String(asset.uri || "").trim();
  if (!uri) {
    throw new Error("Выбранное изображение недоступно для загрузки.");
  }

  const name = resolveFilename(asset, source);
  const type = String(asset.mimeType || "").trim() || inferMimeType(name);
  formData.append("file", { uri, name, type });
  formData.append("locale", "ru-RU");
  formData.append("timezone", timezone || "Europe/Moscow");
}

function normalizeNetworkError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/network request failed|failed to fetch|networkerror|fetch/i.test(message)) {
    return new Error("Не удалось подключиться к серверу. Проверьте интернет или адрес API и попробуйте снова.");
  }
  return error instanceof Error ? error : new Error(message || "Не удалось отправить фото чека.");
}

export function createReceiptImportFlow({
  platformOS,
  imagePicker,
  fetchImpl = fetch,
  createFormData = () => new FormData(),
  getTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Moscow",
  openBrowserBridge,
}: ReceiptImportFlowDependencies) {
  async function selectReceiptImage(source: ReceiptImportSource = "gallery"): Promise<ReceiptImportSelection | null> {
    if (platformOS !== "android") {
      await openBrowserBridge?.({ apiBaseUrl: "", token: "", source });
      return null;
    }

    if (!imagePicker) {
      throw new Error("Выбор фото недоступен на этом устройстве.");
    }

    const result =
      source === "camera"
        ? await openCameraPicker(imagePicker)
        : await imagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 1,
            allowsEditing: false,
          });

    if (result.canceled || !result.assets?.length) {
      return null;
    }

    return {
      asset: result.assets[0],
      source,
    };
  }

  async function uploadReceiptImage(
    apiBaseUrl: string,
    token: string,
    selection: ReceiptImportSelection
  ): Promise<TransactionImportPreview> {
    const formData = createFormData();
    appendReceiptFormData({
      formData,
      asset: selection.asset,
      source: selection.source,
      timezone: getTimezone(),
    });

    let response: Response;
    try {
      response = await fetchImpl(`${trimTrailingSlash(apiBaseUrl)}${RECEIPT_PARSE_ENDPOINT}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData as BodyInit,
      });
    } catch (error) {
      throw normalizeNetworkError(error);
    }

    if (!response.ok) {
      throw new Error(await readReceiptError(response));
    }

    return normalizeReceiptPreview((await response.json()) as ReceiptParseResponse);
  }

  return {
    selectReceiptImage,
    uploadReceiptImage,
    async openReceiptImportFlow(
      apiBaseUrl: string,
      token: string,
      source: ReceiptImportSource = "gallery"
    ): Promise<TransactionImportPreview | null> {
      if (platformOS !== "android") {
        await openBrowserBridge?.({ apiBaseUrl, token, source });
        return null;
      }

      if (!imagePicker) {
        throw new Error("Выбор фото недоступен на этом устройстве.");
      }

      const result =
        source === "camera"
          ? await openCameraPicker(imagePicker)
          : await imagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              quality: 1,
              allowsEditing: false,
            });

      if (result.canceled || !result.assets?.length) {
        return null;
      }

      const formData = createFormData();
      appendReceiptFormData({
        formData,
        asset: result.assets[0],
        source,
        timezone: getTimezone(),
      });

      const response = await fetchImpl(
        `${trimTrailingSlash(apiBaseUrl)}${RECEIPT_PARSE_ENDPOINT}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData as BodyInit,
        }
      );

      if (!response.ok) {
        throw new Error(await readReceiptError(response));
      }

      return normalizeReceiptPreview((await response.json()) as ReceiptParseResponse);
    },
  };
}

async function openCameraPicker(imagePicker: ReceiptImagePicker) {
  const permission = await imagePicker.requestCameraPermissionsAsync?.();
  if (!isPermissionGranted(permission)) {
    throw new Error("Нет доступа к камере. Разрешите доступ к камере и попробуйте снова.");
  }

  return imagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 1,
    allowsEditing: false,
  });
}
