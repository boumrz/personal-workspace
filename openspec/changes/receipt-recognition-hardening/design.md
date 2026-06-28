## Current Failure Modes

The endpoint `POST /api/v2/transactions/receipt/parse` can fail for distinct
reasons:

- `499`: the client closed the upload/parse request before the backend replied.
- `503`: the QR/OCR helper runtime or native dependencies are unavailable.
- `422`: QR/OCR completed but no acceptable receipt draft was produced.

The production API image already installs Python, OpenCV dependencies,
Tesseract, and `rus/eng` language packs. A production `503` therefore usually
means either the deployed container is stale, a helper cannot start, or the
runtime error is being hidden by orchestration.

## Backend Contract

The receipt parser remains deterministic:

1. Try QR image decoding.
2. If QR succeeds, parse fiscal QR and return `source = "qr"`.
3. If QR payload is decoded but invalid, fail with `receipt_qr_invalid`.
4. If QR is not found/unreadable, or the QR helper times out, run local OCR.
5. If OCR runtime is unavailable, fail with `receipt_ocr_unavailable` and HTTP
   503.
6. If OCR text contains a plausible image-derived amount, return a review draft
   even when fiscal date, FN, FD, FP, or operation type is missing.
7. If OCR cannot extract an amount from image text, fail with
   `receipt_ocr_not_found`.

Partial OCR drafts are intentionally review-only. They do not auto-save and they
carry warnings plus `receiptMeta.missingFiscalFields` for UI/debug visibility.

## Amount Extraction

Amount extraction must prioritize:

- explicit totals on the same line as `ITOG`, payment, or sum labels;
- numeric amount on the next line after such labels;
- product line totals and reconciled product sums.

The parser must continue ignoring operation dates, fiscal numbers, filenames,
upload IDs, MIME metadata, and request metadata as amount sources.

## Proxy Timeouts

Receipt parsing can spend time in upload buffering, QR variants, and OCR jobs.
The receipt endpoint therefore has explicit `proxy_read_timeout` and
`proxy_send_timeout` values of 180 seconds in the repository nginx configs.
Ordinary API routes keep their existing defaults.

## Testing

Backend tests should cover:

- partial OCR draft from a visible total with missing fiscal fields;
- amount on the line after a total label;
- rejection when no amount is present;
- `receipt_ocr_unavailable` is not converted to a generic 422.
