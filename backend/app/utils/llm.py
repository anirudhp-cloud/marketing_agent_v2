from openai import AsyncAzureOpenAI

from app.config import get_settings


def get_openai_client() -> AsyncAzureOpenAI:
    """Create an Azure OpenAI async client from environment settings."""
    settings = get_settings()
    return AsyncAzureOpenAI(
        api_key=settings.azure_openai_api_key,
        azure_endpoint=settings.azure_openai_endpoint,
        api_version=settings.azure_api_version,
    )
