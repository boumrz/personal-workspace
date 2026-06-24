import React, { useCallback, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Drawer,
  Input,
  InputNumber,
  Select,
  Space,
  Tag,
  message,
} from "antd";
import {
  CameraOutlined,
  FileImageOutlined,
  ReconciliationOutlined,
  ScanOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useFinance, type Category } from "../context/FinanceContext";
import {
  parseReceiptPhoto,
  type ParsedTransactionDraft,
} from "../services/transactionTools";
import * as styles from "./TransactionDataTools.module.css";

interface TransactionDataToolsProps {
  activeTab: "actual" | "planned";
  triggerClassName?: string;
  triggerLabel?: string;
}

interface DraftState {
  items: ParsedTransactionDraft[];
  warnings: string[];
  confidence?: number;
  unparsedText?: string;
}

interface ReceiptDraftEdit {
  amount: string;
  description: string;
  date: string;
  category: string;
}

function parseDraftAmount(value: string) {
  const normalized = String(value || "").replace(/\s+/g, "").replace(",", ".");
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100) / 100;
}

function normalizeText(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-zа-я0-9\s-]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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

function resolveCategoryByNameFromList(
  rawName: string,
  transactionType: "income" | "expense",
  categories: Category[]
): Category | null {
  const hint = normalizeText(rawName);
  if (!hint) return null;

  const exact = categories.find(
    (category) =>
      normalizeText(category.name) === hint && categoryMatchesTransactionType(category, transactionType)
  );
  if (exact) return exact;

  const fuzzy = categories.find((category) => {
    const categoryName = normalizeText(category.name);
    return (
      categoryMatchesTransactionType(category, transactionType) &&
      (categoryName.includes(hint) || hint.includes(categoryName))
    );
  });
  return fuzzy ?? null;
}

function getAvailableCategories(
  categories: Category[],
  transactionType: "income" | "expense"
) {
  return categories
    .filter((category) => categoryMatchesTransactionType(category, transactionType))
    .sort((a, b) => {
      if (a.name === "Другое") return 1;
      if (b.name === "Другое") return -1;
      return a.name.localeCompare(b.name, "ru");
    });
}

function resolveInitialCategoryName(
  item: ParsedTransactionDraft,
  categories: Category[]
) {
  const hint = item.categoryHint ?? item.suggestedCategoryToCreate ?? "";
  if (hint) {
    const match = resolveCategoryByNameFromList(hint, item.type, categories);
    if (match) return match.name;
  }

  const other = categories.find((category) => category.name === "Другое");
  if (other && categoryMatchesTransactionType(other, item.type)) {
    return other.name;
  }

  return getAvailableCategories(categories, item.type)[0]?.name ?? "";
}

function safeDate(value?: string) {
  const parsed = value ? dayjs(value) : null;
  if (parsed && parsed.isValid()) {
    return parsed.format("YYYY-MM-DD");
  }
  return dayjs().format("YYYY-MM-DD");
}

function buildDraftEdits(
  items: ParsedTransactionDraft[],
  categories: Category[]
): ReceiptDraftEdit[] {
  return items.map((item) => ({
    amount: String(item.amount),
    description: item.description?.trim() || "",
    date: safeDate(item.date),
    category: resolveInitialCategoryName(item, categories),
  }));
}

