FROM python:3.11-slim

WORKDIR /app

# Fallback Dockerfile for Railway when it reads the repository root config.
# The actual worker files live in /worker.
COPY worker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY worker/ .

# The Telegram session file lives on a persistent volume mounted at /data.
ENV SESSION_PATH=/data/forwardflow_session
ENV PYTHONUNBUFFERED=1

CMD ["python", "-u", "main.py"]