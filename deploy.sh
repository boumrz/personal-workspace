#!/bin/bash

# Скрипт для backend-only деплоя (API)
# Использование: ./deploy.sh

set -e

echo "🚀 Начинаем деплой Finance Assistant..."

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Проверка, что мы в правильной директории
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Ошибка: package.json не найден. Запустите скрипт из корня проекта.${NC}"
    exit 1
fi

# 1. Обновление кода
echo -e "${YELLOW}📥 Обновление кода из репозитория...${NC}"
git pull origin main || git pull origin master

# 2. Обновление зависимостей бэкенда
echo -e "${YELLOW}📦 Установка зависимостей бэкенда...${NC}"
cd server
npm install --production
cd ..

# 3. Запуск миграций
echo -e "${YELLOW}🗄️  Запуск миграций базы данных...${NC}"
cd server
npm run migrate
cd ..

# 4. Перезапуск бэкенда
echo -e "${YELLOW}🔄 Перезапуск бэкенда...${NC}"
pm2 restart finance-assistant-api || pm2 start ecosystem.config.cjs --env production

# 5. Проверка статуса backend
echo -e "${YELLOW}✅ Проверка статуса...${NC}"
pm2 status

# optional health-check
if [ -n "${SERVER_HEALTHCHECK_URL}" ]; then
  echo -e "${YELLOW}🌡️ Проверка health endpoint...${NC}"
  curl -fsSL "${SERVER_HEALTHCHECK_URL}" >/dev/null
fi

echo -e "${GREEN}✨ Деплой завершен успешно!${NC}"