export const TransactionDataTools: React.FC<TransactionDataToolsProps> = ({
  triggerClassName,
  triggerLabel = "Чеки",
}) => {
  const { categories, addTransaction } = useFinance();
  const [open, setOpen] = useState(false);
  const [receiptParsing, setReceiptParsing] = useState(false);
  const [savingReceipt, setSavingReceipt] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptState, setReceiptState] = useState<DraftState | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [receiptDraftEdits, setReceiptDraftEdits] = useState<ReceiptDraftEdit[]>([]);
  const receiptGalleryInputRef = useRef<HTMLInputElement | null>(null);
  const receiptCameraInputRef = useRef<HTMLInputElement | null>(null);

  const closeDrawer = useCallback(() => {
    setOpen(false);
  }, []);

  const resolveCategoryByName = useCallback(
    (rawName: string, transactionType: "income" | "expense" = "expense") =>
      resolveCategoryByNameFromList(rawName, transactionType, categories),
    [categories]
  );

  const parseReceiptFile = useCallback(async (file: File) => {
    setReceiptParsing(true);
    setReceiptError(null);
    setReceiptState(null);
    setReceiptDraftEdits([]);
    try {
      const response = await parseReceiptPhoto(file);
      const items = Array.isArray(response.items) ? response.items : [];
      setReceiptState({
        items,
        warnings: Array.isArray(response.warnings) ? response.warnings : [],
        confidence: response.confidence,
        unparsedText: response.unparsedText,
      });
      setReceiptDraftEdits(buildDraftEdits(items, categories));
      message.success("Чек распознан. Проверьте черновики перед сохранением.");
    } catch (error: any) {
      const errorMessage = error?.message ?? "Не удалось распознать чек.";
      setReceiptError(errorMessage);
      message.error(errorMessage);
    } finally {
      setReceiptParsing(false);
    }
  }, [categories]);

  const handleReceiptFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] || null;
      setReceiptFile(file);
      setReceiptState(null);
      setReceiptError(null);
      setReceiptDraftEdits([]);
      if (file) {
        void parseReceiptFile(file);
      }
    },
    [parseReceiptFile]
  );

  const saveReceiptDrafts = useCallback(async () => {
    if (!receiptState?.items.length) return;

    setSavingReceipt(true);
    try {
      let saved = 0;
      let skipped = 0;

      for (let index = 0; index < receiptState.items.length; index += 1) {
        const item = receiptState.items[index];
        const edit = receiptDraftEdits[index];
        const amount = parseDraftAmount(edit?.amount ?? String(item.amount));
        const description = edit?.description?.trim() || item.description?.trim() || "Операция по чеку";
        const date = safeDate(edit?.date || item.date);
        const categoryName = edit?.category?.trim() ?? "";

        if (!amount || !categoryName) {
          skipped += 1;
          continue;
        }

        const category = resolveCategoryByName(categoryName, item.type);
        if (!category) {
          skipped += 1;
          continue;
        }

        await addTransaction({
          type: item.type,
          amount,
          description,
          date,
          category,
        });
        saved += 1;
      }

      message.success(`Чек сохранен: сохранено ${saved}, пропущено ${skipped}.`);
      setReceiptState(null);
      setReceiptDraftEdits([]);
      setReceiptFile(null);
      setReceiptError(null);
      if (receiptGalleryInputRef.current) {
        receiptGalleryInputRef.current.value = "";
      }
      if (receiptCameraInputRef.current) {
        receiptCameraInputRef.current.value = "";
      }
    } finally {
      setSavingReceipt(false);
    }
  }, [addTransaction, receiptDraftEdits, receiptState, resolveCategoryByName]);

  const updateReceiptDraftEdit = useCallback(
    (index: number, patch: Partial<ReceiptDraftEdit>) => {
      setReceiptDraftEdits((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], ...patch };
        return next;
      });
    },
    []
  );

  const renderDraftList = () => {
    if (!receiptState || receiptState.items.length === 0) {
      return (
        <Alert
          type="info"
          showIcon
          message="После распознавания фото чека появятся черновики операций."
          description="Вы сможете проверить сумму, дату и категорию перед сохранением."
        />
      );
    }

    return (
      <Space direction="vertical" size={12} className={styles.stack}>
        <div className={styles.summaryRow}>
          <Tag color="blue">{receiptState.items.length} черновиков</Tag>
          {Number.isFinite(Number(receiptState.confidence)) && (
            <Tag color="gold">Уверенность {Math.round((receiptState.confidence || 0) * 100)}%</Tag>
          )}
        </div>

        {receiptState.warnings?.length ? (
          <Alert
            type="warning"
            showIcon
            message="Есть предупреждения"
            description={
              <Space direction="vertical" size={4}>
                {receiptState.warnings.map((warning) => (
                  <span key={warning}>{warning}</span>
                ))}
              </Space>
            }
          />
        ) : null}

        {receiptState.unparsedText ? (
          <Alert
            type="warning"
            showIcon
            message="Остался нераспознанный текст"
            description={receiptState.unparsedText}
          />
        ) : null}

        <Space direction="vertical" size={10} className={styles.stack}>
          {receiptState.items.map((item, index) => {
            const edit = receiptDraftEdits[index];
            const categoryName = edit?.category?.trim() || "";
            const category = categoryName ? resolveCategoryByName(categoryName, item.type) : null;
            const draftDate = safeDate(edit?.date || item.date);
            const availableCategories = getAvailableCategories(categories, item.type);
            return (
              <Card key={`${item.type}-${item.amount}-${index}`} size="small" className={styles.draftCard}>
                <div className={styles.draftHeader}>
                  <div>
                    <div className={styles.draftTitle}>Операция {index + 1}</div>
                    <div className={styles.draftMeta}>
                      <Tag color={item.type === "income" ? "green" : "red"}>
                        {item.type === "income" ? "Доход" : "Расход"}
                      </Tag>
                      {category ? <Tag color="green">{category.name}</Tag> : null}
                    </div>
                  </div>
                </div>

                <div className={styles.draftFields}>
                  <div className={styles.draftField}>
                    <div className={styles.draftFieldLabel}>Описание</div>
                    <Input
                      value={edit?.description ?? ""}
                      onChange={(event) => updateReceiptDraftEdit(index, { description: event.target.value })}
                      placeholder="Описание операции"
                      allowClear
                    />
                  </div>

                  <div className={styles.draftField}>
                    <div className={styles.draftFieldLabel}>Сумма</div>
                    <InputNumber
                      className={styles.draftAmountInput}
                      min={0.01}
                      precision={2}
                      decimalSeparator=","
                      value={parseDraftAmount(edit?.amount ?? "") ?? undefined}
                      onChange={(value) =>
                        updateReceiptDraftEdit(index, {
                          amount: value != null ? String(value) : "",
                        })
                      }
                      addonAfter="₽"
                    />
                  </div>

                  <div className={styles.draftField}>
                    <div className={styles.draftFieldLabel}>Дата</div>
                    <DatePicker
                      className={styles.draftDatePicker}
                      allowClear={false}
                      value={dayjs(draftDate)}
                      format="DD.MM.YYYY"
                      onChange={(value) =>
                        updateReceiptDraftEdit(index, {
                          date: value ? value.format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD"),
                        })
                      }
                    />
                  </div>

                  <div className={styles.draftField}>
                    <div className={styles.draftFieldLabel}>Категория</div>
                    <Select
                      className={styles.draftCategorySelect}
                      value={edit?.category || undefined}
                      placeholder="Выберите категорию"
                      onChange={(value) => updateReceiptDraftEdit(index, { category: value })}
                      options={availableCategories.map((entry) => ({
                        label: entry.name,
                        value: entry.name,
                      }))}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </Space>
      </Space>
    );
  };

  return (
    <>
      <div className={styles.launchToggleWrap}>
        <button
          type="button"
          data-testid="data-tools-open-button"
          onClick={() => setOpen(true)}
          className={[styles.launchToggleButton, triggerClassName].filter(Boolean).join(" ")}
          aria-label={triggerLabel}
          title={triggerLabel}
        >
          <ReconciliationOutlined />
          {!triggerClassName && <span>{triggerLabel}</span>}
        </button>
      </div>

      <Drawer
        open={open}
        onClose={closeDrawer}
        footer={null}
        width={960}
        destroyOnClose={false}
        rootClassName={styles.drawer}
        className={styles.drawer}
        title={
          <div className={styles.drawerTitleWrap}>
            <div className={styles.drawerTitle}>Распознавание чеков</div>
            <div className={styles.drawerSubtitle}>Загрузите фото чека и сохраните черновик операции.</div>
          </div>
        }
      >
        <div className={styles.toolPanel}>
          <div className={styles.flow}>
            <div className={styles.panelHeader}>
              <div className={styles.panelIcon}>
                <ScanOutlined />
              </div>
              <div>
                <div className={styles.panelTitle}>Фото чека</div>
                <div className={styles.panelText}>
                  Загрузите снимок чека, чтобы найти QR-код или фискальные поля и получить черновик операции.
                </div>
              </div>
            </div>

            <Space direction="vertical" size={12} className={styles.stack}>
              <div className={styles.receiptInputControls}>
                <input
                  ref={receiptGalleryInputRef}
                  data-testid="receipt-gallery-file-input"
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handleReceiptFileChange}
                />
                <input
                  ref={receiptCameraInputRef}
                  data-testid="receipt-camera-file-input"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={handleReceiptFileChange}
                />
                <div className={styles.fileActionsGrid}>
                  <Button
                    icon={<FileImageOutlined />}
                    onClick={() => receiptGalleryInputRef.current?.click()}
                    className={styles.secondaryAction}
                    disabled={receiptParsing}
                    block
                  >
                    Выбрать фото
                  </Button>
                  <Button
                    icon={<CameraOutlined />}
                    onClick={() => receiptCameraInputRef.current?.click()}
                    className={styles.secondaryAction}
                    disabled={receiptParsing}
                    block
                  >
                    Сделать снимок
                  </Button>
                </div>
              </div>

              {receiptParsing ? (
                <Alert
                  type="info"
                  showIcon
                  message="Ищу QR-код чека"
                  description="Фото загружено, выполняется локальный анализ."
                />
              ) : !receiptFile && !receiptState ? (
                <Alert
                  type="info"
                  showIcon
                  message="Фото чека еще не выбрано"
                  description="Сфотографируйте чек или выберите изображение из галереи."
                />
              ) : null}

              {receiptError ? (
                <Alert
                  data-testid="receipt-error-alert"
                  type="error"
                  showIcon
                  message="Не удалось распознать чек"
                  description={receiptError}
                />
              ) : null}

              {receiptError && receiptFile ? (
                <Button
                  type="primary"
                  icon={<ScanOutlined />}
                  loading={receiptParsing}
                  onClick={() => void parseReceiptFile(receiptFile)}
                  className={styles.primaryAction}
                  block
                >
                  Повторить распознавание
                </Button>
              ) : null}

              {renderDraftList()}

              {receiptState?.items?.length ? (
                <Button
                  type="primary"
                  icon={<UploadOutlined />}
                  loading={savingReceipt}
                  onClick={() => void saveReceiptDrafts()}
                  block
                >
                  Сохранить операции
                </Button>
              ) : null}
            </Space>
          </div>
        </div>
      </Drawer>
    </>
  );
};

export default TransactionDataTools;
