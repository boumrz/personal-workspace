# Быстрый старт деплоя

## Краткая инструкция

### 1. Подготовка сервера (Ubuntu/Debian)

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Установка PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql

# Установка Nginx
sudo apt install -y nginx

# Установка PM2
sudo npm install -g pm2
```

### 2. Настройка базы данных

```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE finance_assistant;
CREATE USER finance_user WITH PASSWORD 'ваш_безопасный_пароль';
GRANT ALL PRIVILEGES ON DATABASE finance_assistant TO finance_user;
\q
```

### 3. Клонирование и настройка проекта

```bash
cd /var/www
sudo git clone <ваш-репозиторий> finance-assistant
sudo chown -R $USER:$USER finance-assistant
cd finance-assistant
```

### 4. Настройка бэкенда

```bash
cd server
cp .env.example .env
nano .env  # Заполните переменные
npm install --production
npm run migrate
```

### 5. Запуск бэкенда

```bash
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup
```

### 6. Сборка фронтенда

```bash
cd /var/www/finance-assistant
npm install
VITE_API_URL=https://ваш-домен.com/api npm run build
```

### 7. Настройка Nginx

```bash
# Скопируйте и отредактируйте nginx.conf
sudo cp nginx.conf /etc/nginx/sites-available/finance-assistant
sudo nano /etc/nginx/sites-available/finance-assistant  # Замените yourdomain.com
sudo ln -s /etc/nginx/sites-available/finance-assistant /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 8. SSL сертификат (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ваш-домен.com -d www.ваш-домен.com
```

### 9. Файрвол

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## Обновление приложения

```bash
cd /var/www/finance-assistant
./deploy.sh
```

Или вручную:

```bash
git pull
cd server && npm install --production && npm run migrate && pm2 restart finance-assistant-api
cd .. && npm install && VITE_API_URL=https://ваш-домен.com/api npm run build
sudo systemctl reload nginx
```

## Важные переменные окружения

### Backend (server/.env)
- `PORT=3001`
- `NODE_ENV=production`
- `DB_HOST=localhost`
- `DB_PORT=5432`
- `DB_NAME=finance_assistant`
- `DB_USER=finance_user`
- `DB_PASSWORD=ваш_пароль`
- `JWT_SECRET=очень_безопасный_секретный_ключ`
- `CORS_ORIGIN=https://ваш-домен.com`

### Frontend (при сборке)
- `VITE_API_URL=https://ваш-домен.com/api`

## Проверка работы

1. Откройте `https://ваш-домен.com`
2. Проверьте API: `https://ваш-домен.com/api/health`
3. Проверьте логи: `pm2 logs finance-assistant-api`
