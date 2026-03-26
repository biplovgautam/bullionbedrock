import asyncio
import logging
import time
from typing import Callable, Optional

import orjson
from twelvedata import TDClient

logger = logging.getLogger("ai-service")


async def websocket_worker(
    api_key: str,
    on_payload: Optional[Callable[[bytes], None]] = None,
    on_status: Optional[Callable[[str], None]] = None,
    symbols: Optional[list[str]] = None,
) -> None:
    if not api_key:
        logger.error("Missing TWELVEDATA_API_KEY")
        return

    symbols = symbols or ["XAU/USD", "BTC/USD"]
    last_data_at = 0.0

    async def poll_prices(td_client: TDClient) -> None:
        nonlocal last_data_at
        while True:
            await asyncio.sleep(10)
            # Only poll if we haven't seen a live tick in 20 seconds
            if time.time() - last_data_at < 20:
                continue

            for symbol in symbols:
                try:
                    result = await asyncio.to_thread(td_client.price, symbol=symbol)
                    data = await asyncio.to_thread(result.as_json)
                    payload = orjson.dumps({"event": "poll", "symbol": symbol, "data": data})
                    if on_payload is not None:
                        on_payload(payload)
                except Exception as exc:
                    logger.error("Polling error for %s: %s", symbol, exc)

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

    backoff = 1
    while True:
        ws = None
        poller = None
        try:
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
            if poller:
                poller.cancel()
            if ws:
                try:
                    ws.disconnect()
                except Exception:
                    pass
            if on_status is not None:
                on_status("disconnected")
