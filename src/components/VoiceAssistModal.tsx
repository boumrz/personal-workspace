import React, { useState, useCallback, useMemo } from "react";
import { DatePicker, Modal, Spin, Input, message } from "antd";
import dayjs from "dayjs";
import { useFinance } from "../context/FinanceContext";
import {
  useGetCategoriesQuery,
  useGetProfileQuery,
  useParseTransactionsFromSpeechMutation,
} from "../store/api";
import { speechRecognitionService } from "../services/speechRecognition";
import type {
  Category,
  ParsedSpeechTransactionItem,
} from "../store/api";
import * as styles from "./VoiceAssistModal.module.css";

interface VoiceAssistModalProps {
  open: boolean;
  onClose: () => void;
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

function categoryMatchesTransactionType(
  category: Category,
  transactionType: "income" | "expense"
) {
  const scope =
    category.type ||
    (category.name === "Зарплата"
      ? "income"
      : category.name === "Другое"
        ? "both"
        : "expense");
  return scope === "both" || scope === transactionType;
}

const DEFAULT_VOICE_PROVIDER_CHAIN = ["gpt4free", "heuristic"] as const;

function getTodayIso() {
  return dayjs().format("YYYY-MM-DD");
}

function normalizeDraftDate(value?: string | null, fallback = getTodayIso()) {
  const raw = String(value || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const parsed = dayjs(raw);
    if (parsed.isValid() && parsed.format("YYYY-MM-DD") === raw) {
      return raw;
    }
  }
  return fallback;
}

function normalizeProvider(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function resolveUserProviderChain(profile?: {
  voiceLlmProvider?: string | null;
  voiceLlmProviderChain?: string[] | null;
} | null) {
  if (!profile) return [];
  const fromChain = Array.isArray(profile.voiceLlmProviderChain)
    ? profile.voiceLlmProviderChain.map((item) => normalizeProvider(item)).filter(Boolean)
    : [];
  if (fromChain.length > 0) {
    return Array.from(new Set(fromChain));
  }
  const single = normalizeProvider(profile.voiceLlmProvider);
  return single ? [single] : [];
}

function isDefaultVoiceConfiguration(profile?: {
  voiceLlmProvider?: string | null;
  voiceLlmProviderChain?: string[] | null;
} | null) {
  const providerChain = resolveUserProviderChain(profile);
  if (providerChain.length === 0) return true;
  if (providerChain.length === 1 && providerChain[0] === "gpt4free") return true;
  const chainSet = new Set(providerChain);
  return (
    chainSet.size === DEFAULT_VOICE_PROVIDER_CHAIN.length &&
    DEFAULT_VOICE_PROVIDER_CHAIN.every((provider) => chainSet.has(provider))
  );
}

export const VoiceAssistModal: React.FC<VoiceAssistModalProps> = ({
  open,
  onClose,
}) => {
  const { addTransaction, addCategory } = useFinance();
  const { data: categories = [] } = useGetCategoriesQuery(undefined, {
    skip: !open,
  });
  const { data: profile } = useGetProfileQuery(undefined, {
    skip: !open,
  });
  const [parseFromSpeech] = useParseTransactionsFromSpeechMutation();

  const [isListening, setIsListening] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [parsedItems, setParsedItems] = useState<ParsedSpeechTransactionItem[]>(
    []
  );
  const [categoryDrafts, setCategoryDrafts] = useState<string[]>([]);
  const [dateDrafts, setDateDrafts] = useState<string[]>([]);
  const showVoiceUpgradeHint = useMemo(() => isDefaultVoiceConfiguration(profile), [profile]);
  const handleFocusCapture = useCallback((event: React.FocusEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    if (!target?.scrollIntoView) return;
    window.setTimeout(() => {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 120);
  }, []);

  const today = dayjs().format("YYYY-MM-DD");

  const resolveCategoryByName = useCallback(
    (rawName: string, transactionType: "income" | "expense"): Category | null => {
      if (categories.length === 0) return null;
      const hint = normalize(rawName);
      if (hint) {
        const exact = categories.find(
          (c) => normalize(c.name) === hint && categoryMatchesTransactionType(c, transactionType)
        );
        if (exact) return exact;
        const fuzzy = categories.find((c) => {
          const categoryName = normalize(c.name);
          return categoryMatchesTransactionType(c, transactionType) && (categoryName.includes(hint) || hint.includes(categoryName));
        });
        if (fuzzy) return fuzzy;
      }
      return null;
    },
    [categories]
  );

  const resolveCategory = useCallback(
    (item: ParsedSpeechTransactionItem, index: number): Category | null => {
      const draftName = categoryDrafts[index]?.trim();
      const source = draftName || item.categoryHint || "";
      return resolveCategoryByName(source, item.type);
    },
    [categoryDrafts, resolveCategoryByName]
  );

  const updateCategoryDraft = (index: number, value: string) => {
    setCategoryDrafts((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const updateDateDraft = (index: number, value: string) => {
    setDateDrafts((prev) => {
      const next = [...prev];
      next[index] = normalizeDraftDate(value, today);
      return next;
    });
  };

  const resetVoiceFlow = useCallback(() => {
    speechRecognitionService.abort();
    setIsListening(false);
    setIsParsing(false);
    setIsSaving(false);
    setTranscript("");
    setParseWarnings([]);
    setParsedItems([]);
    setCategoryDrafts([]);
    setDateDrafts([]);
    onClose();
  }, [onClose]);

  const runParse = useCallback(
    async (text: string) => {
      const normalized = text.trim();
      if (!normalized) {
        message.warning("Сначала продиктуйте операцию.");
        return;
      }
      setIsParsing(true);
      try {
        const parsed = await parseFromSpeech({
          text: normalized,
          mode: "actual",
          context: {
            locale: "ru-RU",
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        }).unwrap();
        setParsedItems(parsed.items);
        setCategoryDrafts(parsed.items.map((item) => item.categoryHint ?? ""));
        setDateDrafts(parsed.items.map((item) => normalizeDraftDate(item.date, today)));
        setParseWarnings(parsed.warnings ?? []);
        if (!parsed.items.length) {
          message.warning(
            "Не удалось разобрать операции. Попробуйте переформулировать фразу."
          );
        }
      } catch (error: any) {
        message.error(error?.data?.error ?? "Не удалось обработать голосовой ввод.");
      } finally {
        setIsParsing(false);
      }
    },
    [parseFromSpeech]
  );

  const startListening = useCallback(async () => {
    if (!speechRecognitionService.isRecognitionAvailable()) {
      message.error("Распознавание речи недоступно в этом браузере. Используйте Chrome или Safari.");
      return;
    }

    try {
      const [permissionState] = await Promise.all([
        speechRecognitionService.ensureMicrophonePermission(),
      ]);
      if (!permissionState.granted) {
        if (!permissionState.canAskAgain) {
          message.error(
            "Доступ к микрофону отключен. Откройте настройки браузера и разрешите микрофон."
          );
        } else {
          message.error("Разрешите доступ к микрофону для голосового ввода.");
        }
        return;
      }

      setTranscript("");
      setParsedItems([]);
      setDateDrafts([]);
      setParseWarnings([]);
      setIsListening(true);

      speechRecognitionService.start({
        onPartial: (text) => setTranscript(text),
        onFinal: (text) => {
          setTranscript(text);
          setIsListening(false);
          void runParse(text);
        },
        onStatusChange: (status) => {
          if (status === "idle" || status === "stopping") {
            setIsListening(false);
          }
          if (status === "listening") {
            setIsListening(true);
          }
        },
        onError: (msg) => {
          setIsListening(false);
          message.error(msg);
        },
      });
    } catch (error: any) {
      message.error(error?.message ?? "Не удалось запустить голосовой ввод.");
    }
  }, [runParse]);

  const stopListening = useCallback(() => {
    speechRecognitionService.stop();
    setIsListening(false);
  }, []);

  const saveParsedItems = useCallback(async () => {
    if (!parsedItems.length) {
      message.warning("Нет операций для добавления.");
      return;
    }

    setIsSaving(true);
    let added = 0;
    let skipped = 0;
    let createdCount = 0;
    const createdByName = new Map<string, Category>();

    try {
      for (let index = 0; index < parsedItems.length; index += 1) {
        const item = parsedItems[index];
        const existing = resolveCategory(item, index);
        if (existing) continue;

        const desiredName = (
          categoryDrafts[index] ||
          item.categoryHint ||
          ""
        ).trim();
        if (!desiredName) {
          skipped += 1;
          continue;
        }

        const normalized = normalize(desiredName);
        if (createdByName.has(normalized)) continue;

        const created = await addCategory({
          name: desiredName[0].toUpperCase() + desiredName.slice(1),
          color: "#4a9ed6",
          icon: "Tag",
          type: item.type,
        });
        createdByName.set(normalized, created);
        createdCount += 1;
      }

      for (let index = 0; index < parsedItems.length; index += 1) {
        const item = parsedItems[index];
        let category = resolveCategory(item, index);

        if (!category) {
          const desiredName = (
            categoryDrafts[index] || item.categoryHint || ""
          ).trim();
          const fromCreated = desiredName
            ? createdByName.get(normalize(desiredName))
            : undefined;
          category = fromCreated ?? null;
        }

        if (!category) {
          skipped += 1;
          continue;
        }

        const transactionDate =
          normalizeDraftDate(dateDrafts[index], today);

        await addTransaction({
          type: item.type,
          amount: item.amount,
          description: "Голосовая операция",
          date: transactionDate,
          category,
        });
        added += 1;
      }

      resetVoiceFlow();
      message.success(
        skipped > 0
          ? `Добавлено: ${added}. Создано категорий: ${createdCount}. Пропущено: ${skipped}.`
          : `Добавлено операций: ${added}. Создано категорий: ${createdCount}.`
      );
    } catch (error: any) {
      message.error(error?.message ?? "Не удалось сохранить часть операций.");
    } finally {
      setIsSaving(false);
    }
  }, [
    parsedItems,
    categoryDrafts,
    dateDrafts,
    resolveCategory,
    addTransaction,
    addCategory,
    today,
    resetVoiceFlow,
  ]);

  const handleProcessClick = () => {
    if (transcript.trim()) {
      void runParse(transcript);
    } else {
      void startListening();
    }
  };

  return (
    <Modal
      open={open}
      onCancel={resetVoiceFlow}
      footer={null}
      width={480}
      centered
      destroyOnClose
      className={styles.modal}
      styles={{ body: { maxHeight: "70dvh", overflowY: "auto" } }}
    >
      <div className={styles.content} onFocusCapture={handleFocusCapture}>
        <h3 className={styles.title}>Голосовой помощник</h3>
        <p className={styles.description}>
          Добавляйте доходы и расходы голосом. Продиктуйте сумму и описание —
          например: «Потратил 500 рублей на кофе» или «Получил 3000 зарплата».
        </p>
        {showVoiceUpgradeHint && (
          <div className={styles.voiceUpgradeHint}>
            <span className={styles.voiceUpgradeHintText}>
              Для полного доступа к голосовому помощнику обратитесь к разработчику.
            </span>
          </div>
        )}
        <p className={styles.subtitle}>
          {isListening
            ? "Скажите операции вслух. Можно перечислять несколько транзакций подряд."
            : "Проверьте распознанный текст и подтвердите добавление."}
        </p>

        <div className={styles.transcriptBox}>
          {transcript ? (
            <span className={styles.transcriptText}>{transcript}</span>
          ) : (
            <span className={styles.transcriptPlaceholder}>
              Нажмите на микрофон и продиктуйте операцию.
            </span>
          )}
        </div>

        {isParsing && (
          <div className={styles.spinner}>
            <Spin size="small" />
          </div>
        )}

        {parseWarnings.map((warning) => (
          <p key={warning} className={styles.warningText}>
            {warning}
          </p>
        ))}

        {parsedItems.length > 0 && (
          <div className={styles.parsedList}>
            {parsedItems.map((item, index) => {
              const category = resolveCategory(item, index);
              const suggestion =
                categoryDrafts[index] ||
                item.suggestedCategoryToCreate ||
                item.categoryHint ||
                "";
              const draftDate = normalizeDraftDate(dateDrafts[index], today);
              return (
                <div
                  key={`${item.type}-${item.amount}-${index}`}
                  className={styles.parsedItem}
                >
                  <div className={styles.parsedItemTitle}>
                    {item.type === "income" ? "Доход" : "Расход"} · ₽
                    {item.amount.toLocaleString("ru-RU")}
                  </div>
                  <div className={styles.parsedItemMeta}>
                    Категория: {category?.name ?? "Не определена"}
                  </div>
                  <div className={styles.dateDraftRow}>
                    <div>
                      <div className={styles.dateDraftLabel}>Дата операции</div>
                      <div className={styles.dateDraftHint}>
                        {item.date ? "Распознана из фразы" : "Дата не названа, предложено сегодня"}
                      </div>
                    </div>
                    <DatePicker
                      className={styles.dateDraftPicker}
                      size="small"
                      allowClear={false}
                      value={dayjs(draftDate)}
                      format="DD.MM.YYYY"
                      onChange={(value) =>
                        updateDateDraft(index, value ? value.format("YYYY-MM-DD") : today)
                      }
                    />
                  </div>
                  {!category && (
                    <>
                      <div className={styles.parsedItemMeta}>
                        {item.categoryResolution === "suggest_create"
                          ? `Предложение: создать категорию «${suggestion || "Новая категория"}»`
                          : `Предположение: ${suggestion || "не удалось определить"}`}
                      </div>
                      <Input
                        className={styles.categoryInput}
                        value={categoryDrafts[index] ?? ""}
                        onChange={(e) =>
                          updateCategoryDraft(index, e.target.value)
                        }
                        placeholder="Введите категорию (создадим автоматически)"
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className={styles.actionsRow}>
          <button
            type="button"
            className={`${styles.button} ${styles.buttonSecondary}`}
            onClick={resetVoiceFlow}
            disabled={isSaving}
          >
            Закрыть
          </button>

          {isListening ? (
            <button
              type="button"
              className={`${styles.button} ${styles.buttonDanger}`}
              onClick={stopListening}
            >
              Стоп
            </button>
          ) : parsedItems.length > 0 ? (
            <button
              type="button"
              className={`${styles.button} ${styles.buttonPrimary}`}
              onClick={() => void saveParsedItems()}
              disabled={isSaving}
            >
              {isSaving ? "Сохраняем..." : "Добавить"}
            </button>
          ) : (
            <button
              type="button"
              className={`${styles.button} ${styles.buttonPrimary}`}
              onClick={handleProcessClick}
              disabled={isParsing || isSaving}
            >
              {isParsing ? "Обработка..." : "Обработать"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};

