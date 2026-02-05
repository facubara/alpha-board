from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str

    # Binance
    binance_base_url: str = "https://api.binance.com"
    min_volume_usd: float = 1_000_000  # Minimum 24h volume for symbol inclusion

    # Anthropic
    anthropic_api_key: str = ""

    # Server
    worker_port: int = 8000
    log_level: str = "INFO"

    # Feature flags
    agents_enabled: bool = True
    evolution_enabled: bool = True

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()  # type: ignore[call-arg]
