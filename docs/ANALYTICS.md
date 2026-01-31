# Аналитика Finance Assistant

Описание настройки аналитики для веб-версии и мобильного приложения Android.

## Веб-версия

Используется **Яндекс.Метрика** (счётчик подключён в `index.html`).

- **ID счётчика:** 106310112
- Включены: webvisor, clickmap, accurateTrackBounce, trackLinks
- Настройка и просмотр отчётов: [metrika.yandex.ru](https://metrika.yandex.ru)

Дополнительно при желании можно отправлять ключевые события на backend (POST `/api/analytics/event`) для единого учёта с мобильным приложением — веб-код при этом не менялся в рамках текущего плана.

## Мобильное приложение (Android)

Используется **собственный backend**: события отправляются на `POST /api/analytics/event`.

### События

| Событие           | Описание                          |
|-------------------|-----------------------------------|
| `app_open`        | Запуск приложения                  |
| `login_success`   | Успешный вход                     |
| `register_success`| Успешная регистрация             |
| `logout`          | Выход из аккаунта                 |
| `screen_view`     | Просмотр экрана (параметр `screen_name`) |

### Формат запроса

- **URL:** `{API_BASE_URL}/analytics/event`
- **Метод:** POST
- **Headers:** `Content-Type: application/json`, при авторизации — `Authorization: Bearer <token>`
- **Body:** `{ "event": string, "platform": "android", ...params }`

При наличии токена в заголовке в таблицу записывается `user_id` (для привязки событий к пользователю).

### База данных

Таблица `analytics_events` создаётся миграцией (`server/src/database/migrate.js`):

- `id`, `event`, `platform`, `user_id` (nullable), `payload` (JSONB), `created_at`

Миграция выполняется при запуске: `npm run migrate` в папке `server`.

### Примеры запросов для отчётов

- Количество запусков приложения по дням:
  `SELECT date(created_at), count(*) FROM analytics_events WHERE event = 'app_open' AND platform = 'android' GROUP BY date(created_at);`
- Уникальные пользователи по платформе:
  `SELECT platform, count(DISTINCT user_id) FROM analytics_events WHERE user_id IS NOT NULL GROUP BY platform;`

## Политика конфиденциальности

Сбор аналитики описан в [PRIVACY_POLICY.md](./PRIVACY_POLICY.md): обезличенные данные для улучшения работы приложения.
