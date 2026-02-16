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

    # Redis (Upstash)
    redis_url: str = ""  # Empty = caching disabled

    # CORS
    cors_origins: str = "https://alpha-board.com,https://www.alpha-board.com,http://localhost:3000"

    # SSE
    sse_agent_broadcast_seconds: int = 30

    # Twitter/X
    twitter_bearer_token: str = ""
    twitter_polling_enabled: bool = False
    twitter_poll_interval_minutes: int = 5

    # Tweet analysis
    tweet_analysis_enabled: bool = False
    tweet_analysis_model: str = "claude-haiku-3-5-20241022"

    # Feature flags
    agents_enabled: bool = True
    evolution_enabled: bool = True

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()  # type: ignore[call-arg]
