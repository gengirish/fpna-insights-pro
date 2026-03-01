FROM python:3.12-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM base AS production
COPY . .
ENV PORT=8001
EXPOSE ${PORT}
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers 1
