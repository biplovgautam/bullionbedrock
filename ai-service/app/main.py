import asyncio
import logging
from contextlib import asynccontextmanager, suppress
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import orjson
from app.core import config
from app.endpoints import health_router, prices_router
from app.services.stream_service import websocket_worker

logger = logging.getLogger("ai-service")


def update_price_state(app: FastAPI):
    def _update(payload: bytes) -> None:
        try:
            data = orjson.loads(payload)
            symbol = data.get("symbol")
            if symbol:
                app.state.prices[symbol] = data
                app.state.prices_at[symbol] = datetime.now(timezone.utc).isoformat()
        except Exception as exc:
            logger.error("Error updating price state: %s", exc)

    return _update


def store_status(app: FastAPI):
    def _store(status: str) -> None:
        app.state.stream_status = status
        app.state.stream_status_at = datetime.now(timezone.utc).isoformat()

    return _store


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.prices = {symbol: None for symbol in config.SYMBOLS}
    app.state.prices_at = {symbol: None for symbol in config.SYMBOLS}
    app.state.stream_status = "starting"
    app.state.stream_status_at = None
    worker = asyncio.create_task(
        websocket_worker(
            api_key=config.TWELVEDATA_API_KEY,
            on_payload=update_price_state(app),
            on_status=store_status(app),
            symbols=config.SYMBOLS,
        )
    )
    try:
        yield
    finally:
        worker.cancel()
        with suppress(asyncio.CancelledError):
            await worker


app = FastAPI(title="AI Bullion Service", version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if config.cors_allow_all() else config.ALLOWED_ORIGINS,
    allow_credentials=not config.cors_allow_all(),
    allow_methods=["GET"],
    allow_headers=["*"],
)
app.include_router(health_router)
app.include_router(prices_router)
