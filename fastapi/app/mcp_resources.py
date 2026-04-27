from __future__ import annotations

from functools import lru_cache

from fastmcp import FastMCP

from app.mcp.common import McpUsageMiddleware
from app.mcp.read_tools import register_read_tools
from app.mcp.write_tools import register_write_tools


@lru_cache(maxsize=1)
def _build_mcp_server() -> FastMCP:
    server = FastMCP(
        name="whitepapper",
        instructions="""
You are connected to Whitepapper at the account level.
Use these tools like building blocks:
- Start with get_workspace_overview, list_projects, list_collections, or list_papers for cheap discovery.
- Prefer list tools and projection params before expensive full reads.
- Prefer IDs after discovery because IDs are exact.
- Use batch tools to avoid one-call-per-document loops.
- Use verbose=true only when you need the full mutation result.

Token-saving guidance:
- Most paper list tools omit body by default.
- Optional fields / excludeFields let you request only what you need.
- Pagination uses cursor-based Firestore paging. Reuse nextCursor rather than refetching from the start.
        """.strip(),
        middleware=[McpUsageMiddleware()],
    )
    register_read_tools(server)
    register_write_tools(server)
    return server


@lru_cache(maxsize=1)
def build_mcp_app():
    return _build_mcp_server().http_app(path="/", transport="http", stateless_http=True)
