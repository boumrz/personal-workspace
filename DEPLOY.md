# Инструкция по развертыванию Finance Assistant

## Требования

- Ubuntu 20.04+ или другой Linux сервер
- Node.js 18+ и npm
- PostgreSQL 14+
- Nginx
- PM2 (для управления Node.js процессами)
- SSL сертификат (Let's Encrypt)

## Шаг 1: Подготовка сервера

### 1.1 Обновление системы

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 Установка Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

### 1.3 Установка PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 1.4 Установка Nginx

```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 1.5 Установка PM2

```bash
sudo npm install -g pm2
```

## Шаг 2: Настройка базы данных

### 2.1 Создание базы данных и пользователя

```bash
sudo -u postgres psql
```

В PostgreSQL консоли:

```sql
CREATE DATABASE finance_assistant;
CREATE USER finance_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE finance_assistant TO finance_user;
\q
```

### 2.2 Настройка PostgreSQL для удаленного доступа (если нужно)

Отредактируйте `/etc/postgresql/14/main/postgresql.conf`:

```
listen_addresses = 'localhost'
```

И `/etc/postgresql/14/main/pg_hba.conf`:

```
host    finance_assistant    finance_user    127.0.0.1/32    md5
```

Перезапустите PostgreSQL:

```bash
sudo systemctl restart postgresql
```

## Шаг 3: Развертывание бэкенда

### 3.1 Клонирование репозитория

```bash
cd /var/www
sudo git clone <your-repo-url> finance-assistant
sudo chown -R $USER:$USER finance-assistant
cd finance-assistant
```

### 3.2 Настройка переменных окружения

```bash
cd server
cp .env.example .env
nano .env
```

Заполните переменные:

```env
PORT=3001
NODE_ENV=production
DB_HOST=localhost
DB_PORT=5432
DB_NAME=finance_assistant
DB_USER=finance_user
DB_PASSWORD=your_secure_password
JWT_SECRET=your_very_secure_jwt_secret_key
CORS_ORIGIN=https://yourdomain.com

# Google OAuth (опционально, для входа через Google)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/auth/google/callback
```

### 3.2.1 Настройка Google OAuth (опционально)

Google OAuth позволяет пользователям входить в приложение через свой Google аккаунт. Это опциональная функция - приложение будет работать и без неё.

#### Шаг 1: Создание проекта в Google Cloud Console

1. Перейдите на [Google Cloud Console](https://console.cloud.google.com/)
2. Войдите в свой Google аккаунт (или создайте новый)
3. Нажмите на выпадающий список проектов в верхней панели (рядом с логотипом Google Cloud)
4. Нажмите "New Project" (Новый проект)
5. Введите название проекта (например, "Finance Assistant")
6. Нажмите "Create" (Создать)
7. Дождитесь создания проекта (обычно несколько секунд)
8. Убедитесь, что выбран созданный проект (в верхней панели должен отображаться ваш проект)

#### Шаг 2: Настройка OAuth consent screen

1. В левом меню найдите раздел "APIs & Services" (APIs и сервисы)
2. Выберите "OAuth consent screen" (Экран согласия OAuth)
3. Выберите тип приложения:
   - **External** (Внешнее) - для публичного использования
   - **Internal** (Внутреннее) - только для пользователей вашей организации (требует Google Workspace)
4. Нажмите "Create" (Создать)
5. Заполните обязательные поля:
   - **App name** (Название приложения): например, "Finance Assistant"
   - **User support email** (Email поддержки): ваш email
   - **Developer contact information** (Контактная информация разработчика): ваш email
6. Нажмите "Save and Continue" (Сохранить и продолжить)
7. На экране "Scopes" (Области видимости):
   - Нажмите "Add or Remove Scopes" (Добавить или удалить области)
   - Выберите:
     - `.../auth/userinfo.email` (Email пользователя)
     - `.../auth/userinfo.profile` (Основная информация профиля)
   - Нажмите "Update" (Обновить)
   - Нажмите "Save and Continue" (Сохранить и продолжить)
8. На экране "Test users" (Тестовые пользователи):
   - Если приложение в статусе "Testing" (Тестирование), добавьте тестовых пользователей (email адреса)
   - Нажмите "Save and Continue" (Сохранить и продолжить)
9. Просмотрите сводку и нажмите "Back to Dashboard" (Вернуться на панель управления)

#### Шаг 3: Создание OAuth 2.0 Client ID

1. В левом меню выберите "APIs & Services" → "Credentials" (Учетные данные)
2. Нажмите "Create Credentials" (Создать учетные данные) в верхней части страницы
3. Выберите "OAuth client ID" (Идентификатор клиента OAuth)
4. Если появится предупреждение о настройке экрана согласия, нажмите "Configure Consent Screen" и завершите настройку из Шага 2
5. В поле "Application type" (Тип приложения) выберите "Web application" (Веб-приложение)
6. Введите "Name" (Название): например, "Finance Assistant Web Client"
7. В разделе "Authorized JavaScript origins" (Разрешенные источники JavaScript):
   - Для разработки добавьте: `http://localhost:3001`
   - Для продакшена добавьте: `https://yourdomain.com` (замените на ваш домен)
8. В разделе "Authorized redirect URIs" (Разрешенные URI перенаправления):
   - Для разработки добавьте: `http://localhost:3001/api/auth/google/callback`
   - Для продакшена добавьте: `https://yourdomain.com/api/auth/google/callback` (замените на ваш домен)
9. Нажмите "Create" (Создать)
10. Появится окно с вашими учетными данными:
    - **Your Client ID** (Ваш идентификатор клиента) - скопируйте это значение
    - **Your Client Secret** (Ваш секретный ключ клиента) - скопируйте это значение
    - ⚠️ **Важно**: Сохраните эти значения в безопасном месте! Client Secret показывается только один раз.

#### Шаг 4: Добавление учетных данных в .env файл

1. Откройте файл `.env` в папке `server/`
2. Добавьте следующие строки:

```env
# Google OAuth (опционально)
GOOGLE_CLIENT_ID=ваш_client_id_здесь
GOOGLE_CLIENT_SECRET=ваш_client_secret_здесь
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/auth/google/callback
```

**Пример для разработки:**

```env
GOOGLE_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnopqrstuvwxyz
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback
```

**Пример для продакшена:**

```env
GOOGLE_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnopqrstuvwxyz
GOOGLE_REDIRECT_URI=https://domiknote.ru/api/auth/google/callback
```

3. Сохраните файл

#### Шаг 5: Перезапуск сервера

После добавления переменных окружения перезапустите сервер:

```bash
pm2 restart finance-assistant
# или для разработки
npm run dev
```

#### Шаг 6: Проверка работы

1. Откройте приложение в браузере
2. Перейдите на страницу входа
3. Нажмите кнопку "Войти через Google"
4. Должно открыться окно авторизации Google
5. После успешной авторизации вы должны быть перенаправлены в приложение

#### Важные замечания:

- **Безопасность**: Никогда не публикуйте Client Secret в публичных репозиториях
- **Тестовый режим**: В режиме "Testing" только добавленные тестовые пользователи смогут войти через Google
- **Публикация**: Для публичного использования нужно отправить приложение на проверку Google (может занять несколько дней)
- **Домены**: Убедитесь, что домены в "Authorized redirect URIs" точно совпадают с вашими (включая http/https и порты)
- **Локальная разработка**: Для локальной разработки используйте `http://localhost:3001`, а не `http://localhost:3000`

#### Решение проблем:

**Ошибка "redirect_uri_mismatch":**

- Проверьте, что URI в Google Console точно совпадает с URI в `.env` файле
- Убедитесь, что используется правильный протокол (http/https)
- Проверьте порты

**Ошибка "access_denied":**

- Убедитесь, что приложение опубликовано или вы добавили себя в тестовые пользователи
- Проверьте настройки OAuth consent screen

**Ошибка "invalid_client":**

- Проверьте правильность Client ID и Client Secret в `.env` файле
- Убедитесь, что нет лишних пробелов при копировании

### 3.3 Установка зависимостей и миграция

```bash
npm install --production
npm run migrate
```

### 3.4 Запуск с PM2

```bash
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup
```

## Шаг 4: Развертывание фронтенда

### 4.1 Сборка фронтенда

```bash
cd /var/www/finance-assistant
npm install
npm run build
```

### 4.2 Проверка сборки

Убедитесь, что папка `dist` создана и содержит файлы.

## Шаг 5: Настройка Nginx

### 5.1 Копирование конфигурации

```bash
sudo cp nginx.conf /etc/nginx/sites-available/finance-assistant
sudo ln -s /etc/nginx/sites-available/finance-assistant /etc/nginx/sites-enabled/
```

### 5.2 Редактирование конфигурации

```bash
sudo nano /etc/nginx/sites-available/finance-assistant
```

Замените `yourdomain.com` на ваш домен.

### 5.3 Проверка и перезапуск Nginx

```bash
sudo nginx -t
sudo systemctl restart nginx
```

## Шаг 6: Настройка SSL (Let's Encrypt)

### 6.1 Установка Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 6.2 Получение сертификата

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Certbot автоматически обновит конфигурацию Nginx.

### 6.3 Автоматическое обновление

Certbot создаст cron задачу для автоматического обновления сертификатов.

## Шаг 7: Настройка файрвола

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## Шаг 8: Проверка работы

1. Откройте `https://yourdomain.com` в браузере
2. Проверьте, что фронтенд загружается
3. Попробуйте зарегистрироваться/войти
4. Проверьте работу API: `https://yourdomain.com/api/health`

## Полезные команды

### PM2

```bash
pm2 status              # Статус процессов
pm2 logs                # Логи
pm2 restart all         # Перезапуск всех процессов
pm2 stop all            # Остановка всех процессов
pm2 monit               # Мониторинг
```

### Nginx

```bash
sudo nginx -t           # Проверка конфигурации
sudo systemctl restart nginx
sudo systemctl status nginx
```

### PostgreSQL

```bash
sudo systemctl status postgresql
sudo systemctl restart postgresql
```

### Обновление приложения

```bash
cd /var/www/finance-assistant
git pull
cd server
npm install --production
npm run migrate
pm2 restart finance-assistant-api
cd ..
npm install
npm run build
sudo systemctl reload nginx
```

## Резервное копирование базы данных

### Создание бэкапа

```bash
pg_dump -U finance_user -d finance_assistant > backup_$(date +%Y%m%d).sql
```

### Восстановление

```bash
psql -U finance_user -d finance_assistant < backup_20240101.sql
```

## Мониторинг

Рекомендуется настроить мониторинг:

- PM2 Plus (бесплатный мониторинг PM2)
- Uptime Robot (мониторинг доступности)
- Sentry (отслеживание ошибок)

## Безопасность

1. Регулярно обновляйте систему: `sudo apt update && sudo apt upgrade`
2. Используйте сильные пароли
3. Настройте fail2ban для защиты от брутфорса
4. Регулярно делайте бэкапы базы данных
5. Мониторьте логи: `pm2 logs` и `sudo tail -f /var/log/nginx/error.log`
