## ADDED Requirements

### Requirement: Android receipt scanning is reachable from operations

Android users SHALL be able to start receipt scanning from the operations tab
without going through profile/settings.

#### Scenario: Start receipt scan from operations

- **GIVEN** an authenticated Android user is on the operations list
- **WHEN** the user taps the receipt scan action
- **THEN** the app opens the receipt tools screen
- **AND** the user can choose a photo or take a photo
- **AND** analysis starts immediately after image selection
- **AND** the parsed draft opens for review before saving

### Requirement: Android VK ID login recovers from native callback failures

Android VK ID login SHALL avoid endless loading when the native SDK does not
return an access token.

#### Scenario: Native VK ID returns a recoverable failure

- **GIVEN** the native VK ID module is available
- **WHEN** native login times out, returns code-only completion, or fails before
  producing an access token
- **THEN** the app starts the browser PKCE VK ID flow
- **AND** a successful browser flow continues to the existing backend
  `/auth/vkid` request

#### Scenario: User cancels VK ID

- **GIVEN** the user cancels VK ID authorization
- **WHEN** the cancellation reaches the app
- **THEN** the app stops loading
- **AND** shows a readable cancellation message
- **AND** does not silently start another authorization loop

#### Scenario: Android browser auth session gets stuck

- **GIVEN** Android VK ID browser authorization has been started
- **WHEN** the provider returns to the app too late, the custom tab remains open,
  or the next attempt reports that authorization is already in progress
- **THEN** the app treats the stale in-progress state as recoverable provider
  state, closes the current auth session when the local timeout/error path runs,
  and allows the user to start VK ID authorization again without reinstalling or
  force-stopping the app

#### Scenario: Android VK ID redirects back to the installed APK

- **GIVEN** Android starts the browser PKCE VK ID flow
- **WHEN** the app builds the VK authorization URL
- **THEN** the redirect URI uses the VK mobile scheme
  `vk<client_id>://vk.ru/blank.html`
- **AND** the same redirect URI is used for the code-to-token exchange
- **AND** Android can route the provider callback back to the installed APK
