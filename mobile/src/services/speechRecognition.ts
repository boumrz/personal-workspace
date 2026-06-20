import type {
  ExpoSpeechRecognitionErrorEvent,
  ExpoSpeechRecognitionResultEvent,
} from "expo-speech-recognition";

export type SpeechStatus = "idle" | "starting" | "listening" | "stopping";

export interface SpeechRecognitionSnapshot {
  transcript: string;
  isFinal: boolean;
  status: SpeechStatus;
}

export interface SpeechRecognitionCallbacks {
  onPartial?: (text: string) => void;
  onFinal?: (text: string) => void;
  onStatusChange?: (status: SpeechStatus) => void;
  onError?: (message: string, raw: ExpoSpeechRecognitionErrorEvent) => void;
}

export interface SpeechPermissionState {
  granted: boolean;
  canAskAgain: boolean;
}

type Subscription = { remove: () => void };
type ExpoSpeechRecognitionModuleRef = typeof import("expo-speech-recognition")["ExpoSpeechRecognitionModule"];

const MISSING_NATIVE_MODULE_MESSAGE =
  "Голосовое распознавание доступно только в Android-сборке приложения. Установите свежий APK и откройте QR через приложение «Мой бюджет», а не через Expo Go.";

let speechRecognitionModule: ExpoSpeechRecognitionModuleRef | null | undefined;

function getSpeechRecognitionModule(): ExpoSpeechRecognitionModuleRef | null {
  if (speechRecognitionModule !== undefined) {
    return speechRecognitionModule;
  }

  try {
    const moduleRef = require("expo-speech-recognition") as typeof import("expo-speech-recognition");
    speechRecognitionModule = moduleRef.ExpoSpeechRecognitionModule ?? null;
  } catch {
    speechRecognitionModule = null;
  }

  return speechRecognitionModule;
}

function mapSpeechError(event: ExpoSpeechRecognitionErrorEvent): string {
  switch (event.error) {
    case "not-allowed":
      return "Нет доступа к микрофону. Разрешите запись голоса в настройках.";
    case "no-speech":
      return "Не удалось распознать речь. Попробуйте сказать еще раз.";
    case "service-not-allowed":
      return "Сервис распознавания недоступен на устройстве.";
    case "network":
      return "Проблема с сетью во время распознавания.";
    case "busy":
      return "Распознавание уже запущено. Попробуйте чуть позже.";
    default:
      return event.message || "Ошибка распознавания речи.";
  }
}

export class SpeechRecognitionService {
  private transcript = "";
  private status: SpeechStatus = "idle";
  private subscriptions: Subscription[] = [];
  private callbacks: SpeechRecognitionCallbacks = {};

  getSnapshot(): SpeechRecognitionSnapshot {
    return {
      transcript: this.transcript,
      isFinal: this.status === "idle" && this.transcript.length > 0,
      status: this.status,
    };
  }

  async requestPermissions(): Promise<boolean> {
    const nativeModule = getSpeechRecognitionModule();
    if (!nativeModule) {
      return false;
    }

    const result = await nativeModule.requestPermissionsAsync();
    return result.granted;
  }

  async ensureMicrophonePermission(): Promise<SpeechPermissionState> {
    const nativeModule = getSpeechRecognitionModule();
    if (!nativeModule) {
      return { granted: false, canAskAgain: false };
    }

    const current = await nativeModule.getMicrophonePermissionsAsync();
    if (current.granted) {
      return { granted: true, canAskAgain: current.canAskAgain };
    }

    const requested = await nativeModule.requestMicrophonePermissionsAsync();
    return {
      granted: requested.granted,
      canAskAgain: requested.canAskAgain,
    };
  }

  getUnavailableReason(): string | null {
    return getSpeechRecognitionModule() ? null : MISSING_NATIVE_MODULE_MESSAGE;
  }

  isRecognitionAvailable(): boolean {
    const nativeModule = getSpeechRecognitionModule();
    if (!nativeModule) {
      return false;
    }

    try {
      return nativeModule.isRecognitionAvailable();
    } catch {
      return false;
    }
  }

  start(callbacks: SpeechRecognitionCallbacks, language = "ru-RU"): void {
    this.stop();
    this.callbacks = callbacks;
    this.transcript = "";
    this.updateStatus("starting");
    const nativeModule = getSpeechRecognitionModule();
    if (!nativeModule) {
      this.updateStatus("idle");
      this.callbacks.onError?.(MISSING_NATIVE_MODULE_MESSAGE, {
        error: "service-not-allowed",
        message: MISSING_NATIVE_MODULE_MESSAGE,
      } as ExpoSpeechRecognitionErrorEvent);
      return;
    }

    this.subscriptions.push(
      nativeModule.addListener("start", () => {
        this.updateStatus("listening");
      })
    );

    this.subscriptions.push(
      nativeModule.addListener("result", (event: ExpoSpeechRecognitionResultEvent) => {
        const transcript = event.results[0]?.transcript?.trim() ?? "";
        if (!transcript) {
          return;
        }

        this.transcript = transcript;
        if (event.isFinal) {
          this.callbacks.onFinal?.(transcript);
        } else {
          this.callbacks.onPartial?.(transcript);
        }
      })
    );

    this.subscriptions.push(
      nativeModule.addListener("error", (event: ExpoSpeechRecognitionErrorEvent) => {
        this.updateStatus("idle");
        this.callbacks.onError?.(mapSpeechError(event), event);
        this.teardownSubscriptions();
      })
    );

    this.subscriptions.push(
      nativeModule.addListener("end", () => {
        this.updateStatus("idle");
        this.teardownSubscriptions();
      })
    );

    nativeModule.start({
      lang: language,
      interimResults: true,
      continuous: false,
      addsPunctuation: true,
    });
  }

  stop(): void {
    const nativeModule = getSpeechRecognitionModule();
    if (this.status === "listening" || this.status === "starting") {
      this.updateStatus("stopping");
      nativeModule?.stop();
      return;
    }
    this.teardownSubscriptions();
    this.updateStatus("idle");
  }

  abort(): void {
    getSpeechRecognitionModule()?.abort();
    this.teardownSubscriptions();
    this.updateStatus("idle");
  }

  private updateStatus(nextStatus: SpeechStatus): void {
    this.status = nextStatus;
    this.callbacks.onStatusChange?.(nextStatus);
  }

  private teardownSubscriptions(): void {
    this.subscriptions.forEach((sub) => sub.remove());
    this.subscriptions = [];
  }
}

export const speechRecognitionService = new SpeechRecognitionService();
