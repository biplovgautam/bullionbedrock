import time
from fastapi import APIRouter, Request
from app.models.prices import PriceUpdate

router = APIRouter()


def get_best_price(symbol: str, request: Request) -> PriceUpdate:
    """
    Intelligent provider selection:
    1. If mode is Primary and Primary data is fresh (<30s), use it.
    2. Else, if Secondary (Finnhub) data is available, use it.
    3. Else, fallback to whatever is available.
    """
    app = request.app
    primary = app.state.prices_primary.get(symbol)
    secondary = app.state.prices_secondary.get(symbol)
    mode = app.state.provider_mode
    now = time.time()

    # Priority: Primary (TwelveData)
    if mode == "primary" and primary:
        if (now - primary.timestamp) < 30:
            return primary

    # Failover: Secondary (Finnhub)
    if secondary:
        return secondary

    # Fallback/Last Resort: Primary (even if stale)
    return primary


@router.get("/prices/btc")
async def btc_price(request: Request) -> dict:
    data = get_best_price("BTC/USD", request)
    if data is None:
        return {"status": "waiting", "message": "Waiting for Bitcoin data..."}
    return {"status": "ok", "provider": data.provider, "data": data.dict()}


@router.get("/prices/gold")
async def gold_price(request: Request) -> dict:
    data = get_best_price("XAU/USD", request)
    if data is None:
        return {"status": "waiting", "message": "Waiting for Gold data..."}
    return {"status": "ok", "provider": data.provider, "data": data.dict()}


@router.get("/prices/asset/{symbol:path}")
async def get_asset_price(symbol: str, request: Request) -> dict:
    symbol = symbol.strip()
    data = get_best_price(symbol, request)
    if data is None:
        return {
            "status": "waiting", 
            "message": f"Waiting for data for symbol: {symbol}",
            "available_symbols": list(request.app.state.prices_primary.keys())
        }
    return {"status": "ok", "provider": data.provider, "data": data.dict()}


@router.get("/prices/status")
async def stream_status(request: Request) -> dict:
    app = request.app
    return {
        "provider_mode": app.state.provider_mode,
        "primary_healthy": app.state.primary_healthy,
        "stream_status": app.state.stream_status,
        "stream_status_at": app.state.stream_status_at,
        "primary_updates": {k: v.timestamp if v else None for k, v in app.state.prices_primary.items()},
        "secondary_updates": {k: v.timestamp if v else None for k, v in app.state.prices_secondary.items()},
    }
