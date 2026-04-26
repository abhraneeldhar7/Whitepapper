from dataclasses import dataclass


@dataclass(frozen=True)
class EntityCachePolicy:
    namespace: str
    ttl_seconds: int


API_KEY_CACHE_TTL_SECONDS = 5 * 60 * 60

API_KEY_CACHE_POLICY = EntityCachePolicy(namespace="api_keys", ttl_seconds=API_KEY_CACHE_TTL_SECONDS)
