import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings, parse_csv
from app.mcp_auth import MCP_HTTP_PREFIX, McpBearerAuthMiddleware, build_mcp_router
from app.core.redis_client import init_redis_client
from app.mcp_resources import build_mcp_app

logging.basicConfig(level=logging.INFO)

settings = get_settings()
init_redis_client(settings)
mcp_http_app = build_mcp_app()


app = FastAPI(title=settings.app_name, lifespan=mcp_http_app.lifespan)
cors_origins = parse_csv(settings.cors_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "authorization",
        "content-type",
        "cache-control",
        "mcp-protocol-version",
        "mcp-session-id",
        "last-event-id",
        "x-api-key",
    ],
    expose_headers=[
        "mcp-session-id",
        "www-authenticate",
        "cache-control",
    ],
)
app.add_middleware(McpBearerAuthMiddleware)


@app.middleware("http")
async def route_mcp_root(request: Request, call_next):
    if request.url.path in (MCP_HTTP_PREFIX, MCP_HTTP_PREFIX + "/"):
        if request.method == "GET":
            from fastapi.responses import JSONResponse
            return JSONResponse({
                "serverName": "whitepapper",
                "transport": "http",
                "endpointUrl": f"{str(settings.public_api_url or '').rstrip('/')}/mcp",
            })
        if request.url.path == MCP_HTTP_PREFIX:
            scope = request.scope
            scope["path"] = MCP_HTTP_PREFIX + "/"
            scope["raw_path"] = (MCP_HTTP_PREFIX + "/").encode()
    return await call_next(request)


@app.middleware("http")
async def no_cache_mcp(request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path.startswith(MCP_HTTP_PREFIX) or path.startswith("/.well-known") or path.startswith("/oauth"):
        response.headers["Cache-Control"] = "no-store, no-cache"
    return response


app.include_router(api_router)
app.include_router(build_mcp_router())
app.mount("/mcp", mcp_http_app)
