import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionErrorEvent,
  type ExpoSpeechRecognitionResultEvent,
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
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    return result.granted;
  }

  async ensureMicrophonePermission(): Promise<SpeechPermissionState> {
    const current = await ExpoSpeechRecognitionModule.getMicrophonePermissionsAsync();
    if (current.granted) {
      return { granted: true, canAskAgain: current.canAskAgain };
    }

    const requested = await ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync();
    return {
      granted: requested.granted,
      canAskAgain: requested.canAskAgain,
    };
  }

  isRecognitionAvailable(): boolean {
    return ExpoSpeechRecognitionModule.isRecognitionAvailable();
  }

  start(callbacks: SpeechRecognitionCallbacks, language = "ru-RU"): void {
    this.stop();
    this.callbacks = callbacks;
    this.transcript = "";
    this.updateStatus("starting");

    this.subscriptions.push(
      ExpoSpeechRecognitionModule.addListener("start", () => {
        this.updateStatus("listening");
      })
    );

    this.subscriptions.push(
      ExpoSpeechRecognitionModule.addListener("result", (event: ExpoSpeechRecognitionResultEvent) => {
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
      ExpoSpeechRecognitionModule.addListener("error", (event: ExpoSpeechRecognitionErrorEvent) => {
        this.updateStatus("idle");
        this.callbacks.onError?.(mapSpeechError(event), event);
        this.teardownSubscriptions();
      })
    );

    this.subscriptions.push(
      ExpoSpeechRecognitionModule.addListener("end", () => {
        this.updateStatus("idle");
        this.teardownSubscriptions();
      })
    );

    ExpoSpeechRecognitionModule.start({
      lang: language,
      interimResults: true,
      continuous: false,
      addsPunctuation: true,
    });
  }

  stop(): void {
    if (this.status === "listening" || this.status === "starting") {
      this.updateStatus("stopping");
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    this.teardownSubscriptions();
    this.updateStatus("idle");
  }

  abort(): void {
    ExpoSpeechRecognitionModule.abort();
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
