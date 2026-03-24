import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")

ENV = os.getenv("ENV", "dev")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
TWELVEDATA_API_KEY = os.getenv("TWELVEDATA_API_KEY", "")
REDIS_CHANNEL = os.getenv("REDIS_CHANNEL", "bullion_ticks")
SYMBOLS = [
    symbol.strip()
    for symbol in os.getenv("TWELVEDATA_SYMBOLS", "XAU/USD,XAG/USD").split(",")
    if symbol.strip()
]
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:4000").split(",")
    if origin.strip()
]


def cors_allow_all() -> bool:
    return ENV.lower() == "dev"


def build_ws_url(api_key: str) -> str:
    return f"wss://ws.twelvedata.com/v1/quotes/price?apikey={api_key}"
