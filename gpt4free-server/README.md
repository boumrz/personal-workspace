# GPT4Free API Server

Отдельный сервер с бесплатными LLM для голосового парсера Finance Assistant.

## Локальный запуск

```bash
cd gpt4free-server
docker-compose up -d
```

API: `http://localhost:1337/v1`

Для облегчённого образа (без Chrome) замени в `docker-compose.yml` образ на `hlohaus789/g4f:latest-slim`.  
Проверка: `curl -X POST http://localhost:1337/v1/chat/completions -H "Content-Type: application/json" -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Привет"}]}'`

## Запуск на удалённой машине (для продакшена)

1. Скопируй папку `gpt4free-server` на сервер (или клонируй репозиторий).
2. Запусти:

```bash
cd gpt4free-server
docker-compose up -d
```

3. **Если backend и gpt4free на одной машине** — в `.env` основного проекта:

```env
GPT4FREE_BASE_URL=http://localhost:1337/v1
```

4. **Если gpt4free на отдельной машине** — открой порт 1337 в файрволе и в `.env` backend:

```env
GPT4FREE_BASE_URL=http://IP_УДАЛЁННОЙ_МАШИНЫ:1337/v1
```

5. Для доступа по домену (nginx reverse proxy):

```nginx
location /gpt4free/ {
    proxy_pass http://127.0.0.1:1337/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

Тогда `GPT4FREE_BASE_URL=https://yourdomain.com/gpt4free/v1`

## Переменные

| Переменная       | Описание              | По умолчанию |
|------------------|-----------------------|--------------|
| GPT4FREE_PORT    | Порт API              | 1337         |

## Остановка

```bash
docker-compose down
```
