import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings, parse_csv
from app.core.redis_client import init_redis_client
from app.mcp_server import MCP_HTTP_PREFIX, build_mcp_app, build_mcp_router, get_mcp_session_manager

logging.basicConfig(level=logging.INFO)

settings = get_settings()
init_redis_client(settings)
_public_api_url = str(settings.public_api_url or "").strip().rstrip("/")
_mcp_resource_url = f"{_public_api_url}/mcp/"
_mcp_authorization_uri = f"{_mcp_resource_url.rstrip('/')}/authorize"


class McpAuthChallengeCompatibilityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        if not request.url.path.startswith("/mcp"):
            return response
        if response.status_code != 401:
            return response

        challenge = str(response.headers.get("www-authenticate") or "").strip()
        if not challenge.lower().startswith("bearer "):
            return response

        normalized = challenge.lower()
        next_challenge = challenge
        if 'authorization_uri="' not in normalized:
            next_challenge = f'{next_challenge}, authorization_uri="{_mcp_authorization_uri}"'
        if 'resource="' not in normalized:
            next_challenge = f'{next_challenge}, resource="{_mcp_resource_url}"'
        if 'scope="' not in normalized:
            next_challenge = f'{next_challenge}, scope="mcp"'

        response.headers["www-authenticate"] = next_challenge
        return response


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Required by FastMCP streamable-http transport to initialize internal task group.
    build_mcp_app()
    async with get_mcp_session_manager().run():
        yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)
cors_origins = parse_csv(settings.cors_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(McpAuthChallengeCompatibilityMiddleware)


@app.middleware("http")
async def no_cache_mcp(request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path.startswith(MCP_HTTP_PREFIX) or path.startswith("/.well-known"):
        response.headers["Cache-Control"] = "no-store, no-cache"
    return response


app.include_router(api_router)
app.include_router(build_mcp_router())
app.mount("/mcp", build_mcp_app())
