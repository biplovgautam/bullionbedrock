from datetime import datetime, timezone

import httpx
from redis import Redis

from app.models import RatioUpdate


class PriceService:
    def __init__(self, redis_url: str) -> None:
        self.redis = Redis.from_url(redis_url, decode_responses=True)

    async def fetch_prices(self) -> tuple[float, float]:
        # Public endpoint returning XAU/XAG spot (USD); fallback values on failure
        url = "https://data-asg.goldprice.org/dbXRates/USD"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url)
                response.raise_for_status()
                payload = response.json()
                items = payload.get("items", [])
                if not items:
                    raise ValueError("No price data")
                first = items[0]
                gold = float(first["xauPrice"])
                silver = float(first["xagPrice"])
                return gold, silver
        except Exception:
            # conservative fallback for local dev continuity
            return 3000.0, 33.0

    async def publish_ratio_update(self) -> RatioUpdate:
        gold, silver = await self.fetch_prices()
        ratio = gold / silver
        message = RatioUpdate(
            gold=gold,
            silver=silver,
            ratio=ratio,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )
        self.redis.publish("ratio_update", message.model_dump_json())
        return message
