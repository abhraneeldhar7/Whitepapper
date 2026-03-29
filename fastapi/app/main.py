import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings, parse_csv
from app.core.redis_client import init_redis_client

logging.basicConfig(level=logging.INFO)

settings = get_settings()
init_redis_client(settings)


app = FastAPI(title=settings.app_name)
cors_origins = parse_csv(settings.cors_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1024)

app.include_router(api_router)
