## ADDED Requirements

### Requirement: Receipt OCR Runtime Diagnostics

The receipt parser SHALL distinguish OCR runtime failures from content parsing
failures.

#### Scenario: OCR helper cannot run

- **GIVEN** QR recognition did not produce a usable receipt payload
- **AND** the OCR helper process reports `receipt_ocr_unavailable`
- **WHEN** `/api/v2/transactions/receipt/parse` handles the receipt
- **THEN** the endpoint SHALL return HTTP 503
- **AND** the response code SHALL be `receipt_ocr_unavailable`
- **AND** the runtime error SHALL NOT be converted to `receipt_ocr_not_found`.

### Requirement: Partial OCR Review Drafts

The receipt parser SHALL return a review draft when OCR extracts a plausible
image-derived amount even if some fiscal fields are missing.

#### Scenario: Amount is visible but fiscal metadata is incomplete

- **GIVEN** QR recognition did not produce a usable receipt payload
- **AND** OCR text contains a total amount from the receipt image
- **AND** OCR misses one or more of operation date/time, FN, FD, FP, or
  operation type
- **WHEN** the parser processes the OCR text
- **THEN** the endpoint SHALL return a draft for explicit user review
- **AND** `receiptMeta.source` SHALL be `ocr_partial`
- **AND** `receiptMeta.missingFiscalFields` SHALL list the missing fields
- **AND** the response warnings SHALL explain that the draft requires review.

### Requirement: No Amount Fabrication

The receipt parser SHALL NOT create a receipt draft without an amount extracted
from image text.

#### Scenario: OCR text lacks a plausible amount

- **GIVEN** QR recognition did not produce a usable receipt payload
- **AND** OCR text has no plausible total or product amount
- **WHEN** receipt parsing completes
- **THEN** the endpoint SHALL fail with `receipt_ocr_not_found`
- **AND** no draft SHALL be returned.

### Requirement: Adjacent-Line Total Recognition

The OCR amount parser SHALL recognize totals printed on the line after a total
label.

#### Scenario: Receipt prints total label and amount on separate lines

- **GIVEN** OCR text contains a line with `ITOG` or equivalent total/payment
  label
- **AND** the next line contains a currency amount
- **WHEN** the OCR parser extracts amount candidates
- **THEN** the next-line amount SHALL be preferred over unrelated numeric
  values.

### Requirement: QR Timeout Fallback

The receipt parser SHALL treat QR decoder timeout as a recoverable QR failure.

#### Scenario: QR helper times out but OCR can read amount

- **GIVEN** the QR helper returns `receipt_qr_decoder_unavailable` because it
  timed out
- **WHEN** OCR can extract a plausible amount from image text
- **THEN** the endpoint SHALL return an OCR or partial OCR review draft
- **AND** the QR timeout SHALL NOT prevent OCR fallback.

### Requirement: Receipt Endpoint Proxy Budget

Deployment nginx configs SHALL provide a larger timeout budget for receipt
image parsing than ordinary JSON API requests.

#### Scenario: Receipt upload requires QR and OCR work

- **GIVEN** a receipt image is uploaded to `/api/v2/transactions/receipt/parse`
- **WHEN** parsing takes longer than a normal API request
- **THEN** repository nginx configs SHALL keep the proxy read/send timeout high
  enough for QR and OCR helpers to complete under normal conditions.
