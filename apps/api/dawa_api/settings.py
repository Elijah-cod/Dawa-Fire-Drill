"""Typed backend settings. Optional integrations stay disabled until configured."""

from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="", extra="ignore", case_sensitive=False)

    app_env: Literal["local", "staging", "production"] = "local"
    log_level: str = "INFO"
    api_prefix: str = "/v1"
    cors_origins: str = "http://localhost:3000"
    default_country: str = "KE"
    synthetic_seed: int = 42
    database_url: str = Field(
        ..., validation_alias="DATABASE_URL", description="Required Postgres connection URL"
    )
    supabase_url: str = ""
    supabase_jwt_secret: str = ""
    supabase_service_role_key: str = ""
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = ""
    llm_provider: Literal["openai", "gemini"] = "openai"
    openai_api_key: str = ""
    openai_vision_model: str = ""
    openai_text_model: str = ""
    gemini_api_key: str = ""
    gemini_model: str = ""
    llm_daily_call_cap: int = Field(200, ge=0)
    llm_cache_by_image_hash: bool = True
    max_upload_mb: int = Field(5, gt=0)
    allowed_image_types: str = "image/jpeg,image/png,image/webp"
    rate_limit_per_minute: int = Field(60, gt=0)
    job_trigger_token: str = ""

    @field_validator("database_url")
    @classmethod
    def require_postgres(cls, value: str) -> str:
        if not value.startswith("postgresql+asyncpg://"):
            raise ValueError("Postgres DATABASE_URL must use postgresql+asyncpg://")
        return value
