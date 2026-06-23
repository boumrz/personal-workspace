import { spawn } from "node:child_process";
import config from "../config/config.js";

function decoderError(message, statusCode = 503, code = "receipt_qr_decoder_unavailable") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function parseDecoderOutput(stdout, exitCode) {
  const text = Buffer.concat(stdout).toString("utf8").trim();
  if (!text) {
    if (exitCode === 0) return null;
    throw decoderError("QR decoder failed without a readable response.");
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw decoderError("QR decoder returned an invalid response.");
  }

  if (parsed?.ok && typeof parsed.payload === "string" && parsed.payload.trim()) {
    return parsed.payload.trim();
  }

  if (parsed?.code === "receipt_qr_not_found") {
    return null;
  }

  if (parsed?.code === "receipt_qr_unreadable") {
    throw decoderError(
      typeof parsed?.error === "string" && parsed.error.trim()
        ? parsed.error.trim()
        : "QR-код чека найден, но не читается. Сфотографируйте QR крупнее, ровнее и без перекрывающего текста.",
      Number(parsed?.statusCode) || 422,
      "receipt_qr_unreadable"
    );
  }

  throw decoderError(
    typeof parsed?.error === "string" && parsed.error.trim()
      ? parsed.error.trim()
      : "QR decoder could not process the image.",
    Number(parsed?.statusCode) || 503,
    typeof parsed?.code === "string" ? parsed.code : "receipt_qr_decoder_unavailable"
  );
}

export function decodeReceiptQrFromImage({
  imageBuffer,
  pythonPath = config.receipt.qrPython,
  scriptPath = config.receipt.qrDecoderScript,
  timeoutMs = config.receipt.qrDecodeTimeoutMs,
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
      reject(decoderError("QR decoder timed out."));
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
      reject(decoderError(`QR decoder process could not start: ${error.message}`));
    });

    child.on("close", (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try {
        resolve(parseDecoderOutput(stdout, exitCode));
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
