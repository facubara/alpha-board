from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str

    # Binance
    binance_base_url: str = "https://api.binance.com"
    min_volume_usd: float = 1_000_000  # Minimum 24h volume for symbol inclusion
    top_symbols_limit: int = 100  # Max symbols to process per pipeline run (0 = unlimited)

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

    # Exchange (Binance copy-trade)
    exchange_encryption_key: str = ""

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
    tweet_analysis_model: str = "claude-haiku-4-5-20251001"

    # Memecoins
    helius_api_key: str = ""
    memecoin_enabled: bool = False
    memecoin_wallet_poll_minutes: int = 360  # wallet cross-ref refresh: every 6h
    memecoin_twitter_enabled: bool = False
    memecoin_twitter_poll_minutes: int = 5
    memecoin_webhook_secret: str = ""

    # Feature flags
    agents_enabled: bool = True
    evolution_enabled: bool = True
    tweet_agents_enabled: bool = False
    fleet_lessons_in_context: bool = False
    tweet_filter_enabled: bool = False

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()  # type: ignore[call-arg]
