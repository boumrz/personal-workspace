## Why

Production receipt parsing currently fails in several different ways that look
the same to a user: QR decode may fail, OCR runtime may be unavailable, and the
OCR parser may reject a receipt even when a visible total was extracted. Logs
from 2026-06-28 show `499`, `503`, and `422` responses for the same endpoint.

The critical product issue is that users cannot reliably turn a readable receipt
photo into a review draft. The system must remain local-first and QR-first, but
it should not discard useful OCR-derived amount data merely because all fiscal
fields were not recognized.

## What Changes

- Preserve QR-first parsing and keep invalid decoded QR payloads as hard errors.
- Surface OCR runtime failures as `receipt_ocr_unavailable` with HTTP 503.
- Allow partial OCR review drafts when the amount is image-derived but some
  fiscal fields are missing.
- Add structured receipt metadata for missing OCR fields and partial source.
- Improve amount candidate scoring for totals printed on the line after `ITOG`.
- Treat QR decoder timeout as recoverable and continue to OCR.
- Add receipt-specific proxy timeouts to reduce client disconnects during
  long QR/OCR processing.
- Extend backend tests for partial OCR, amount extraction, and unavailable OCR.
- Update the durable receipt recognition spec so future agents do not re-invent
  this behavior.

## Impact

- Backend receipt orchestration and OCR parser behavior.
- Backend tests for receipt parsing.
- Documentation/specs for receipt recognition.
- No database schema change.
- No LLM, FNS, filename, or metadata inference is introduced.
