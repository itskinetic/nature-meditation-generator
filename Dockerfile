# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Backend + FFmpeg Runtime
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies & FFmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy Backend and configuration
COPY backend/ ./backend/
COPY .env.example ./.env

# Copy built frontend assets
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create storage directories
RUN mkdir -p data/previews data/renders data/library data/music

EXPOSE 8000

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
