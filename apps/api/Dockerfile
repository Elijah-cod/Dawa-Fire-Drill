FROM python:3.12-slim

WORKDIR /app
COPY requirements.lock ./
RUN pip install --no-cache-dir --require-hashes -r requirements.lock
COPY dawa_api ./dawa_api
COPY alembic.ini ./
COPY alembic ./alembic

EXPOSE 8000
CMD ["uvicorn", "dawa_api.app:app", "--host", "0.0.0.0", "--port", "8000"]
