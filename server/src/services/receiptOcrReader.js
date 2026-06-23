import { spawn } from "node:child_process";
import config from "../config/config.js";

function ocrError(message, statusCode = 503, code = "receipt_ocr_unavailable") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function parseOcrOutput(stdout, exitCode) {
  const text = Buffer.concat(stdout).toString("utf8").trim();
  if (!text) {
    if (exitCode === 0) return null;
    throw ocrError("OCR reader failed without a readable response.");
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw ocrError("OCR reader returned an invalid response.");
  }

  if (parsed?.ok && typeof parsed.text === "string" && parsed.text.trim()) {
    return {
      text: parsed.text.trim(),
      engine: typeof parsed.engine === "string" && parsed.engine.trim() ? parsed.engine.trim() : "unknown",
      confidence: Number.isFinite(Number(parsed.confidence)) ? Number(parsed.confidence) : undefined,
    };
  }

  if (parsed?.code === "receipt_ocr_not_found") {
    return null;
  }

  throw ocrError(
    typeof parsed?.error === "string" && parsed.error.trim()
      ? parsed.error.trim()
      : "OCR reader could not process the image.",
    Number(parsed?.statusCode) || 503,
    typeof parsed?.code === "string" ? parsed.code : "receipt_ocr_unavailable"
  );
}

export function readReceiptOcrText({
  imageBuffer,
  pythonPath = config.receipt.qrPython,
  scriptPath = config.receipt.ocrReaderScript,
  timeoutMs = config.receipt.ocrReadTimeoutMs,
} = {}) {
  return new Promise((resolve, reject) => {
    if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
      resolve(null);
      return;
    }

    const child = spawn(pythonPath, [scriptPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(ocrError("OCR reader timed out."));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));

    child.stdin.on("error", () => {
      // The helper may close stdin early after reading the image buffer.
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(ocrError(`OCR reader process could not start: ${error.message}`));
    });

    child.on("close", (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try {
        resolve(parseOcrOutput(stdout, exitCode));
      } catch (error) {
        if (stderr.length > 0 && !error.message.includes("response")) {
          error.stderr = Buffer.concat(stderr).toString("utf8").slice(0, 500);
        }
        reject(error);
      }
    });

    child.stdin.end(imageBuffer);
  });
}
