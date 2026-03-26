from redis import Redis as SyncRedis
from redis.asyncio import Redis as AsyncRedis

from app.core.config import Settings


def _redis_kwargs(settings: Settings) -> dict:
    return {
        "host": settings.valkey_host,
        "port": settings.valkey_port,
        "username": settings.valkey_user,
        "password": settings.valkey_password,
        "ssl": True,
        "decode_responses": False,
    }


def get_redis_client(settings: Settings) -> AsyncRedis | None:
    if settings.valkey_service_uri:
        return AsyncRedis.from_url(settings.valkey_service_uri, decode_responses=False)

    if not settings.valkey_host or not settings.valkey_port:
        return None

    return AsyncRedis(**_redis_kwargs(settings))


def get_sync_redis_client(settings: Settings) -> SyncRedis | None:
    if settings.valkey_service_uri:
        return SyncRedis.from_url(settings.valkey_service_uri, decode_responses=False)

    if not settings.valkey_host or not settings.valkey_port:
        return None

    return SyncRedis(**_redis_kwargs(settings))
