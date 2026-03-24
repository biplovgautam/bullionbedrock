# AI Service (FastAPI + Twelve Data)

High‑performance FastAPI service that streams Gold/Silver prices from Twelve Data, publishes raw data to Redis, and exposes lightweight HTTP endpoints for health and live inspection.

## Features

- Twelve Data WebSocket streaming (SDK)
- Redis publish on `bullion_prices_raw`
- REST polling fallback (price endpoint) if WebSocket doesn’t emit ticks
- FastAPI health + latest price endpoints
- CORS control for backend integration
- `.env` driven configuration (dotenv)

## Setup

### 1) Create and activate virtual environment

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 2) Install dependencies

```bash
pip install -r requirements.txt
```

### 3) Configure environment

Create `ai-service/.env`:

```env
ENV=dev
PORT=8000
REDIS_URL=redis://localhost:6379
TWELVEDATA_API_KEY=YOUR_KEY
TWELVEDATA_SYMBOLS=XAU/USD,XAGUSD
ALLOWED_ORIGINS=http://localhost:4000
```

> Use `ENV=dev` to allow all origins. For production, set `ENV=production` and keep `ALLOWED_ORIGINS` restricted.

## Run

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Endpoints

- `GET /health` — service health check
- `GET /prices/latest` — latest raw payload (string)
- `GET /prices/raw` — latest payload decoded to JSON when possible
- `GET /prices/status` — stream status and last update timestamp

## Notes

- Twelve Data WebSocket streaming is available only on paid tiers. If streaming doesn’t deliver ticks, the service falls back to REST polling every 10 seconds.
- All payloads are forwarded to Redis channel: `bullion_prices_raw`.

## Troubleshooting

- **No data in `/prices/latest`**: confirm `TWELVEDATA_API_KEY` and `TWELVEDATA_SYMBOLS`.
- **Only `subscribe-status` warnings**: the symbol may not be available in your plan — try `XAU/USD` alone or `XAGUSD`.
- **Redis errors**: ensure `REDIS_URL` is reachable and authenticated.
