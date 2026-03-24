# BullionBedrock Monorepo

High-performance monorepo for a 3D Bullion Visualizer with three services:
- `frontend` (Next.js + Three.js)
- `backend` (Fastify gateway)
- `ai-service` (FastAPI calculations + price ratio publisher)

## Local development (no Docker)

### Prerequisites
- Node.js 20+
- npm 10+
- Python 3.10+
- Redis running cloud

### Install JS dependencies
```bash
npm install
```

### Run frontend
```bash
npm run dev:frontend
```

### Run backend
```bash
npm run dev:backend
```

### Run ai-service
```bash
cd ai-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Notes
- Each service is designed to be hosted independently on separate VPS instances.
- Dockerfiles can be added later per service (`frontend/Dockerfile`, `backend/Dockerfile`, `ai-service/Dockerfile`).
