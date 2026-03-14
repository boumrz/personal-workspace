# Финансовый помощник — Android (React Native + Expo)

Мобильное приложение использует тот же backend, что и веб-версия. Shared-пакет (`../shared`) содержит общие типы и API-клиент.

## Как запустить (пошагово)

### 1. Установить зависимости

В корне репозитория уже должны быть установлены зависимости для веб-приложения. Для мобильного приложения:

```bash
cd mobile
npm install
```

(Пакет `@finance-assistant/shared` подтянется из `../shared`.)

### 2. Запустить backend

API должен быть доступен по адресу, указанному в `mobile/src/constants/config.ts` (по умолчанию `http://localhost:3001/api`).

```bash
# из корня репозитория
cd server
npm run dev
```

Оставьте этот терминал открытым.

### 3. Запустить приложение на Android

**Вариант A: эмулятор Android**

1. Установите [Android Studio](https://developer.android.com/studio) и создайте виртуальное устройство (AVD).
2. Запустите эмулятор.
3. В папке `mobile` выполните:

```bash
cd mobile
npm run android
```

Expo соберёт приложение и откроет его в эмуляторе. Если backend на хосте, в эмуляторе Android используйте `http://10.0.2.2:3001/api` вместо `localhost:3001` (в `src/constants/config.ts` задайте `EXPO_PUBLIC_API_URL=http://10.0.2.2:3001/api` или измените константу).

**Вариант B: физическое устройство (телефон по Wi‑Fi, ПК в той же сети)**

1. Установите [Expo Go](https://play.google.com/store/apps/details?id=host.exp.exponent) с Google Play.
2. Узнайте IP компьютера в локальной сети (например `192.168.1.122`: `ipconfig` → IPv4 адаптера Ethernet/Wi‑Fi).
3. Разрешите в брандмауэре Windows входящие подключения по TCP на порты **8081**, **19000**, **19001** (частная сеть).
4. В папке `mobile` запустите с явным хостом (подставьте свой IP и порт backend):

```powershell
$env:REACT_NATIVE_PACKAGER_HOSTNAME="192.168.1.122"
$env:EXPO_PUBLIC_API_URL="http://192.168.1.122:3001/api"
npx expo start
```

5. Отсканируйте QR-код в Expo Go. Убедитесь, что телефон и компьютер в одной сети.

**Проверка доступа:** в браузере на телефоне откройте `http://<IP_ПК>:8081`. Если страница не открывается — скорее всего блокирует брандмауэр (см. п. 3).

### 4. Проверить, что всё работает

- Открывается экран с текстом «Финансовый помощник (Android)» и «Shared package connected...».
- После добавления экранов входа — логин/регистрация идут через ваш backend.

## Сборка AAB/APK для RuStore

- **Через EAS Build (рекомендуется):** зарегистрируйтесь на [expo.dev](https://expo.dev), выполните `npx eas build --platform android --profile production` в папке `mobile`. Подписанный AAB будет доступен в личном кабинете.
- **Локально:** нужны Android Studio и настроенный keystore; в папке `mobile`: `npx expo run:android --variant release`.
- **Безопасность секретов:** не храните production значения в `eas.json` и в репозитории. Для CI используйте GitHub Secrets: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_VK_ID_APP_ID`, `EXPO_PUBLIC_VK_ID_REDIRECT_SCHEME`, `EXPO_PUBLIC_MYTRACKER_SDK_KEY`, `EXPO_PUBLIC_SPEECH_PARSE_PROVIDER`, `EXPO_TOKEN`.

## Структура

- `App.tsx` — корневой компонент (далее сюда подключатся навигация и экраны).
- `src/constants/config.ts` — базовый URL API.
- `src/screens/` — экраны (логин, дашборд, транзакции и т.д.).
- `src/components/` — переиспользуемые компоненты.
- `src/context/` — контексты (авторизация и т.п.).
- Общие типы и API — в пакете `@finance-assistant/shared` (папка `../shared`).
