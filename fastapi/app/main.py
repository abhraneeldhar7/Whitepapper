import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

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
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=[
        "authorization",
        "content-type",
        "mcp-protocol-version",
        "mcp-session-id",
        "last-event-id",
    ],
    expose_headers=[
        "mcp-session-id",
        "www-authenticate",
    ],
)
app.add_middleware(McpBearerAuthMiddleware)


async def _dispatch_exact_mcp_root(request: Request) -> Response:
    response_status = 500
    response_headers: list[tuple[bytes, bytes]] = []
    response_body = bytearray()

    async def receive():
        return await request.receive()

    async def send(message):
        nonlocal response_status, response_headers
        if message["type"] == "http.response.start":
            response_status = int(message["status"])
            response_headers = list(message.get("headers", []))
            return

        if message["type"] == "http.response.body":
            response_body.extend(message.get("body", b""))

    scope = dict(request.scope)
    root_path = str(scope.get("root_path") or "")
    scope["root_path"] = f"{root_path}{MCP_HTTP_PREFIX}"
    scope["path"] = "/"
    scope["raw_path"] = b"/"

    await mcp_http_app(scope, receive, send)
    headers = {key.decode("latin-1"): value.decode("latin-1") for key, value in response_headers}
    return Response(content=bytes(response_body), status_code=response_status, headers=headers)


@app.api_route("/mcp", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
async def canonicalize_mcp_root(request: Request):
    return await _dispatch_exact_mcp_root(request)


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
