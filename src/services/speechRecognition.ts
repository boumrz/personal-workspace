/**
 * Web Speech Recognition Service.
 * Uses browser Web Speech API (Chrome, Safari, Edge).
 * Same interface as mobile (expo-speech-recognition) for consistency.
 */

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
  onError?: (message: string, raw?: unknown) => void;
}

export interface SpeechPermissionState {
  granted: boolean;
  canAskAgain: boolean;
}

const SpeechRecognitionConstructor =
  typeof window !== "undefined"
    ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    : null;

function mapSpeechError(error: string): string {
  switch (error) {
    case "not-allowed":
    case "permission-denied":
      return "Нет доступа к микрофону. Разрешите запись голоса в настройках браузера.";
    case "no-speech":
      return "Не удалось распознать речь. Попробуйте сказать еще раз.";
    case "service-not-allowed":
      return "Сервис распознавания недоступен.";
    case "network":
      return "Проблема с сетью во время распознавания.";
    case "aborted":
      return "Распознавание прервано.";
    case "audio-capture":
      return "Микрофон недоступен.";
    case "language-not-supported":
      return "Язык не поддерживается.";
    default:
      return "Ошибка распознавания речи.";
  }
}

export class SpeechRecognitionService {
  private transcript = "";
  private status: SpeechStatus = "idle";
  private recognition: any = null;
  private callbacks: SpeechRecognitionCallbacks = {};

  getSnapshot(): SpeechRecognitionSnapshot {
    return {
      transcript: this.transcript,
      isFinal: this.status === "idle" && this.transcript.length > 0,
      status: this.status,
    };
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      return true;
    } catch {
      return false;
    }
  }

  async ensureMicrophonePermission(): Promise<SpeechPermissionState> {
    if (!navigator.mediaDevices?.getUserMedia) {
      return { granted: false, canAskAgain: false };
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      return { granted: true, canAskAgain: true };
    } catch (err: any) {
      const name = err?.name ?? "";
      const canAskAgain = name !== "NotAllowedError" && name !== "PermissionDeniedError";
      return { granted: false, canAskAgain };
    }
  }

  isRecognitionAvailable(): boolean {
    return !!SpeechRecognitionConstructor;
  }

  start(callbacks: SpeechRecognitionCallbacks, language = "ru-RU"): void {
    this.stop();
    if (!SpeechRecognitionConstructor) {
      callbacks.onError?.("Распознавание речи недоступно в этом браузере. Используйте Chrome или Safari.");
      return;
    }

    this.callbacks = callbacks;
    this.transcript = "";
    this.updateStatus("starting");

    const recognition = new SpeechRecognitionConstructor();
    this.recognition = recognition;

    recognition.lang = language;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      this.updateStatus("listening");
    };

    recognition.onresult = (event: any) => {
      const result = event.results[event.resultIndex];
      const transcript = result[0]?.transcript?.trim() ?? "";
      if (!transcript) return;

      this.transcript = transcript;
      if (result.isFinal) {
        this.callbacks.onFinal?.(transcript);
      } else {
        this.callbacks.onPartial?.(transcript);
      }
    };

    recognition.onerror = (event: any) => {
      this.updateStatus("idle");
      this.recognition = null;
      const message = mapSpeechError(event.error);
      this.callbacks.onError?.(message, event);
    };

    recognition.onend = () => {
      this.updateStatus("idle");
      this.recognition = null;
    };

    recognition.start();
  }

  stop(): void {
    if (this.recognition && (this.status === "listening" || this.status === "starting")) {
      this.updateStatus("stopping");
      this.recognition.stop();
      this.recognition = null;
      return;
    }
    this.recognition = null;
    this.updateStatus("idle");
  }

  abort(): void {
    if (this.recognition) {
      this.recognition.abort();
      this.recognition = null;
    }
    this.updateStatus("idle");
  }

  private updateStatus(nextStatus: SpeechStatus): void {
    this.status = nextStatus;
    this.callbacks.onStatusChange?.(nextStatus);
  }
}

export const speechRecognitionService = new SpeechRecognitionService();
