## ADDED Requirements

### Requirement: Receipt Recognition Implementation Inventory

The project SHALL maintain a current receipt recognition inventory that names
the authoritative backend, web, mobile, shared contract, test, and runtime files.

#### Scenario: Agent prepares a receipt-recognition change

- **GIVEN** an agent is asked to change receipt recognition
- **WHEN** it performs SDD/OpenSpec triage
- **THEN** it SHALL read the receipt inventory spec before making assumptions
- **AND** it SHALL preserve the backend as the source of truth for QR/OCR parsing.

### Requirement: Local QR-First Recognition

Receipt recognition SHALL run through local QR decoding first, then local OCR
fallback only for QR-not-found or QR-unreadable cases.

#### Scenario: QR decodes successfully

- **GIVEN** the uploaded receipt image contains a valid fiscal QR payload
- **WHEN** `/api/v2/transactions/receipt/parse` processes the image
- **THEN** the response SHALL contain `receiptMeta.source = "qr"`
- **AND** OCR/LLM fallback SHALL NOT be used for the draft.

#### Scenario: QR is decoded but invalid

- **GIVEN** a QR payload is decoded but lacks required fiscal fields
- **WHEN** the endpoint processes the payload
- **THEN** the response SHALL fail with `receipt_qr_invalid`
- **AND** OCR SHALL NOT override the invalid structured QR data.

### Requirement: No Fabrication From Non-Image Inputs

The parser SHALL NOT infer amount, date, operation type, description, or fiscal
metadata from filename, upload id, MIME metadata, or request metadata.

#### Scenario: Numeric filename has no readable receipt data

- **GIVEN** an uploaded image is named `1000014568.webp`
- **AND** QR/OCR do not provide required receipt fields
- **WHEN** receipt parsing completes
- **THEN** the endpoint SHALL return an error with no draft
- **AND** `1000014568` SHALL NOT become an amount.

### Requirement: Web And Android Parity

Web and Android SHALL expose equivalent receipt recognition behavior.

#### Scenario: Android user selects a receipt from gallery

- **GIVEN** the Android user is authenticated
- **WHEN** the user selects a receipt photo in the app
- **THEN** the app SHALL upload multipart form data to
  `/v2/transactions/receipt/parse`
- **AND** it SHALL navigate to the same review/save flow used for receipt drafts.

#### Scenario: Android user captures a receipt with camera

- **GIVEN** camera permission is granted
- **WHEN** the user captures a receipt photo
- **THEN** the app SHALL upload it immediately for analysis
- **AND** no browser round trip SHALL be required on Android.

### Requirement: Android Release Versioning

Every Android build intended for RuStore upload SHALL increment both semantic
app version and Android `versionCode`.

#### Scenario: Preparing a new RuStore build

- **GIVEN** receipt recognition or release behavior changed after the previous
  upload
- **WHEN** a new Android build is prepared
- **THEN** `mobile/package.json`, `mobile/package-lock.json`,
  `mobile/app.json` `expo.version`, and `expo.android.versionCode` SHALL be
  updated together.
