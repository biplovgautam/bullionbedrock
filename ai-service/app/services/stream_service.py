import asyncio
import logging
import time
from typing import Callable, Optional

import orjson
from twelvedata import TDClient
from fastapi import FastAPI
from app.models.prices import PriceUpdate

logger = logging.getLogger("ai-service")


async def websocket_worker(
    app: FastAPI,
    api_key: str,
    on_update: Optional[Callable[[PriceUpdate], None]] = None,
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
            if time.time() - last_data_at < 20:
                continue

            for symbol in symbols:
                try:
                    # Polling is also silent if in secondary mode
                    if getattr(app.state, "provider_mode", "primary") == "secondary":
                        result = await asyncio.to_thread(td_client.price, symbol=symbol)
                        data = await asyncio.to_thread(result.as_json)
                        # Don't even try to parse if we are silent, as it might raise exceptions
                        continue

                    result = await asyncio.to_thread(td_client.price, symbol=symbol)
                    data = await asyncio.to_thread(result.as_json)
                    price = float(data.get("price"))
                    update = PriceUpdate(
                        symbol=symbol,
                        price=price,
                        timestamp=time.time(),
                        provider="twelvedata",
                        raw_event=data
                    )
                    if on_update is not None:
                        on_update(update)
                except Exception:
                    # Completely silent polling errors
                    pass

    def on_event(event: dict) -> None:
        event_type = event.get("event")
        if event_type == "heartbeat":
            return
        
        if event_type == "price":
            nonlocal last_data_at
            last_data_at = time.time()
            symbol = event.get("symbol")
            price = event.get("price")
            if symbol and price:
                update = PriceUpdate(
                    symbol=symbol,
                    price=float(price),
                    timestamp=float(event.get("timestamp", time.time())),
                    provider="twelvedata",
                    raw_event=event
                )
                if on_update is not None:
                    on_update(update)
            return

        if event_type == "subscribe-status" and event.get("status") == "warning":
            if getattr(app.state, "provider_mode", "primary") == "primary":
                logger.warning("TwelveData subscribe warning: %s", event)
                if on_status is not None:
                    on_status("warning")
            return

    backoff = 1
    while True:
        ws = None
        poller = None
        current_mode = getattr(app.state, "provider_mode", "primary")
        try:
            td = TDClient(apikey=api_key)
            ws = td.websocket(symbols=symbols, on_event=on_event, log_level="info")
            ws.connect()
            
            if current_mode == "primary" and on_status is not None:
                on_status("connected")
            
            poller = asyncio.create_task(poll_prices(td))
            backoff = 1

            while True:
                await asyncio.sleep(10)
                ws.heartbeat()
        except asyncio.CancelledError:
            break
        except Exception as exc:
            # Re-check mode in case it changed during connection
            current_mode = getattr(app.state, "provider_mode", "primary")
            if current_mode == "primary":
                if on_status is not None:
                    on_status("error")
                logger.error("TwelveData WebSocket error: %s", exc)
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 30)
            else:
                # STRICTOR TERMINAL SILENCE: completely suppress all exceptions when in secondary mode
                # Strict 30-second silent background retry loop
                await asyncio.sleep(30)
        finally:
            if poller:
                poller.cancel()
            if ws:
                try:
                    ws.disconnect()
                except Exception:
                    pass
            if current_mode == "primary" and on_status is not None:
                on_status("disconnected")
