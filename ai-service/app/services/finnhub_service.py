import asyncio
import logging
import orjson
import websockets
from typing import Callable, Optional
from app.models.prices import PriceUpdate
from app.core import config

logger = logging.getLogger("ai-service")

async def finnhub_worker(
    api_key: str,
    on_update: Callable[[PriceUpdate], None],
    symbols: list[str],
) -> None:
    if not api_key:
        logger.error("Missing FINNHUB_API_KEY")
        return

    # Invert symbol map for easy lookup: { "BINANCE:BTCUSDT": "BTC/USD" }
    finnhub_to_internal = {v: k for k, v in config.PROVIDER_CONFIG["finnhub"].items()}
    url = config.build_finnhub_url(api_key)

    backoff = 1
    while True:
        try:
            async with websockets.connect(url) as ws:
                logger.info("Finnhub WebSocket connected")
                backoff = 1

                # Subscribe to symbols
                for internal_symbol in symbols:
                    finnhub_symbol = config.PROVIDER_CONFIG["finnhub"].get(internal_symbol)
                    if finnhub_symbol:
                        await ws.send(orjson.dumps({
                            "type": "subscribe",
                            "symbol": finnhub_symbol
                        }).decode())

                async for message in ws:
                    data = orjson.loads(message)
                    msg_type = data.get("type")

                    if msg_type == "trade":
                        trades = data.get("data", [])
                        for trade in trades:
                            finnhub_symbol = trade.get("s")
                            internal_symbol = finnhub_to_internal.get(finnhub_symbol)
                            if internal_symbol:
                                update = PriceUpdate(
                                    symbol=internal_symbol,
                                    price=float(trade.get("p")),
                                    timestamp=float(trade.get("t")) / 1000.0,
                                    provider="finnhub",
                                    raw_event=trade
                                )
                                on_update(update)
                    elif msg_type == "error":
                        logger.error("Finnhub error: %s", data.get("msg"))

        except websockets.exceptions.ConnectionClosed:
            logger.warning("Finnhub WebSocket closed; reconnecting...")
        except Exception as exc:
            logger.error("Finnhub worker error: %s", exc)
        
        await asyncio.sleep(backoff)
        backoff = min(backoff * 2, 60)
