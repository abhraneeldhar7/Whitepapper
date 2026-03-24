from fastapi import APIRouter

from app.api.v1.endpoints import collections, dev, papers, projects, public, system, users, webhooks

api_router = APIRouter()
api_router.include_router(system.router)
api_router.include_router(users.router)
api_router.include_router(projects.router)
api_router.include_router(public.router)
api_router.include_router(papers.router)
api_router.include_router(collections.router)
api_router.include_router(dev.api_keys_router)
api_router.include_router(webhooks.router)
api_router.include_router(dev.router)
