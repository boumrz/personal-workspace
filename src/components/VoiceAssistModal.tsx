import React, { useState, useCallback } from "react";
import { Modal, Spin, Input, message } from "antd";
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

export const VoiceAssistModal: React.FC<VoiceAssistModalProps> = ({
  open,
  onClose,
}) => {
  const { addTransaction, addCategory } = useFinance();
  const { data: categories = [] } = useGetCategoriesQuery(undefined, {
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

  const today = new Date().toISOString().slice(0, 10);

  const resolveCategoryByName = useCallback(
    (rawName: string): Category | null => {
      if (categories.length === 0) return null;
      const hint = normalize(rawName);
      if (hint) {
        const exact = categories.find((c) => normalize(c.name) === hint);
        if (exact) return exact;
        const fuzzy = categories.find((c) => {
          const categoryName = normalize(c.name);
          return categoryName.includes(hint) || hint.includes(categoryName);
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
      return resolveCategoryByName(source);
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

  const resetVoiceFlow = useCallback(() => {
    speechRecognitionService.abort();
    setIsListening(false);
    setIsParsing(false);
    setIsSaving(false);
    setTranscript("");
    setParseWarnings([]);
    setParsedItems([]);
    setCategoryDrafts([]);
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

        await addTransaction({
          type: item.type,
          amount: item.amount,
          description: item.description || "Голосовая операция",
          date: item.date || today,
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
      styles={{ body: { maxHeight: "70vh", overflowY: "auto" } }}
    >
      <div className={styles.content}>
        <h3 className={styles.title}>Голосовой помощник</h3>
        <p className={styles.description}>
          Добавляйте доходы и расходы голосом. Продиктуйте сумму и описание —
          например: «Потратил 500 рублей на кофе» или «Получил 3000 зарплата».
        </p>
        <div className={styles.voiceUpgradeHint}>
          <span className={styles.voiceUpgradeHintText}>
            Для полного доступа к голосовому помощнику обратитесь к разработчику.
          </span>
        </div>
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
                    {item.description || "Без описания"}
                  </div>
                  <div className={styles.parsedItemMeta}>
                    Категория: {category?.name ?? "Не определена"}
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
