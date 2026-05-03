from __future__ import annotations

from redis import Redis

from app.core.config import Settings

_client: Redis | None = None


def _redis_kwargs(settings: Settings) -> dict:
    return {
        "host": settings.redis_host,
        "port": settings.redis_port,
        "username": settings.redis_user,
        "password": settings.redis_password,
        "ssl": True,
        "decode_responses": False,
    }


def _build(settings: Settings) -> Redis | None:
    if settings.redis_service_uri:
        return Redis.from_url(settings.redis_service_uri, decode_responses=False)
    if not settings.redis_host or not settings.redis_port:
        return None
    return Redis(**_redis_kwargs(settings))


def init_redis_client(settings: Settings) -> Redis | None:
    global _client
    _client = _build(settings)
    return _client


def get_redis_client() -> Redis | None:
    return _client
