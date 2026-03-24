import asyncio
import logging
from contextlib import asynccontextmanager, suppress
from datetime import datetime, timezone

import redis.asyncio as redis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core import config
from app.endpoints import health_router, prices_router
from app.services.stream_service import websocket_worker

logger = logging.getLogger("ai-service")


def store_latest_payload(app: FastAPI):
    def _store(payload: bytes) -> None:
        try:
            app.state.latest_payload = payload.decode()
        except Exception:
            app.state.latest_payload = payload
        app.state.latest_payload_at = datetime.now(timezone.utc).isoformat()

    return _store


def store_status(app: FastAPI):
    def _store(status: str) -> None:
        app.state.stream_status = status
        app.state.stream_status_at = datetime.now(timezone.utc).isoformat()

    return _store


@asynccontextmanager
async def lifespan(app: FastAPI):
    redis_client = redis.Redis.from_url(
        config.REDIS_URL,
        max_connections=50,
        decode_responses=False,
    )
    app.state.redis = redis_client
    app.state.latest_payload = None
    app.state.latest_payload_at = None
    app.state.stream_status = "starting"
    app.state.stream_status_at = None
    worker = asyncio.create_task(
        websocket_worker(
            redis_client=redis_client,
            api_key=config.TWELVEDATA_API_KEY,
            channel=config.REDIS_CHANNEL,
            on_payload=store_latest_payload(app),
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
        await redis_client.close()
        await redis_client.connection_pool.disconnect()


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
