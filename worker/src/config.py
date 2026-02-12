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

    # Telegram notifications
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""

    # CORS
    cors_origins: str = "https://alpha-board.com,https://www.alpha-board.com,http://localhost:3000"

    # SSE
    sse_agent_broadcast_seconds: int = 30

    # Feature flags
    agents_enabled: bool = True
    evolution_enabled: bool = True

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()  # type: ignore[call-arg]
