# Этап 1: Собираем красивый интерфейс React
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Этап 2: Запускаем наш сервер Python + FastAPI
FROM python:3.10-slim
WORKDIR /app

# Устанавливаем системные утилиты для компиляции криптографии Paramiko
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Копируем и устанавливаем зависимости Python
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Копируем код бэкенда
COPY backend/ ./backend

# Переносим собранный React-интерфейс из Этапа 1 в папку, которую ждет Python
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Сообщаем Railway, какой порт использовать
EXPOSE 8000

# Запускаем сервер
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port $PORT"]