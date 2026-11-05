FROM python:3.12-slim

WORKDIR /app
COPY pyproject.toml ./
COPY dawa_api ./dawa_api
RUN pip install --no-cache-dir .

EXPOSE 8000
CMD ["uvicorn", "dawa_api.app:app", "--host", "0.0.0.0", "--port", "8000"]
