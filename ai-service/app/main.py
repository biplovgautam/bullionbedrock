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
from app.services.finnhub_service import finnhub_worker
from app.services.failover_manager import FailoverManager
from app.models.prices import PriceUpdate

logger = logging.getLogger("ai-service")


def store_status(app: FastAPI):
    def _store(status: str) -> None:
        app.state.stream_status = status
        app.state.stream_status_at = datetime.now(timezone.utc).isoformat()

    return _store


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize State
    app.state.prices_primary = {symbol: None for symbol in config.SYMBOLS}
    app.state.prices_secondary = {symbol: None for symbol in config.SYMBOLS}
    app.state.provider_mode = "primary"  # "primary" or "secondary"
    app.state.primary_healthy = True
    app.state.stream_status = "starting"
    app.state.stream_status_at = None

    manager = FailoverManager(app)

    def on_primary_update(update: PriceUpdate):
        app.state.prices_primary[update.symbol] = update
        manager.record_update("twelvedata")

    def on_secondary_update(update: PriceUpdate):
        app.state.prices_secondary[update.symbol] = update
        manager.record_update("finnhub")

    # Start Workers
    primary_worker = asyncio.create_task(
        websocket_worker(
            app=app,
            api_key=config.TWELVEDATA_API_KEY,
            on_update=on_primary_update,
            on_status=store_status(app),
            symbols=config.SYMBOLS,
        )
    )
    
    secondary_worker = asyncio.create_task(
        finnhub_worker(
            api_key=config.FINNHUB_API_KEY,
            on_update=on_secondary_update,
            symbols=config.SYMBOLS,
        )
    )

    manager_task = asyncio.create_task(manager.run_loop())

    try:
        yield
    finally:
        primary_worker.cancel()
        secondary_worker.cancel()
        manager_task.cancel()
        
        with suppress(asyncio.CancelledError):
            await asyncio.gather(primary_worker, secondary_worker, manager_task)


app = FastAPI(title="AI Bullion Service", version="0.3.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if config.cors_allow_all() else config.ALLOWED_ORIGINS,
    allow_credentials=not config.cors_allow_all(),
    allow_methods=["GET"],
    allow_headers=["*"],
)
app.include_router(health_router)
app.include_router(prices_router)
