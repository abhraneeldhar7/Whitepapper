from redis import Redis

from app.core.config import Settings

_redis_client: Redis | None = None
_cache_prefix: str = "whitepapper"


def _redis_kwargs(settings: Settings) -> dict:
    return {
        "host": settings.valkey_host,
        "port": settings.valkey_port,
        "username": settings.valkey_user,
        "password": settings.valkey_password,
        "ssl": True,
        "decode_responses": False,
    }


def _build_redis_client(settings: Settings) -> Redis | None:
    if settings.valkey_service_uri:
        return Redis.from_url(settings.valkey_service_uri, decode_responses=False)

    if not settings.valkey_host or not settings.valkey_port:
        return None

    return Redis(**_redis_kwargs(settings))


def init_redis_client(settings: Settings) -> Redis | None:
    global _redis_client, _cache_prefix
    _redis_client = _build_redis_client(settings)
    _cache_prefix = settings.redis_prefix
    return _redis_client


def get_redis_client() -> Redis | None:
    return _redis_client


def get_cache_prefix() -> str:
    return _cache_prefix
