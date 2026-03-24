from fastapi import HTTPException
from uuid import uuid4

from app.core.firestore_store import firestore_store, utc_now
from app.services.projects_service import projects_service
from app.services.slug_utils import normalize_slug


class CollectionsService:
    def _propagate_collection_visibility(self, collection_id: str, is_public: bool) -> None:
        target_status = "published" if is_public else "draft"
        papers = firestore_store.find_by_fields("papers", {"collectionId": collection_id})
        for paper in papers:
            current_status = paper.get("status") or "draft"
            if current_status == "archived" or current_status == target_status:
                continue
            paper_id = paper.get("paperId")
            if not paper_id:
                continue
            firestore_store.update(
                "papers",
                paper_id,
                {"status": target_status, "updatedAt": utc_now()},
            )

    def list_project_collections(self, project_id: str) -> list[dict]:
        return firestore_store.find_by_fields("collections", {"projectId": project_id})

    def create(self, owner_id: str, payload: dict) -> dict:
        collection_id = str(uuid4())
        now = utc_now()
        project_id = payload.get("projectId")
        if not project_id:
            raise HTTPException(status_code=400, detail="projectId is required.")

        project = projects_service.get_by_id(project_id)
        if project.get("ownerId") != owner_id:
            raise HTTPException(status_code=403, detail="Not allowed.")

        if payload.get("slug"):
            payload["slug"] = normalize_slug(payload["slug"])
            existing = firestore_store.find_by_fields(
                "collections",
                {
                    "projectId": project_id,
                    "slug": payload["slug"],
                },
            )
            if existing:
                raise HTTPException(status_code=409, detail="Collection slug already exists in this project.")

        if payload.get("isPublic") is None:
            payload["isPublic"] = bool(project.get("isPublic", False))
        else:
            payload["isPublic"] = bool(payload["isPublic"])

        payload["ownerId"] = owner_id
        payload["collectionId"] = collection_id
        payload["name"] = (payload.get("name") or "Untitled Collection").strip() or "Untitled Collection"
        payload["description"] = payload.get("description") or ""
        payload["pagesNumber"] = 0
        payload["createdAt"] = now
        payload["updatedAt"] = now
        firestore_store.create("collections", payload, doc_id=collection_id)
        return payload

    def update(self, collection_id: str, owner_id: str, payload: dict) -> dict:
        current = self.get_by_id(collection_id, owner_id=owner_id)

        allowed_update_fields = {"name", "title", "slug", "description"}
        payload = {key: value for key, value in payload.items() if key in allowed_update_fields}

        if "title" in payload and "name" not in payload:
            payload["name"] = payload["title"]
        payload.pop("title", None)

        if "name" in payload:
            payload["name"] = (payload.get("name") or "Untitled Collection").strip() or "Untitled Collection"

        if "description" in payload:
            payload["description"] = payload.get("description") or ""

        if "slug" in payload:
            new_slug = normalize_slug(payload.get("slug") or "")
            if not new_slug:
                raise HTTPException(status_code=400, detail="Invalid slug.")
            project_id = str(current.get("projectId") or "")
            existing = firestore_store.find_by_fields(
                "collections",
                {"projectId": project_id, "slug": new_slug},
            )
            if any(item.get("collectionId") != collection_id for item in existing):
                raise HTTPException(status_code=409, detail="Collection slug already exists in this project.")
            payload["slug"] = new_slug

        if not payload:
            return current
        payload["updatedAt"] = utc_now()
        firestore_store.update("collections", collection_id, payload)
        current.update(payload)
        return current

    def set_visibility(self, collection_id: str, owner_id: str, is_public: bool) -> dict:
        current = self.get_by_id(collection_id, owner_id=owner_id)
        target_visibility = bool(is_public)
        if bool(current.get("isPublic", False)) == target_visibility:
            return current

        payload = {"isPublic": target_visibility, "updatedAt": utc_now()}
        firestore_store.update("collections", collection_id, payload)
        current.update(payload)
        self._propagate_collection_visibility(collection_id, target_visibility)
        return current

    def delete(self, collection_id: str, owner_id: str | None = None) -> dict[str, bool]:
        _ = self.get_by_id(collection_id, owner_id=owner_id)

        from app.services.papers_service import papers_service

        papers = firestore_store.find_by_fields("papers", {"collectionId": collection_id})
        for paper in papers:
            paper_id = paper.get("paperId")
            if paper_id:
                papers_service.delete(paper_id)

        firestore_store.delete("collections", collection_id)
        return {"ok": True}

    def get_by_id(
        self,
        collection_id: str,
        owner_id: str | None = None,
    ) -> dict:
        collection = firestore_store.get("collections", collection_id)
        if not collection:
            raise HTTPException(status_code=404, detail="Collection not found.")
        if owner_id and collection.get("ownerId") != owner_id:
            raise HTTPException(status_code=403, detail="Not allowed.")
        return collection

    def get_by_slug(
        self,
        owner_id: str,
        project_id: str,
        collection_slug: str,
    ) -> dict:
        matches = firestore_store.find_by_fields(
            "collections",
            {
                "ownerId": owner_id,
                "projectId": project_id,
                "slug": normalize_slug(collection_slug),
            },
        )
        if not matches:
            raise HTTPException(status_code=404, detail="Collection not found.")
        return matches[0]


collections_service = CollectionsService()
