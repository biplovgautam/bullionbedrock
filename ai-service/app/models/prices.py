from pydantic import BaseModel
from typing import Optional

class PriceUpdate(BaseModel):
    symbol: str
    price: float
    timestamp: float  # UNIX timestamp (seconds)
    provider: str     # "twelvedata" or "finnhub"
    raw_event: Optional[dict] = None  # Original message for debugging
