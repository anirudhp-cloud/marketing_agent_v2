from pathlib import Path
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent  # backend/../..
_ENV_FILE = _PROJECT_ROOT / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Azure OpenAI
    azure_openai_api_key: str = ""
    azure_openai_endpoint: str = ""
    azure_openai_deployment: str = "gpt-4o"
    azure_api_version: str = "2024-02-15-preview"

    # FLUX 1.1 Pro
    flux_api_endpoint: str = ""
    flux_api_key: str = ""
    flux_model: str = "FLUX-1.1-pro"

    # Sora 2
    sora_api_endpoint: str = ""
    sora_api_key: str = ""
    sora_deployment_name: str = "sora-2"

    # Database
    database_url: str = "sqlite:///retail_marketing.db"

    # App
    debug: bool = False
    log_level: str = "INFO"
    cors_origins: str = "http://localhost:5173"


@lru_cache
def get_settings() -> Settings:
    return Settings()
