from dataclasses import dataclass


@dataclass(frozen=True)
class EntityCachePolicy:
    namespace: str
    ttl_seconds: int


ENTITY_CACHE_TTL_SECONDS = 10 * 60
API_KEY_CACHE_TTL_SECONDS = 5 * 60 * 60

PAPER_CACHE_POLICY = EntityCachePolicy(namespace="papers", ttl_seconds=ENTITY_CACHE_TTL_SECONDS)
PROJECT_CACHE_POLICY = EntityCachePolicy(namespace="projects", ttl_seconds=ENTITY_CACHE_TTL_SECONDS)
COLLECTION_CACHE_POLICY = EntityCachePolicy(namespace="collections", ttl_seconds=ENTITY_CACHE_TTL_SECONDS)
USER_CACHE_POLICY = EntityCachePolicy(namespace="users", ttl_seconds=ENTITY_CACHE_TTL_SECONDS)
API_KEY_CACHE_POLICY = EntityCachePolicy(namespace="api_keys", ttl_seconds=API_KEY_CACHE_TTL_SECONDS)
