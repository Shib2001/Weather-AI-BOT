import logging
import os
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent.parent
logger = logging.getLogger("weather_bot")

def load_project_env():
    env_file = APP_DIR / ".env"
    if not env_file.is_file():
        return

    for line in env_file.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        name = name.strip()
        value = value.strip().strip("\"'")
        if name and name not in os.environ:
            os.environ[name] = value

load_project_env()

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_TTS_URL = "https://openrouter.ai/api/v1/audio/speech"
GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
GEOCODING_CACHE_TTL = 30 * 24 * 60 * 60
FORECAST_CACHE_TTL = 5 * 60
HISTORICAL_CACHE_TTL = 90 * 24 * 60 * 60
YESTERDAY_CACHE_TTL = 24 * 60 * 60
REPORT_CACHE_TTL = 15 * 24 * 60 * 60
GREETING_CACHE_TTL = 30 * 24 * 60 * 60
ERROR_CACHE_TTL = 60 * 60
SPEECH_CACHE_TTL = 30 * 24 * 60 * 60

REDIS_URL = os.getenv("REDIS_URL")
