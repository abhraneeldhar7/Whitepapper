import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import APIRouter, HTTPException, Query

from app.core.config import get_settings

router = APIRouter(prefix="/site-blogs", tags=["site-blogs"])


def _resolve_target_url(path: str, slug: str) -> str:
    settings = get_settings()
    base_url = (settings.whitepapper_api_url or "").strip().rstrip("/")
    if not base_url:
        raise HTTPException(status_code=500, detail="WHITEPAPPER_API_URL is not configured.")
    query = urlencode({"slug": slug})
    return f"{base_url}/dev/{path}?{query}"


def _resolve_api_key() -> str:
    settings = get_settings()
    api_key = (settings.whitepapper_api_key or "").strip()
    if not api_key:
        raise HTTPException(status_code=500, detail="WHITEPAPPER_API_KEY is not configured.")
    return api_key


def _fetch_by_slug(path: str, slug: str) -> dict:
    url = _resolve_target_url(path, slug)
    request = Request(
        url,
        method="GET",
        headers={
            "x-api-key": _resolve_api_key(),
            "accept": "application/json",
        },
    )

    try:
        with urlopen(request, timeout=15) as response:
            body = response.read().decode("utf-8")
            return json.loads(body) if body else {}
    except HTTPError as error:
        detail = error.read().decode("utf-8").strip()
        raise HTTPException(status_code=error.code, detail=detail or "Upstream request failed.") from error
    except URLError as error:
        raise HTTPException(status_code=502, detail="Unable to reach upstream API.") from error
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=502, detail="Upstream API returned invalid JSON.") from error


@router.get("/collection")
def get_collection_by_slug(slug: str = Query(..., min_length=1)) -> dict:
    return _fetch_by_slug("collection", slug)


@router.get("/paper")
def get_paper_by_slug(slug: str = Query(..., min_length=1)) -> dict:
    return _fetch_by_slug("paper", slug)
