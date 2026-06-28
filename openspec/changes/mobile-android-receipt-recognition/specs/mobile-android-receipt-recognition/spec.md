## ADDED Requirements

### Requirement: Android receipt recognition uses native image input
The Android mobile app SHALL let an authenticated user choose a receipt photo
from the gallery or capture a receipt photo with the camera without opening a
browser upload page.

#### Scenario: Gallery photo starts recognition in app
- **WHEN** an authenticated Android user taps "Выбрать фото" and selects an image
- **THEN** the app uploads that image to the shared receipt parse endpoint and stays in the mobile app

#### Scenario: Camera photo starts recognition in app
- **WHEN** an authenticated Android user taps "Сделать снимок" and accepts a captured image
- **THEN** the app uploads that image to the shared receipt parse endpoint and stays in the mobile app

### Requirement: Mobile receipt upload uses the shared backend contract
The Android mobile app MUST upload receipt images to
`POST /v2/transactions/receipt/parse` as multipart form data using the same
backend QR-first/OCR fallback recognition contract as the web app.

#### Scenario: Upload request includes receipt image field
- **WHEN** Android uploads a selected or captured receipt image
- **THEN** the multipart body contains the image under the receipt file field accepted by the backend

#### Scenario: Successful parse opens review
- **WHEN** the backend returns receipt draft items
- **THEN** the mobile app opens the existing import review screen with the parsed drafts, warnings, confidence, and receipt metadata

### Requirement: Android receipt recognition handles recoverable input states
The Android mobile app SHALL handle permission denial, user cancellation, network
failure, and server parse errors without losing app navigation state.

#### Scenario: User cancels image selection
- **WHEN** the gallery or camera picker returns a cancelled result
- **THEN** the app does not navigate to review and does not show a parse error

#### Scenario: Camera permission is denied
- **WHEN** Android denies camera permission before capture
- **THEN** the app shows an actionable permission error and does not call the receipt parse endpoint

#### Scenario: Server rejects receipt parse
- **WHEN** the backend returns a non-2xx receipt parse response
- **THEN** the app shows the server error text in an alert and keeps the user on the data tools screen

### Requirement: Unsupported platforms keep the existing fallback
The receipt import service MUST keep the browser/deep-link upload bridge for web
and unsupported native platforms.

#### Scenario: Web platform uses existing DOM upload path
- **WHEN** the mobile bundle runs on web
- **THEN** receipt import still uses the existing DOM file input upload path

#### Scenario: Unsupported native platform uses browser bridge
- **WHEN** native image picking is unavailable for the current platform
- **THEN** the app opens the existing browser upload bridge instead of failing immediately
