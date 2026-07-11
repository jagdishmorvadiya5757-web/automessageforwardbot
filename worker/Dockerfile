FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (better layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the worker code
COPY . .

# The Telegram session file lives on a persistent volume mounted at /data
ENV SESSION_PATH=/data/forwardflow_session
ENV PYTHONUNBUFFERED=1

CMD ["python", "-u", "main.py"]
