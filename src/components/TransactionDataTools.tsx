import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Drawer,
  Input,
  Segmented,
  Space,
  Tag,
  message,
} from "antd";
import {
  CameraOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  FileImageOutlined,
  InboxOutlined,
  ReconciliationOutlined,
  ScanOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useFinance } from "../context/FinanceContext";
import {
  exportTransactionsToExcel,
  importTransactionsFromExcel,
  parseReceiptPhoto,
  type ParsedTransactionDraft,
  type TransactionsExportScope,
  type TransactionsTargetMode,
} from "../services/transactionTools";
import * as styles from "./TransactionDataTools.module.css";

type ToolTab = "export" | "import" | "receipt";

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

function normalizeText(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-zа-я0-9\s-]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function capitalize(value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function safeDate(value?: string, fallbackMode: TransactionsTargetMode = "actual") {
  const parsed = value ? dayjs(value) : null;
  if (parsed && parsed.isValid()) {
    return parsed.format("YYYY-MM-DD");
  }
  if (fallbackMode === "planned") {
    return dayjs().startOf("month").format("YYYY-MM-DD");
  }
  return dayjs().format("YYYY-MM-DD");
}

function categoryMatchesTransactionType(
  category: { name: string; type?: "income" | "expense" | "both" },
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

function formatDate(value?: string) {
  const parsed = value ? dayjs(value) : null;
  if (parsed && parsed.isValid()) {
    return parsed.format("DD.MM.YYYY");
  }
  return "Дата не указана";
}

function createDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "transactions-export.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const transactionModes: Array<{ label: string; value: TransactionsTargetMode }> = [
  { label: "Актуальные", value: "actual" },
  { label: "Плановые", value: "planned" },
];

export const TransactionDataTools: React.FC<TransactionDataToolsProps> = ({
  activeTab,
  triggerClassName,
  triggerLabel = "Файлы и чеки",
}) => {
  const { categories, addCategory, addTransaction, addPlannedExpense } = useFinance();
  const [open, setOpen] = useState(false);
  const [activeExcelPanel, setActiveExcelPanel] = useState<ToolTab>("export");
  const [exportScope, setExportScope] = useState<TransactionsExportScope>("all");
  const [importTarget, setImportTarget] = useState<TransactionsTargetMode>(activeTab);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [receiptParsing, setReceiptParsing] = useState(false);
  const [savingImport, setSavingImport] = useState(false);
  const [savingReceipt, setSavingReceipt] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [importState, setImportState] = useState<DraftState | null>(null);
  const [receiptState, setReceiptState] = useState<DraftState | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [importCategoryDrafts, setImportCategoryDrafts] = useState<string[]>([]);
  const [receiptCategoryDrafts, setReceiptCategoryDrafts] = useState<string[]>([]);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const receiptGalleryInputRef = useRef<HTMLInputElement | null>(null);
  const receiptCameraInputRef = useRef<HTMLInputElement | null>(null);

  const openTool = useCallback(
    (tool: ToolTab) => {
      setOpen(true);
      setActiveExcelPanel(tool);

      if (tool === "export") {
        setExportScope(activeTab);
      }
      if (tool === "import") {
        setImportTarget(activeTab);
      }
    },
    [activeTab]
  );

  const closeDrawer = useCallback(() => {
    setOpen(false);
  }, []);

  const resolveCategoryByName = useCallback(
    (rawName: string, transactionType: "income" | "expense" = "expense") => {
      const hint = normalizeText(rawName);
      if (!hint) return null;

      const exact = categories.find(
        (category) => normalizeText(category.name) === hint && categoryMatchesTransactionType(category, transactionType)
      );
      if (exact) return exact;

      const fuzzy = categories.find((category) => {
        const categoryName = normalizeText(category.name);
        return categoryMatchesTransactionType(category, transactionType) && (categoryName.includes(hint) || hint.includes(categoryName));
      });
      return fuzzy ?? null;
    },
    [categories]
  );

  const prepareTransactionDate = useCallback((item: ParsedTransactionDraft, target: TransactionsTargetMode) => {
    return safeDate(item.date, target);
  }, []);

  const parseReceiptFile = useCallback(async (file: File) => {
    setReceiptParsing(true);
    setReceiptError(null);
    setReceiptState(null);
    setReceiptCategoryDrafts([]);
    try {
      const response = await parseReceiptPhoto(file);
      const items = Array.isArray(response.items) ? response.items : [];
      setReceiptState({
        items,
        warnings: Array.isArray(response.warnings) ? response.warnings : [],
        confidence: response.confidence,
        unparsedText: response.unparsedText,
      });
      setReceiptCategoryDrafts(items.map((item) => item.suggestedCategoryToCreate || item.categoryHint || ""));
      message.success("Чек распознан. Проверьте черновики перед сохранением.");
    } catch (error: any) {
      const errorMessage = error?.message ?? "Не удалось распознать чек.";
      setReceiptError(errorMessage);
      message.error(errorMessage);
    } finally {
      setReceiptParsing(false);
    }
  }, []);

  const handleReceiptFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] || null;
      setReceiptFile(file);
      setReceiptState(null);
      setReceiptError(null);
      setReceiptCategoryDrafts([]);
      if (file) {
        void parseReceiptFile(file);
      }
    },
    [parseReceiptFile]
  );

  const parseItems = useCallback(
    async (kind: "import" | "receipt") => {
      if (kind === "import") {
        if (!importFile) {
          message.warning("Сначала выберите Excel-файл.");
          return;
        }
        setImporting(true);
        try {
          const response = await importTransactionsFromExcel(importFile, importTarget);
          const items = Array.isArray(response.items) ? response.items : [];
          setImportState({
            items,
            warnings: Array.isArray(response.warnings) ? response.warnings : [],
            confidence: response.confidence,
            unparsedText: response.unparsedText,
          });
          setImportCategoryDrafts(items.map((item) => item.suggestedCategoryToCreate || item.categoryHint || ""));
          message.success("Excel разобран. Проверьте черновики перед сохранением.");
        } catch (error: any) {
          message.error(error?.message ?? "Не удалось разобрать Excel.");
        } finally {
          setImporting(false);
        }
        return;
      }

      if (!receiptFile) {
        message.warning("Сначала выберите фото чека.");
        return;
      }
      await parseReceiptFile(receiptFile);
    },
    [importFile, importTarget, parseReceiptFile, receiptFile]
  );

  const saveDrafts = useCallback(
    async (
      items: ParsedTransactionDraft[],
      drafts: string[],
      target: TransactionsTargetMode,
      setSaving: (value: boolean) => void,
      defaultDescription: string,
      onSuccess: (saved: number, created: number, skipped: number) => void
    ) => {
      setSaving(true);
      try {
        const createdCategories = new Map<
          string,
          { id: string; name: string; color: string; icon: string; type?: "income" | "expense" | "both" }
        >();
        let saved = 0;
        let created = 0;
        let skipped = 0;

        for (let index = 0; index < items.length; index += 1) {
          const item = items[index];
          const fallbackName = drafts[index]?.trim() || item.suggestedCategoryToCreate || item.categoryHint || "";
          const normalizedName = normalizeText(fallbackName);
          const transactionType = target === "planned" ? ("expense" as const) : item.type;
          let category = resolveCategoryByName(fallbackName, transactionType) || createdCategories.get(normalizedName) || null;

          if (!category && fallbackName) {
            category = await addCategory({
              name: capitalize(fallbackName),
              color: "#4A9ED6",
              icon: "Tag",
              type: transactionType,
            });
            createdCategories.set(normalizedName, category);
            created += 1;
          }

          if (!category) {
            skipped += 1;
            continue;
          }

          const payload = {
            type: target === "planned" ? ("expense" as const) : item.type,
            amount: item.amount,
            description: item.description?.trim() || defaultDescription,
            date: prepareTransactionDate(item, target),
            category,
          };

          if (target === "planned") {
            await addPlannedExpense(payload);
          } else {
            await addTransaction(payload);
          }
          saved += 1;
        }

        onSuccess(saved, created, skipped);
      } finally {
        setSaving(false);
      }
    },
    [addCategory, addPlannedExpense, addTransaction, prepareTransactionDate, resolveCategoryByName]
  );

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const { blob, filename } = await exportTransactionsToExcel(exportScope);
      createDownload(blob, filename);
      message.success(`Excel-файл ${filename} готов к скачиванию.`);
    } catch (error: any) {
      message.error(error?.message ?? "Не удалось экспортировать Excel.");
    } finally {
      setExporting(false);
    }
  }, [exportScope]);

  const exportTab = (
    <div className={styles.flow}>
      <div className={styles.panelHeader}>
        <div className={styles.panelIcon}>
          <FileExcelOutlined />
        </div>
        <div>
          <div className={styles.panelTitle}>Экспорт в Excel</div>
          <div className={styles.panelText}>
            Сформируйте файл с операциями, сводкой, категориями и графиками для отчёта или личного архива.
          </div>
        </div>
      </div>

      <Space direction="vertical" size={12} className={styles.stack}>
        <div>
          <div className={styles.sectionLabel}>Что попадет в файл</div>
          <div className={styles.chipRow}>
            <Tag color="blue">Операции</Tag>
            <Tag color="green">Сводка</Tag>
            <Tag color="orange">Категории</Tag>
            <Tag color="purple">Графики</Tag>
          </div>
        </div>

        <div>
          <div className={styles.sectionLabel}>Область экспорта</div>
          <Segmented
            value={exportScope}
            onChange={(value) => setExportScope(value as TransactionsExportScope)}
            options={[
              { label: "Все", value: "all" },
              { label: "Актуальные", value: "actual" },
              { label: "Плановые", value: "planned" },
            ]}
            block
            className={styles.segmented}
          />
        </div>

        <Alert
          type="info"
          showIcon
          message="После выгрузки файл начнется скачиваться автоматически."
        />

        <Button
          type="primary"
          icon={<DownloadOutlined />}
          loading={exporting}
          onClick={() => void handleExport()}
          className={styles.primaryAction}
          block
        >
          Скачать Excel
        </Button>
      </Space>
    </div>
  );

  const renderDraftList = (
    state: DraftState | null,
    drafts: string[],
    onDraftChange: (index: number, value: string) => void,
    target: TransactionsTargetMode,
    emptyText: string
  ) => {
    if (!state || state.items.length === 0) {
      return (
        <Alert
          type="info"
          showIcon
          message={emptyText}
          description="После разбора вы увидите черновики операций и сможете сразу сохранить их в приложение."
        />
      );
    }

    return (
      <Space direction="vertical" size={12} className={styles.stack}>
        <div className={styles.summaryRow}>
          <Tag color="blue">{state.items.length} черновиков</Tag>
          {Number.isFinite(Number(state.confidence)) && (
            <Tag color="gold">Уверенность {Math.round((state.confidence || 0) * 100)}%</Tag>
          )}
        </div>

        {state.warnings?.length ? (
          <Alert
            type="warning"
            showIcon
            message="Есть предупреждения"
            description={
              <Space direction="vertical" size={4}>
                {state.warnings.map((warning) => (
                  <span key={warning}>{warning}</span>
                ))}
              </Space>
            }
          />
        ) : null}

        {state.unparsedText ? (
          <Alert
            type="warning"
            showIcon
            message="Остался нераспознанный текст"
            description={state.unparsedText}
          />
        ) : null}

        <Space direction="vertical" size={10} className={styles.stack}>
          {state.items.map((item, index) => {
            const categoryName = drafts[index]?.trim() || item.suggestedCategoryToCreate || item.categoryHint || "";
            const category = categoryName ? resolveCategoryByName(categoryName, target === "planned" ? "expense" : item.type) : null;
            const amountLabel = new Intl.NumberFormat("ru-RU", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }).format(item.amount);
            return (
              <Card key={`${item.type}-${item.amount}-${index}`} size="small" className={styles.draftCard}>
                <div className={styles.draftHeader}>
                  <div>
                    <div className={styles.draftTitle}>{item.description?.trim() || `Операция ${index + 1}`}</div>
                    <div className={styles.draftMeta}>
                      <Tag color={item.type === "income" ? "green" : "red"}>
                        {item.type === "income" ? "Доход" : target === "planned" ? "План" : "Расход"}
                      </Tag>
                      <Tag color="blue">₽ {amountLabel}</Tag>
                      <Tag color="gold">{formatDate(item.date)}</Tag>
                    </div>
                  </div>
                  <Tag color={category ? "green" : "orange"}>
                    {category ? category.name : "Категория не распознана"}
                  </Tag>
                </div>

                {!category && (
                  <div className={styles.categoryInputWrap}>
                    <Input
                      value={drafts[index] || ""}
                      onChange={(event) => onDraftChange(index, event.target.value)}
                      placeholder="Введите категорию"
                      allowClear
                    />
                  </div>
                )}
              </Card>
            );
          })}
        </Space>
      </Space>
    );
  };

  const importTab = (
    <div className={styles.flow}>
      <div className={styles.panelHeader}>
        <div className={styles.panelIcon}>
          <UploadOutlined />
        </div>
        <div>
          <div className={styles.panelTitle}>Импорт из Excel</div>
          <div className={styles.panelText}>
            Загрузите таблицу, проверьте найденные операции и сохраните только подходящие черновики.
          </div>
        </div>
      </div>

      <Space direction="vertical" size={12} className={styles.stack}>
        <div>
          <div className={styles.sectionLabel}>Куда импортировать</div>
          <Segmented
            value={importTarget}
            onChange={(value) => setImportTarget(value as TransactionsTargetMode)}
            options={transactionModes}
            block
            className={styles.segmented}
          />
        </div>

        <div className={styles.fileActionsGrid}>
          <input
            ref={importInputRef}
            data-testid="import-file-input"
            type="file"
            accept=".xlsx,.xls,.csv"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0] || null;
              setImportFile(file);
              setImportState(null);
              if (file) {
                message.info(`Выбран файл: ${file.name}`);
              }
            }}
          />
          <Button
            icon={<InboxOutlined />}
            onClick={() => importInputRef.current?.click()}
            className={styles.secondaryAction}
            block
          >
            Выбрать файл
          </Button>
          <Button
            type="primary"
            icon={<FileExcelOutlined />}
            loading={importing}
            disabled={!importFile}
            onClick={() => void parseItems("import")}
            className={styles.primaryAction}
            block
          >
            Разобрать Excel
          </Button>
        </div>

        {importFile ? (
          <Alert
            type="success"
            showIcon
            message="Файл готов к разбору"
            description={importFile.name}
          />
        ) : (
          <Alert
            type="info"
            showIcon
            message="Excel-файл еще не выбран"
            description="Поддерживаются .xlsx, .xls и .csv."
          />
        )}

        {renderDraftList(
          importState,
          importCategoryDrafts,
          (index, value) =>
            setImportCategoryDrafts((prev) => {
              const next = [...prev];
              next[index] = value;
              return next;
            }),
          importTarget,
          "После разбора появятся черновики из Excel."
        )}

        {importState?.items?.length ? (
          <Button
            type="primary"
            icon={<UploadOutlined />}
            loading={savingImport}
            onClick={() =>
              void saveDrafts(
                importState.items,
                importCategoryDrafts,
                importTarget,
                setSavingImport,
                "Импорт из Excel",
                (saved, created, skipped) => {
                  message.success(
                    `Импорт завершен: сохранено ${saved}, создано категорий ${created}, пропущено ${skipped}.`
                  );
                  setImportState(null);
                  setImportCategoryDrafts([]);
                  setImportFile(null);
                  if (importInputRef.current) {
                    importInputRef.current.value = "";
                  }
                }
              )
            }
            block
          >
            Импортировать черновики
          </Button>
        ) : null}
      </Space>
    </div>
  );

  const receiptTab = (
    <div className={styles.flow}>
      <div className={styles.panelHeader}>
        <div className={styles.panelIcon}>
          <ScanOutlined />
        </div>
        <div>
          <div className={styles.panelTitle}>Фото чека</div>
          <div className={styles.panelText}>
            Загрузите снимок чека, чтобы найти QR-код и превратить сумму с датой в черновик операции.
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
            description="Фото загружено, выполняется локальный анализ QR."
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
            onClick={() => void parseItems("receipt")}
            className={styles.primaryAction}
            block
          >
            Повторить распознавание
          </Button>
        ) : null}

        {renderDraftList(
          receiptState,
          receiptCategoryDrafts,
          (index, value) =>
            setReceiptCategoryDrafts((prev) => {
              const next = [...prev];
              next[index] = value;
              return next;
            }),
          "actual",
          "После распознавания фото чека появятся черновики операций."
        )}

        {receiptState?.items?.length ? (
          <Button
            type="primary"
            icon={<UploadOutlined />}
            loading={savingReceipt}
            onClick={() =>
              void saveDrafts(
                receiptState.items,
                receiptCategoryDrafts,
                "actual",
                setSavingReceipt,
                "Операция по чеку",
                (saved, created, skipped) => {
                  message.success(
                    `Чек сохранен: сохранено ${saved}, создано категорий ${created}, пропущено ${skipped}.`
                  );
                  setReceiptState(null);
                  setReceiptCategoryDrafts([]);
                  setReceiptFile(null);
                  setReceiptError(null);
                  if (receiptGalleryInputRef.current) {
                    receiptGalleryInputRef.current.value = "";
                  }
                  if (receiptCameraInputRef.current) {
                    receiptCameraInputRef.current.value = "";
                  }
                }
              )
            }
            block
          >
            Сохранить операции
          </Button>
        ) : null}
      </Space>
    </div>
  );

  const toolOptions = useMemo(
    () => [
      {
        key: "export" as const,
        icon: <FileExcelOutlined />,
        title: "Скачать Excel",
        text: "Отчёт, операции и графики",
      },
      {
        key: "import" as const,
        icon: <UploadOutlined />,
        title: "Загрузить таблицу",
        text: "Импорт операций из файла",
      },
      {
        key: "receipt" as const,
        icon: <ScanOutlined />,
        title: "Распознать чек",
        text: "Фото покупок в черновики",
      },
    ],
    []
  );

  const activeContent =
    activeExcelPanel === "export"
      ? exportTab
      : activeExcelPanel === "import"
        ? importTab
        : receiptTab;

  return (
    <>
      <div className={styles.launchToggleWrap}>
        <button
          type="button"
          data-testid="data-tools-open-button"
          onClick={() => openTool("export")}
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
            <div className={styles.drawerTitle}>Файлы и чеки</div>
            <div className={styles.drawerSubtitle}>Импорт, экспорт и распознавание покупок.</div>
          </div>
        }
      >
        <div className={styles.drawerIntro}>
          <div className={styles.drawerIntroIcon}>
            <ReconciliationOutlined />
          </div>
          <div className={styles.drawerIntroCopy}>
            <div className={styles.drawerIntroTitle}>Здесь можно быстро перенести данные</div>
            <div className={styles.drawerIntroText}>
              Скачайте отчёт в Excel, загрузите таблицу с операциями или распознайте фото чека. Все найденные операции сначала попадают в черновики и сохраняются только после подтверждения.
            </div>
          </div>
        </div>

        <div className={styles.toolSwitch} role="tablist" aria-label="Действия с файлами и чеками">
          {toolOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              role="tab"
              aria-selected={activeExcelPanel === option.key}
              className={`${styles.toolChoice} ${activeExcelPanel === option.key ? styles.toolChoiceActive : ""}`}
              onClick={() => openTool(option.key)}
            >
              <span className={styles.toolChoiceIcon}>{option.icon}</span>
              <span className={styles.toolChoiceCopy}>
                <span className={styles.toolChoiceTitle}>{option.title}</span>
                <span className={styles.toolChoiceText}>{option.text}</span>
              </span>
            </button>
          ))}
        </div>

        <div className={styles.toolPanel}>{activeContent}</div>
      </Drawer>
    </>
  );
};

export default TransactionDataTools;
