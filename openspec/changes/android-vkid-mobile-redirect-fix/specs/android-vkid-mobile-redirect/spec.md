## ADDED Requirements

### Requirement: Android VK ID Uses VK Mobile Redirect

Android VK ID browser authorization SHALL use the VK mobile redirect URI
`vk<client_id>://vk.ru/blank.html`.

#### Scenario: Android starts VK ID authorization

- **GIVEN** the Android app starts VK ID login or account linking
- **WHEN** it builds the authorization request
- **THEN** the redirect URI SHALL be `vk<client_id>://vk.ru/blank.html`
- **AND** the same redirect URI SHALL be used during code-to-token exchange.

### Requirement: Android VK ID Does Not Depend On Native SDK Startup

Android VK ID login/linking SHALL not fail before the browser PKCE redirect flow
when the native VK SDK cannot start.

#### Scenario: Native SDK is unavailable or cannot open

- **GIVEN** the native VK SDK module is missing, stale, or unable to open VK ID
- **WHEN** the user taps VK ID login or linking
- **THEN** the app SHALL start the browser PKCE VK ID flow
- **AND** the flow SHALL redirect back through the VK mobile scheme.
