## 1. Specification

- [x] 1.1 Capture production failure modes and desired QR/OCR behavior in OpenSpec.
- [x] 1.2 Update durable receipt recognition docs with partial OCR/runtime diagnostics.

## 2. Backend

- [x] 2.1 Preserve OCR runtime errors as HTTP 503 `receipt_ocr_unavailable`.
- [x] 2.2 Return review drafts for amount-positive partial OCR results.
- [x] 2.3 Add missing-field metadata and warnings for partial OCR.
- [x] 2.4 Improve amount scoring for totals on adjacent lines.
- [x] 2.5 Add receipt-specific proxy timeouts to reduce 499 disconnects.

## 3. Verification

- [x] 3.1 Add parser tests for partial OCR and adjacent-line totals.
- [x] 3.2 Add orchestration test for OCR runtime unavailable.
- [x] 3.3 Run focused backend tests.
- [x] 3.4 Run diff sanity checks and document runtime/deploy risk.
  - `openspec validate receipt-recognition-hardening --strict` could not run because `openspec` is not installed in PATH.
