# 1) Use a minimal Python base
# FROM python:3.11-slim
FROM python:3.11-slim-bullseye


# 2) Install system dependencies for Playwright (but not Chromium manually)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    libnss3 \
    libgtk-3-0 \
    libgbm1 \
    libxss1 \
    libasound2 \
    libatk1.0-0 \
    libpangocairo-1.0-0 \
    wget \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# 3) Set working directory and copy requirements for caching
WORKDIR /app
COPY requirements.txt .

# 4) Install CPU-only PyTorch first, then deps (Playwright included in requirements)
RUN pip install --no-cache-dir --verbose \
    torch==2.6.0 \
    torchvision==0.21.0 \
    torchaudio==2.6.0 \
    --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir --verbose -r requirements.txt

# 5) Install Playwright Chromium only
# RUN playwright install chromium --only-shell
RUN pip install --no-cache-dir psycopg2-binary
RUN pip install --no-cache-dir gunicorn
RUN pip install --no-cache-dir pydantic[email]
RUN pip install --no-cache-dir fuzzywuzzy
RUN pip install --no-cache-dir python-Levenshtein
RUN pip install --no-cache-dir scikit-learn
RUN pip install --no-cache-dir scipy
RUN pip install --no-cache-dir numpy
RUN pip install --no-cache-dir sentence-transformers
RUN pip install --no-cache-dir groq
RUN pip install --no-cache-dir duckduckgo-search
RUN pip install --no-cache-dir google-generativeai



# 6) Copy application code and entrypoint
COPY . .

# 7) Make entrypoint executable and prepare logs/data dirs
RUN chmod +x entrypoint.sh \
    && mkdir -p logs data \
    && touch logs/{error.log,access.log,app.log} \
    && chmod -R a+rw logs data

# 8) Expose port and set environment
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/usr/local/bin:/usr/bin:${PATH}"

EXPOSE 8000

# 9) Entrypoint + default CMD
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["gunicorn", "-c", "gunicorn_config.py", "main:app"]
