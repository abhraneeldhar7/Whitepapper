import logging
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.redis_client import get_redis_client, get_sync_redis_client
from app.services._dev_api_service import _dev_api_service
from app.services.cache_service import cache_service

logging.basicConfig(level=logging.INFO)

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    async_redis = get_redis_client(settings)
    sync_redis = get_sync_redis_client(settings)

    cache_service.configure(sync_redis, prefix=settings.app_name.lower())
    sync_stop_event = asyncio.Event()
    api_sync_task = asyncio.create_task(_dev_api_service.run_hourly_cache_sync(sync_stop_event))
    if async_redis:
        FastAPICache.init(RedisBackend(async_redis), prefix=f"{settings.app_name.lower()}:http")

    try:
        yield
    finally:
        sync_stop_event.set()
        try:
            await api_sync_task
        except Exception:
            api_sync_task.cancel()
        if async_redis:
            await async_redis.aclose()
        if sync_redis:
            sync_redis.close()


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://whitepapper.antk.in", "http://localhost:4321"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")
