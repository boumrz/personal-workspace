# Finance Assistant

Финансовый помощник для управления доходами и расходами.

## Возможности

- 📊 Дашборд с визуализацией финансов
- 💰 Управление транзакциями
- 📅 Планирование расходов
- 🏷️ Категории с иконками и цветами
- 👤 Аутентификация пользователей
- 📱 Адаптивный дизайн

## Технологии

### Frontend
- React 18
- TypeScript
- Ant Design
- Chart.js
- React Router

### Backend
- Node.js
- Express.js
- PostgreSQL
- JWT Authentication

## Разработка

### Требования
- Node.js 18+
- PostgreSQL 14+

### Установка

1. Клонируйте репозиторий
2. Установите зависимости:

```bash
npm install
cd server
npm install
```

3. Настройте базу данных (см. `server/.env.example`)
4. Запустите миграции:

```bash
cd server
npm run migrate
```

5. Запустите dev-серверы:

```bash
# Backend (в папке server)
npm run dev

# Frontend (в корне проекта)
npm run dev
```

## Деплой

### Автоматический деплой (рекомендуется)

Проект настроен для автоматического деплоя при пуше в репозиторий:

- **Фронтенд** автоматически деплоится на GitHub Pages
- **Бэкенд** автоматически деплоится на удаленный сервер через SSH
- **Миграции** запускаются автоматически при необходимости

📚 **Быстрый старт:** [`QUICK_SETUP.md`](./QUICK_SETUP.md)  
📖 **Подробная инструкция:** [`SETUP_INSTRUCTIONS.md`](./SETUP_INSTRUCTIONS.md)  
🔧 **Документация по автоматизации:** [`DEPLOY_AUTOMATION.md`](./DEPLOY_AUTOMATION.md)

### Ручной деплой

Подробная инструкция по ручному развертыванию находится в файле [DEPLOY.md](./DEPLOY.md).

## Лицензия

MIT

## Security & Deploy docs

- Secrets inventory and setup: `docs/GITHUB_SECRETS.md`
- Backend compatibility/rollback guide: `docs/DEPLOYMENT_COMPATIBILITY.md`
