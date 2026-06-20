# Changelog

Все значимые изменения в проекте документируются в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/),
версионирование следует [Semantic Versioning](https://semver.org/lang/ru/).

## [Unreleased]

### Added.

- **Авторизация через Telegram** — вход и регистрация через Telegram Login Widget
- **Авторизация через VK ID** — вход и регистрация через VK ID OAuth 2.0
- **Привязка аккаунтов в профиле** — возможность привязать или отвязать Telegram и VK от учётной записи
- **Установка пароля** — пользователи, зарегистрированные через соцсети, могут добавить пароль для входа по логину
- **API endpoints**:
  - `GET /api/auth/telegram/bot-id` — получение bot_id для мобильного flow
  - `POST /api/auth/telegram` — вход/регистрация через Telegram
  - `POST /api/auth/vkid` — вход/регистрация через VK ID
  - `POST /api/profile/link/telegram` — привязка Telegram
  - `POST /api/profile/unlink/telegram` — отвязка Telegram
  - `POST /api/profile/link/vkid` — привязка VK ID
  - `POST /api/profile/unlink/vk` — отвязка VK
  - `POST /api/profile/set-password` — установка пароля
- **База данных** — колонки `telegram_id` и `vk_id` в таблице `users`, уникальные индексы
- **Компоненты** — `TelegramLinkButton`, `VKIdWidget`
- **Конфигурация** — `.env.example` с переменными `VITE_TELEGRAM_BOT_USERNAME`, `VITE_VK_ID_APP_ID`, `TELEGRAM_BOT_TOKEN`, `VK_ID_APP_ID`
- **VK ID callback** — страница `vk-id-callback.html` для OAuth redirect flow
- **Android (mobile): единый свайп-действий для карточек** — в разделах «Операции» и «Накопления» добавлен единый паттерн `свайп влево` с действиями `Изменить` и `Удалить`
- **Android (mobile): удаление из экрана редактирования** — на экране редактирования операции добавлена кнопка удаления с подтверждением
- **Android (mobile): быстрый вход в редактирование** — тап по карточке операции/накопления открывает режим редактирования
- **Android (mobile): full-swipe удаление** — добавлено удаление одним глубоким свайпом с подтверждением через модальное окно

### Changed

- **Страница входа** — добавлены кнопки «Войти через Telegram» и «Войти через VK»
- **Страница профиля** — секция «Привязанные аккаунты», модальное окно «Добавить пароль»
- **Профиль API** — в ответ добавлены `telegramId`, `vkId`, `hasPassword`, `authMethodsCount`
- **API URL** — исправлена работа `DefinePlugin` для корректной подстановки базового URL API в dev-режиме
- **Миграции** — загрузка `.env` из корня проекта
- **Стили** — обновления UI компонентов (Login, Dashboard, Profile, TransactionForm, PlannedExpenses и др.)
- **CI/CD** — обновлён workflow деплоя
- **Зависимости** — добавлены `@telegram-auth/react`, `@vkid/sdk`
- **Android (mobile): UX свайпа** — переработаны анимации и пороги свайпа для более плавного управления карточкой «под пальцем»
- **Android (mobile): поведение списка** — при открытии новой карточки через свайп предыдущая автоматически закрывается
- **Android (mobile): визуальная индикация удаления** — deep-swipe сопровождается прогрессивной подсветкой зоны удаления и текстом «Отпустите для удаления»

### Removed

- **DEPLOY.md** — документация по деплою удалена (инструкции перенесены в другие источники)

### Fixed

- **API запросы** — запросы в dev-режиме теперь корректно идут на `http://127.0.0.1:3001/api` при запуске сервера на порту 3001
- **Миграция БД** — корректное разрешение пути к `.env` при запуске migrate
- **Стили** — исправления отображения форм, навигации и адаптивности
- **Android build (EAS): npm peer deps** — добавлен флаг `NPM_CONFIG_LEGACY_PEER_DEPS=true` для production-профилей сборки, чтобы устранить падение `npm ci` на peer-конфликте `@mytracker/react-native-mytracker`

---

_Изменения с 7 февраля 2026 (c2ecd90) по 23 февраля 2026_
