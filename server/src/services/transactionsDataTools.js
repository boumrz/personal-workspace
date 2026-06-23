import { deflateRawSync } from "node:zlib";
import { parseTransactionsFromSpeech } from "./transactionSpeechParser.js";
import { parseFiscalQrPayload } from "./fiscalQrParser.js";
import { parseFiscalOcrText } from "./fiscalOcrParser.js";
import { decodeReceiptQrFromImage } from "./receiptQrDecoder.js";
import { readReceiptOcrText } from "./receiptOcrReader.js";

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function parseDecimal(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).replace(/\s+/g, "").replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100) / 100;
}

function normalizeDate(value) {
  const text = String(value || "").trim();
  if (!text) return null;

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const dotMatch = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dotMatch) {
    const dd = String(dotMatch[1]).padStart(2, "0");
    const mm = String(dotMatch[2]).padStart(2, "0");
    const yyyy = dotMatch[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(
    parsed.getDate()
  ).padStart(2, "0")}`;
}

function normalizeType(value, fallback = "expense") {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return fallback;
  if (["income", "доход", "in", "plus", "+"].includes(text)) return "income";
  if (["expense", "расход", "out", "minus", "-"].includes(text)) return "expense";
  if (/доход|зарплат|income|cashback|refund|\+/.test(text)) return "income";
  return "expense";
}

function splitCsvLine(line, delimiter) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === delimiter && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current);
  return values;
}

function parseDelimitedText(text) {
  const sanitized = String(text || "").replace(/\uFEFF/g, "").replace(/\r/g, "");
  const lines = sanitized
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const firstLine = lines[0];
  const candidates = [",", ";", "\t"];
  const delimiter =
    candidates
      .map((candidate) => ({ candidate, score: splitCsvLine(firstLine, candidate).length }))
      .sort((left, right) => right.score - left.score)[0]?.candidate || ",";

  const rows = lines.map((line) => splitCsvLine(line, delimiter).map((value) => value.trim()));
  const [header, ...body] = rows;
  const normalizedHeader = header.map((column) => column.toLowerCase());

  return body.map((row) => {
    const result = {};
    normalizedHeader.forEach((column, index) => {
      result[column] = row[index] ?? "";
    });
    return result;
  });
}

function parseSpreadsheetMl(text) {
  const source = String(text || "");
  const rowMatches = source.match(/<Row[\s\S]*?<\/Row>/gi) || [];
  const table = rowMatches.map((rowText) => {
    const cellMatches = rowText.match(/<Cell[\s\S]*?<\/Cell>/gi) || [];
    return cellMatches.map((cellText) => {
      const dataMatch = cellText.match(/<Data[^>]*>([\s\S]*?)<\/Data>/i);
      return dataMatch ? dataMatch[1].replace(/&#10;/g, "\n").replace(/&amp;/g, "&").trim() : "";
    });
  });
  if (table.length <= 1) return [];
  const [header, ...body] = table;
  const normalizedHeader = header.map((column) => String(column || "").toLowerCase().trim());
  return body.map((row) => {
    const result = {};
    normalizedHeader.forEach((column, index) => {
      result[column] = row[index] ?? "";
    });
    return result;
  });
}

function resolveSourceRows(file) {
  const filename = String(file?.filename || "").toLowerCase();
  const mimeType = String(file?.mimeType || "").toLowerCase();
  const text = file?.buffer?.toString("utf8") || "";

  if (filename.endsWith(".xml") || mimeType.includes("xml")) {
    return parseSpreadsheetMl(text);
  }
  if (filename.endsWith(".xls") && text.includes("<Workbook")) {
    return parseSpreadsheetMl(text);
  }
  if (filename.endsWith(".csv") || mimeType.includes("csv") || filename.endsWith(".txt")) {
    return parseDelimitedText(text);
  }
  if (filename.endsWith(".xlsx")) {
    const error = new Error(
      "Native .xlsx import currently requires conversion to CSV/XML in this environment. Please re-save as CSV and retry."
    );
    error.statusCode = 415;
    throw error;
  }

  return parseDelimitedText(text);
}

function resolveFieldValue(row, keys) {
  for (const key of keys) {
    const match = Object.keys(row).find((candidate) => candidate.includes(key));
    if (match) return row[match];
  }
  return "";
}

function buildRowText(row) {
  const values = Object.values(row || {})
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return values.join(" ");
}

function clampDrafts(items) {
  return items
    .map((item) => {
      const amount = parseDecimal(item?.amount);
      if (!Number.isFinite(amount) || amount <= 0) return null;
      return {
        type: normalizeType(item?.type),
        amount,
        description: String(item?.description || "").trim().slice(0, 160),
        categoryHint: String(item?.categoryHint || "").trim().slice(0, 80),
        categoryResolution:
          item?.categoryResolution === "matched_existing" ||
          item?.categoryResolution === "suggest_create" ||
          item?.categoryResolution === "unknown"
            ? item.categoryResolution
            : "unknown",
        suggestedCategoryToCreate: String(item?.suggestedCategoryToCreate || "")
          .trim()
          .slice(0, 80),
        date: normalizeDate(item?.date) || undefined,
        ...(Number.isFinite(Number(item?.confidence)) ? { confidence: Number(item.confidence) } : {}),
      };
    })
    .filter(Boolean);
}

export async function buildImportPreview({ file, targetMode, categories, timezone }) {
  const rawRows = resolveSourceRows(file);
  const warnings = [];
  const drafts = [];

  for (const row of rawRows) {
    const rowText = buildRowText(row);
    if (!rowText) continue;

    const amountRaw = resolveFieldValue(row, ["amount", "sum", "сумм"]);
    const dateRaw = resolveFieldValue(row, ["date", "дат"]);
    const typeRaw = resolveFieldValue(row, ["type", "тип"]);
    const categoryRaw = resolveFieldValue(row, ["category", "катег"]);
    const descriptionRaw = resolveFieldValue(row, ["description", "desc", "опис"]);

    let draft = {
      type: normalizeType(typeRaw, targetMode === "planned" ? "expense" : "expense"),
      amount: parseDecimal(amountRaw),
      description: String(descriptionRaw || rowText).trim().slice(0, 160),
      categoryHint: String(categoryRaw || "").trim().slice(0, 80),
      categoryResolution: "unknown",
      suggestedCategoryToCreate: "",
      date: normalizeDate(dateRaw) || undefined,
    };

    if (!Number.isFinite(draft.amount) || draft.amount <= 0 || !draft.categoryHint) {
      try {
        const llmResult = await parseTransactionsFromSpeech({
          text: rowText,
          mode: targetMode,
          categories,
          timezone,
        });
        const first = llmResult.items?.[0];
        if (first) {
          draft = {
            type: first.type === "income" ? "income" : "expense",
            amount: parseDecimal(first.amount),
            description: draft.description,
            categoryHint: String(first.categoryHint || draft.categoryHint || "").trim(),
            categoryResolution: first.categoryResolution || "unknown",
            suggestedCategoryToCreate: String(first.suggestedCategoryToCreate || "").trim(),
            date: normalizeDate(first.date || draft.date) || undefined,
          };
        }
      } catch (error) {
        warnings.push(`LLM parsing failed for one row: ${String(error?.message || error)}`);
      }
    }

    if (!Number.isFinite(draft.amount) || draft.amount <= 0) {
      warnings.push(`Skipped row without valid amount: "${rowText.slice(0, 80)}"`);
      continue;
    }

    if (!draft.categoryHint) {
      draft.categoryHint = "Other";
      draft.categoryResolution = "suggest_create";
      draft.suggestedCategoryToCreate = "Other";
    }

    if (!draft.date) {
      draft.date = targetMode === "planned" ? normalizeDate(new Date().toISOString().slice(0, 10)) : undefined;
    }

    drafts.push(draft);
  }

  const safeDrafts = clampDrafts(drafts).slice(0, 300);
  if (safeDrafts.length < drafts.length) {
    warnings.push("Import contains too many rows. Only first 300 valid rows were kept.");
  }

  return {
    source: "excel",
    title: "Excel Import Preview",
    warnings: warnings.slice(0, 20),
    drafts: safeDrafts,
  };
}

function summaryByMonth(transactions) {
  const map = new Map();
  for (const transaction of transactions) {
    const key = String(transaction.date || "").slice(0, 7) || "unknown";
    if (!map.has(key)) {
      map.set(key, { month: key, income: 0, expense: 0 });
    }
    const item = map.get(key);
    const amount = Number(transaction.amount) || 0;
    if (transaction.type === "income") {
      item.income += amount;
    } else {
      item.expense += amount;
    }
  }
  return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
}

function summaryByCategory(transactions) {
  const map = new Map();
  for (const transaction of transactions) {
    const key = transaction.category?.name || "Other";
    if (!map.has(key)) {
      map.set(key, { category: key, income: 0, expense: 0 });
    }
    const item = map.get(key);
    const amount = Number(transaction.amount) || 0;
    if (transaction.type === "income") {
      item.income += amount;
    } else {
      item.expense += amount;
    }
  }
  return Array.from(map.values()).sort((a, b) => b.expense - a.expense);
}

function buildExportSheets({ transactions, scopeLabel }) {
  const operationsRows = transactions.map((transaction) => ({
    Date: transaction.date,
    Mode: transaction.mode,
    Type: transaction.type,
    Category: transaction.category?.name || "",
    Description: transaction.description || "",
    Amount: Number(transaction.amount || 0).toFixed(2),
  }));

  const monthRows = summaryByMonth(transactions).map((item) => ({
    Month: item.month,
    Income: item.income.toFixed(2),
    Expense: item.expense.toFixed(2),
    Balance: (item.income - item.expense).toFixed(2),
  }));

  const categoryRows = summaryByCategory(transactions).map((item) => ({
    Category: item.category,
    Income: item.income.toFixed(2),
    Expense: item.expense.toFixed(2),
    Total: (item.income + item.expense).toFixed(2),
  }));

  const metaRows = [
    { Metric: "Scope", Value: scopeLabel },
    { Metric: "GeneratedAt", Value: new Date().toISOString() },
    { Metric: "Rows", Value: String(transactions.length) },
  ];

  return [
    {
      name: "Operations",
      columns: ["Date", "Mode", "Type", "Category", "Description", "Amount"],
      rows: operationsRows,
    },
    {
      name: "SummaryByMonth",
      columns: ["Month", "Income", "Expense", "Balance"],
      rows: monthRows,
    },
    {
      name: "SummaryByCategory",
      columns: ["Category", "Income", "Expense", "Total"],
      rows: categoryRows,
    },
    {
      name: "Meta",
      columns: ["Metric", "Value"],
      rows: metaRows,
    },
  ];
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let current = index;
    for (let bit = 0; bit < 8; bit += 1) {
      current = current & 1 ? 0xedb88320 ^ (current >>> 1) : current >>> 1;
    }
    table[index] = current >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function getDosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  return { dosDate, dosTime };
}

function createZipBuffer(files) {
  const localParts = [];
  const centralParts = [];
  const { dosDate, dosTime } = getDosDateTime();
  let offset = 0;

  for (const file of files) {
    const nameBuffer = Buffer.from(file.name, "utf8");
    const dataBuffer = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data, "utf8");
    const compressed = deflateRawSync(dataBuffer, { level: 6 });
    const checksum = crc32(dataBuffer);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(dataBuffer.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuffer, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(dataBuffer.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuffer);
    offset += localHeader.length + nameBuffer.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const localDirectory = Buffer.concat(localParts);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(files.length, 8);
  endOfCentralDirectory.writeUInt16LE(files.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(localDirectory.length, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  return Buffer.concat([localDirectory, centralDirectory, endOfCentralDirectory]);
}

function columnIndexToName(index) {
  let name = "";
  let current = index + 1;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }
  return name;
}

function sanitizeWorksheetName(name) {
  return String(name || "Sheet")
    .replace(/[\[\]:*?/\\]/g, " ")
    .slice(0, 31)
    .trim() || "Sheet";
}

function buildInlineStringCell(reference, value, styleId = 0) {
  const style = styleId ? ` s="${styleId}"` : "";
  return `<c r="${reference}"${style} t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`;
}

function buildNumberCell(reference, value) {
  return `<c r="${reference}" s="2"><v>${value}</v></c>`;
}

function buildXlsxWorksheet(columns, rows) {
  const normalizedRows = [Object.fromEntries(columns.map((column) => [column, column])), ...rows];
  const rowXml = normalizedRows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const cells = columns
        .map((column, columnIndex) => {
          const reference = `${columnIndexToName(columnIndex)}${rowNumber}`;
          const raw = row[column] ?? "";
          if (rowIndex > 0) {
            const asNumber = parseDecimal(raw);
            if (Number.isFinite(asNumber) && String(raw).trim() !== "" && !String(raw).match(/[^\d.,\- ]/)) {
              return buildNumberCell(reference, asNumber);
            }
          }
          return buildInlineStringCell(reference, raw, rowIndex === 0 ? 1 : 0);
        })
        .join("");
      return `<row r="${rowNumber}">${cells}</row>`;
    })
    .join("");

  const columnWidths = columns
    .map((column, index) => {
      const width = Math.min(
        38,
        Math.max(
          12,
          String(column).length + 2,
          ...rows.map((row) => String(row[column] ?? "").length + 2)
        )
      );
      return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
    })
    .join("");

  const lastCell = `${columnIndexToName(columns.length - 1)}${Math.max(rows.length + 1, 1)}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>${columnWidths}</cols>
  <sheetData>${rowXml}</sheetData>
  <autoFilter ref="A1:${lastCell}"/>
</worksheet>`;
}

function buildWorkbookXml(sheets) {
  const sheetNodes = sheets
    .map((sheet, index) => {
      return `<sheet name="${xmlEscape(sanitizeWorksheetName(sheet.name))}" sheetId="${index + 1}" r:id="rId${
        index + 1
      }"/>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheetNodes}</sheets>
