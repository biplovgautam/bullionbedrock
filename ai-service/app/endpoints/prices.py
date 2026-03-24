from fastapi import APIRouter, Request
import orjson

router = APIRouter()


def _normalize_payload(payload: object) -> object:
    if payload is None:
        return None
    if isinstance(payload, bytes):
        try:
            return orjson.loads(payload)
        except orjson.JSONDecodeError:
            return payload.decode()
    if isinstance(payload, str):
        try:
            return orjson.loads(payload)
        except orjson.JSONDecodeError:
            return payload
    return payload


@router.get("/prices/latest")
async def latest_price(request: Request) -> dict:
    payload = getattr(request.app.state, "latest_payload", None)
    if payload is None:
        return {"status": "empty", "message": "No data received yet"}
    return {"status": "ok", "data": payload}


@router.get("/prices/raw")
async def raw_price(request: Request) -> dict:
    payload = getattr(request.app.state, "latest_payload", None)
    if payload is None:
        return {"status": "empty", "message": "No data received yet"}
    return {"status": "ok", "data": _normalize_payload(payload)}


@router.get("/prices/status")
async def stream_status(request: Request) -> dict:
    return {
        "status": request.app.state.stream_status,
        "status_at": request.app.state.stream_status_at,
        "last_payload_at": request.app.state.latest_payload_at,
    }
