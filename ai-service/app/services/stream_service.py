import asyncio
import logging
import time
from typing import Callable, Optional

import orjson
import redis.asyncio as redis
from twelvedata import TDClient

logger = logging.getLogger("ai-service")


async def websocket_worker(
    redis_client: redis.Redis,
    api_key: str,
    channel: str,
    on_payload: Optional[Callable[[bytes], None]] = None,
    on_status: Optional[Callable[[str], None]] = None,
    symbols: Optional[list[str]] = None,
) -> None:
    if not api_key:
        logger.error("Missing TWELVEDATA_API_KEY; retrying in 5s")
    symbols = symbols or ["XAU/USD", "XAG/USD"]
    loop = asyncio.get_running_loop()
    last_data_at = 0.0

    async def publish_payload(payload: bytes) -> None:
        await redis_client.publish(channel, payload)

    async def poll_prices(td_client: TDClient) -> None:
        nonlocal last_data_at
        while True:
            await asyncio.sleep(10)
            if time.time() - last_data_at < 20:
                continue
            for symbol in symbols:
                result = await asyncio.to_thread(td_client.price, symbol=symbol)
                data = await asyncio.to_thread(result.as_json)
                payload = orjson.dumps({"event": "poll", "symbol": symbol, "data": data})
                if on_payload is not None:
                    on_payload(payload)
                await redis_client.publish(channel, payload)

    def on_event(event: dict) -> None:
        event_type = event.get("event")
        if event_type == "heartbeat":
            return
        if event_type == "subscribe-status" and event.get("status") == "warning":
            logger.warning("Subscribe warning: %s", event)
            if on_status is not None:
                on_status("warning")
            return
        nonlocal last_data_at
        last_data_at = time.time()
        payload = orjson.dumps(event)
        if on_payload is not None:
            on_payload(payload)
        loop.call_soon_threadsafe(asyncio.create_task, publish_payload(payload))

    backoff = 1
    while True:
        try:
            if not api_key:
                await asyncio.sleep(5)
                continue

            td = TDClient(apikey=api_key)
            ws = td.websocket(symbols=symbols, on_event=on_event, log_level="info")
            ws.connect()
            if on_status is not None:
                on_status("connected")
            poller = asyncio.create_task(poll_prices(td))
            backoff = 1

            while True:
                await asyncio.sleep(10)
                ws.heartbeat()
        except asyncio.CancelledError:
            break
        except Exception as exc:
            if on_status is not None:
                on_status("error")
            logger.error("WebSocket error: %s", exc)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 30)
        finally:
            if "poller" in locals():
                poller.cancel()
            if on_status is not None:
                on_status("disconnected")