</workbook>`;
}

function buildWorkbookRels(sheets) {
  const sheetRels = sheets
    .map((_, index) => {
      return `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${
        index + 1
      }.xml"/>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheetRels}
  <Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function buildContentTypes(sheets) {
  const sheetOverrides = sheets
    .map((_, index) => {
      return `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheetOverrides}
</Types>`;
}

function buildStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF2F75B5"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="3">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

export function buildExcelWorkbookXlsx({ transactions, scopeLabel }) {
  const sheets = buildExportSheets({ transactions, scopeLabel });
  const files = [
    { name: "[Content_Types].xml", data: buildContentTypes(sheets) },
    {
      name: "_rels/.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    { name: "xl/workbook.xml", data: buildWorkbookXml(sheets) },
    { name: "xl/_rels/workbook.xml.rels", data: buildWorkbookRels(sheets) },
    { name: "xl/styles.xml", data: buildStylesXml() },
    ...sheets.map((sheet, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      data: buildXlsxWorksheet(sheet.columns, sheet.rows),
    })),
  ];

  return createZipBuffer(files);
}

function buildSpreadsheetWorksheet(name, columns, rows) {
  const headerCells = columns
    .map((column) => `<Cell ss:StyleID="header"><Data ss:Type="String">${xmlEscape(column)}</Data></Cell>`)
    .join("");

  const bodyRows = rows
    .map((row) => {
      const cells = columns
        .map((column) => {
          const raw = row[column] ?? "";
          const asNumber = parseDecimal(raw);
          if (Number.isFinite(asNumber) && String(raw).trim() !== "" && !String(raw).match(/[^\d.,\- ]/)) {
            return `<Cell ss:StyleID="number"><Data ss:Type="Number">${asNumber}</Data></Cell>`;
          }
          return `<Cell><Data ss:Type="String">${xmlEscape(raw)}</Data></Cell>`;
        })
        .join("");
      return `<Row>${cells}</Row>`;
    })
    .join("");

  return `<Worksheet ss:Name="${xmlEscape(name)}"><Table><Row>${headerCells}</Row>${bodyRows}</Table></Worksheet>`;
}

export function buildExcelSpreadsheetXml({ transactions, scopeLabel }) {
  const operationsRows = transactions.map((transaction) => ({
    Date: transaction.date,
    Mode: transaction.mode,
    Type: transaction.type,
    Category: transaction.category?.name || "",
    Description: transaction.description || "",
    Amount: Number(transaction.amount || 0).toFixed(2),
  }));

  const monthRows = summaryByMonth(transactions).map((item) => ({
    Month: item.month,
    Income: item.income.toFixed(2),
    Expense: item.expense.toFixed(2),
    Balance: (item.income - item.expense).toFixed(2),
  }));

  const categoryRows = summaryByCategory(transactions).map((item) => ({
    Category: item.category,
    Income: item.income.toFixed(2),
    Expense: item.expense.toFixed(2),
    Total: (item.income + item.expense).toFixed(2),
  }));

  const metaRows = [
    { Metric: "Scope", Value: scopeLabel },
    { Metric: "GeneratedAt", Value: new Date().toISOString() },
    { Metric: "Rows", Value: String(transactions.length) },
  ];

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center" />
   <Font ss:FontName="Calibri" ss:Size="11"/>
  </Style>
  <Style ss:ID="header">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#2F75B5" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="number">
   <NumberFormat ss:Format="0.00"/>
  </Style>
 </Styles>
 ${buildSpreadsheetWorksheet("Operations", ["Date", "Mode", "Type", "Category", "Description", "Amount"], operationsRows)}
 ${buildSpreadsheetWorksheet("SummaryByMonth", ["Month", "Income", "Expense", "Balance"], monthRows)}
 ${buildSpreadsheetWorksheet("SummaryByCategory", ["Category", "Income", "Expense", "Total"], categoryRows)}
 ${buildSpreadsheetWorksheet("Meta", ["Metric", "Value"], metaRows)}
</Workbook>`;
}

function normalizeReceiptItems(items) {
  return clampDrafts(items).map((item) => ({
    ...item,
    date: normalizeDate(item.date) || undefined,
    categoryResolution: item.categoryResolution || "unknown",
  }));
}

function httpError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) {
    error.code = code;
  }
  return error;
}

function buildReceiptPreviewResult(parsed) {
  const items = normalizeReceiptItems([parsed.item]);
  const warnings = Array.isArray(parsed.warnings) ? parsed.warnings.slice(0, 20) : [];
  return {
    source: "receipt",
    title: "Receipt Parse Preview",
    warnings,
    drafts: items.slice(0, 60),
    confidence: parsed.confidence,
    receiptMeta: parsed.receiptMeta,
  };
}

function isRecoverableQrError(error) {
  return error?.code === "receipt_qr_not_found" || error?.code === "receipt_qr_unreadable";
}

function receiptOcrNotFoundError() {
  return httpError(
    "QR-код не прочитан, а OCR не смог извлечь фискальные реквизиты. Сфотографируйте нижнюю часть чека крупнее или введите операцию вручную.",
    422,
    "receipt_ocr_not_found"
  );
}

export async function buildReceiptPreview({
  imageFile,
  qrDecoder = decodeReceiptQrFromImage,
  ocrReader = readReceiptOcrText,
}) {
  const imagePayload = {
    imageBuffer: imageFile.buffer,
    filename: imageFile.filename,
    mimeType: imageFile.mimeType,
  };

  let qrFailure = null;
  try {
    const qrPayload = await qrDecoder(imagePayload);

    if (qrPayload) {
      const parsed = parseFiscalQrPayload(qrPayload);
      if (!parsed.ok) {
        throw httpError(parsed.error, 422, parsed.code);
      }
      return buildReceiptPreviewResult(parsed);
    }

    qrFailure = httpError(
      "QR-код чека не распознан. Попробуйте сфотографировать нижнюю часть чека крупнее или введите операцию вручную.",
      422,
      "receipt_qr_not_found"
    );
  } catch (error) {
    if (!isRecoverableQrError(error)) {
      if (error?.statusCode) {
        throw error;
      }
      qrFailure = httpError(
        "QR-код чека не распознан. Попробуйте сфотографировать нижнюю часть чека крупнее или введите операцию вручную.",
        422,
        "receipt_qr_not_found"
      );
    } else {
      qrFailure = error;
    }
  }

  try {
    const ocrResult = await ocrReader(imagePayload);
    if (!ocrResult?.text) {
      throw receiptOcrNotFoundError();
    }

    const parsed = parseFiscalOcrText(ocrResult.text, {
      engine: ocrResult.engine,
      confidence: ocrResult.confidence,
    });
    if (!parsed.ok) {
      throw httpError(parsed.error, 422, parsed.code);
    }

    return buildReceiptPreviewResult(parsed);
  } catch (error) {
    if (error?.code === "receipt_ocr_unavailable" && qrFailure?.statusCode) {
      throw receiptOcrNotFoundError();
    }
    if (error?.statusCode) {
      throw error;
    }
    throw receiptOcrNotFoundError();
  }
}
