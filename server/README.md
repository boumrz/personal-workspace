# Finance Assistant Server

Backend сервер для финансового помощника на Node.js, Express и PostgreSQL.

## Установка

1. Установите зависимости:
```bash
npm install
```

2. Создайте файл `.env` на основе `.env.example`:
```bash
cp .env.example .env
```

3. Настройте переменные окружения в `.env`:
```
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=finance_assistant
DB_USER=postgres
DB_PASSWORD=postgres
```

4. Убедитесь, что PostgreSQL запущен и создана база данных:
```bash
createdb finance_assistant
```

5. Запустите миграции для создания таблиц:
```bash
npm run migrate
```

6. Для распознавания QR-кодов и OCR-фолбэка чеков установите локальный
   Tesseract и Python-зависимости OpenCV/ZXing/pytesseract.

На macOS:
```bash
brew install tesseract tesseract-lang
```

Python-зависимости:
```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

И укажите Python из venv в `.env`:
```bash
RECEIPT_QR_PYTHON=.venv/bin/python
RECEIPT_OCR_READ_TIMEOUT_MS=30000
```

## Запуск

Для разработки (с автоматической перезагрузкой):
```bash
npm run dev
```

Для продакшена:
```bash
npm start
```

Сервер будет доступен на `http://localhost:3001`

## API Endpoints

### Transactions
- `GET /api/transactions` - Получить все транзакции
- `GET /api/transactions/:id` - Получить транзакцию по ID
- `POST /api/transactions` - Создать транзакцию
- `PUT /api/transactions/:id` - Обновить транзакцию
- `DELETE /api/transactions/:id` - Удалить транзакцию

### Planned Expenses
- `GET /api/planned-expenses` - Получить все планируемые траты
- `GET /api/planned-expenses/:id` - Получить планируемую трату по ID
- `POST /api/planned-expenses` - Создать планируемую трату
- `PUT /api/planned-expenses/:id` - Обновить планируемую трату
- `DELETE /api/planned-expenses/:id` - Удалить планируемую трату

### Categories
- `GET /api/categories` - Получить все категории
- `GET /api/categories/:id` - Получить категорию по ID

### Health Check
- `GET /api/health` - Проверка состояния сервера

## Структура базы данных

### Categories
- `id` (SERIAL PRIMARY KEY)
- `name` (VARCHAR)
- `color` (VARCHAR)
- `icon` (VARCHAR)
- `created_at` (TIMESTAMP)

### Transactions
- `id` (SERIAL PRIMARY KEY)
- `type` (VARCHAR) - 'income' или 'expense'
- `amount` (DECIMAL)
- `description` (TEXT)
- `date` (DATE)
- `category_id` (INTEGER, FK to categories)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### Planned Expenses
- `id` (SERIAL PRIMARY KEY)
- `amount` (DECIMAL)
- `description` (TEXT)
- `date` (DATE)
- `category_id` (INTEGER, FK to categories)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)
