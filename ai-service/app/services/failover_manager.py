import asyncio
import logging
import time
from typing import Literal
from fastapi import FastAPI

logger = logging.getLogger("ai-service")

class FailoverManager:
    def __init__(self, app: FastAPI):
        self.app = app
        self.primary_last_seen = 0.0
        self.primary_stable_since = None
        self.failover_threshold = 30.0  # Seconds
        self.recovery_threshold = 60.0  # Seconds
        self.last_mode = "primary"

    def record_update(self, provider: Literal["twelvedata", "finnhub"]):
        if provider == "twelvedata":
            self.primary_last_seen = time.time()
            if self.primary_stable_since is None:
                self.primary_stable_since = time.time()
        
    async def run_loop(self):
        logger.info("Failover Manager started")
        while True:
            await asyncio.sleep(5)
            now = time.time()
            
            # 1. Circuit Breaker: Check for Primary Failure
            is_primary_stale = (now - self.primary_last_seen) > self.failover_threshold
            
            if is_primary_stale and self.app.state.provider_mode == "primary":
                # Log exactly once when switching to Secondary
                if self.last_mode != "secondary":
                    logger.warning("Primary down. Switched to Secondary.")
                    self.last_mode = "secondary"
                
                self.app.state.provider_mode = "secondary"
                self.primary_stable_since = None

            # 2. Recovery Probe: Check for Primary Stability
            if not is_primary_stale:
                if self.primary_stable_since and (now - self.primary_stable_since) > self.recovery_threshold:
                    if self.app.state.provider_mode == "secondary":
                        # Log exactly once when switching back to Primary
                        if self.last_mode != "primary":
                            logger.info("Primary recovered. Switched back to Twelve Data.")
                            self.last_mode = "primary"
                            
                        self.app.state.provider_mode = "primary"
            else:
                self.primary_stable_since = None

            # Update health status
            self.app.state.primary_healthy = not is_primary_stale
