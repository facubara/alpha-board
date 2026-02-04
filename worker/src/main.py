import logging

import uvicorn
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI

from src.config import settings

logging.basicConfig(level=settings.log_level)
logger = logging.getLogger(__name__)

app = FastAPI(title="Alpha Worker", version="0.1.0")
scheduler = AsyncIOScheduler()


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/status")
async def status():
    jobs = [{"id": j.id, "next_run": str(j.next_run_time)} for j in scheduler.get_jobs()]
    return {"scheduler": "running" if scheduler.running else "stopped", "jobs": jobs}


@app.on_event("startup")
async def on_startup():
    # Pipeline scheduling will be wired in Phase 6
    scheduler.start()
    logger.info("Scheduler started")


@app.on_event("shutdown")
async def on_shutdown():
    scheduler.shutdown(wait=False)
    logger.info("Scheduler stopped")


if __name__ == "__main__":
    uvicorn.run("src.main:app", host="0.0.0.0", port=settings.worker_port, reload=True)
