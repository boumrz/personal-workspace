const MAX_DEFAULT_SIZE_BYTES = 10 * 1024 * 1024;

function extractBoundary(contentType) {
  const value = String(contentType || "");
  const match = value.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!match) return null;
  return (match[1] || match[2] || "").trim();
}

function parseContentDisposition(value) {
  const result = {};
  const raw = String(value || "");
  const tokens = raw.split(";").map((token) => token.trim());
  for (const token of tokens) {
    const eq = token.indexOf("=");
    if (eq === -1) continue;
    const key = token.slice(0, eq).trim().toLowerCase();
    let val = token.slice(eq + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    result[key] = val;
  }
  return result;
}

function parsePartHeaders(text) {
  const headers = {};
  const lines = String(text || "").split("\r\n");
  for (const line of lines) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const name = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (name) headers[name] = value;
  }
  return headers;
}

async function readRequestBuffer(req, maxBytes) {
  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) {
      const error = new Error(`Payload too large. Max allowed size is ${maxBytes} bytes.`);
      error.statusCode = 413;
      throw error;
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

export async function parseMultipartForm(req, options = {}) {
  const maxBytes =
    Number.isFinite(Number(options.maxBytes)) && Number(options.maxBytes) > 0
      ? Number(options.maxBytes)
      : MAX_DEFAULT_SIZE_BYTES;
  const boundary = extractBoundary(req.headers["content-type"]);
  if (!boundary) {
    const error = new Error("Invalid multipart/form-data request: boundary is missing.");
    error.statusCode = 400;
    throw error;
  }

  const bodyBuffer = await readRequestBuffer(req, maxBytes);
  const bodyText = bodyBuffer.toString("latin1");
  const boundaryToken = `--${boundary}`;
  const rawParts = bodyText.split(boundaryToken).slice(1, -1);

  const fields = {};
  const files = {};

  for (const rawPart of rawParts) {
    let part = rawPart;
    if (part.startsWith("\r\n")) part = part.slice(2);
    if (part.endsWith("\r\n")) part = part.slice(0, -2);
    if (!part) continue;

    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;

    const headerText = part.slice(0, headerEnd);
    let payloadText = part.slice(headerEnd + 4);
    if (payloadText.endsWith("\r\n")) {
      payloadText = payloadText.slice(0, -2);
    }

    const headers = parsePartHeaders(headerText);
    const disposition = parseContentDisposition(headers["content-disposition"]);
    const fieldName = disposition.name;
    if (!fieldName) continue;

    const payloadBuffer = Buffer.from(payloadText, "latin1");
    const filename = disposition.filename;
    if (filename) {
      files[fieldName] = {
        fieldName,
        filename,
        mimeType: headers["content-type"] || "application/octet-stream",
        buffer: payloadBuffer,
        size: payloadBuffer.length,
      };
      continue;
    }

    fields[fieldName] = payloadBuffer.toString("utf8");
  }

  return { fields, files };
}

