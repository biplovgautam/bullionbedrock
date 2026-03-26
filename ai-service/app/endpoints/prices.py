from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/prices/btc")
async def btc_price(request: Request) -> dict:
    prices = getattr(request.app.state, "prices", {})
    data = prices.get("BTC/USD")
    if data is None:
        return {"status": "waiting", "message": "Waiting for Bitcoin data..."}
    return {"status": "ok", "data": data}


@router.get("/prices/gold")
async def gold_price(request: Request) -> dict:
    prices = getattr(request.app.state, "prices", {})
    data = prices.get("XAU/USD")
    if data is None:
        return {"status": "waiting", "message": "Waiting for Gold data..."}
    return {"status": "ok", "data": data}


@router.get("/prices/asset/{symbol:path}")
async def get_asset_price(symbol: str, request: Request) -> dict:
    """
    Fetch the latest price for any asset (e.g., BTC/USD, AAPL, XAU/USD).
    The :path converter handles symbols containing slashes.
    """
    symbol = symbol.strip()
    prices = getattr(request.app.state, "prices", {})
    data = prices.get(symbol)
    if data is None:
        return {
            "status": "waiting", 
            "message": f"Waiting for data for symbol: {symbol}",
            "available_symbols": list(prices.keys())
        }
    return {"status": "ok", "data": data}


@router.get("/prices/status")
async def stream_status(request: Request) -> dict:
    return {
        "status": request.app.state.stream_status,
        "status_at": request.app.state.stream_status_at,
        "prices_updated_at": getattr(request.app.state, "prices_at", {}),
    }
