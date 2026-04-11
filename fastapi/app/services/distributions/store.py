from app.core.firestore_store import firestore_store

DISTRIBUTIONS_COLLECTION = "distributions"
_UNSET = object()


class DistributionsStoreService:
    def get_by_user_id(self, user_id: str) -> dict:
        doc = firestore_store.get(DISTRIBUTIONS_COLLECTION, user_id)
        if doc:
            return doc
        return {
            "userId": user_id,
            "hashnode": None,
            "devto": None,
        }

    def _replace_distribution_doc(self, user_id: str, distribution_doc: dict) -> dict:
        distribution_doc["userId"] = user_id
        firestore_store.update(DISTRIBUTIONS_COLLECTION, user_id, distribution_doc, merge=False)
        return distribution_doc

    def _update_hashnode_distribution(
        self,
        user_id: str,
        *,
        access_token: str | None | object = _UNSET,
        publication_id: str | None | object = _UNSET,
    ) -> dict:
        existing_doc = self.get_by_user_id(user_id)
        current_hashnode = existing_doc.get("hashnode")
        next_hashnode = dict(current_hashnode) if isinstance(current_hashnode, dict) else {}

        if access_token is not _UNSET:
            if access_token:
                next_hashnode["accessToken"] = access_token
            else:
                next_hashnode.pop("accessToken", None)

        if publication_id is not _UNSET:
            if publication_id:
                next_hashnode["publicationId"] = publication_id
            else:
                next_hashnode.pop("publicationId", None)

        existing_doc["hashnode"] = next_hashnode or None
        return self._replace_distribution_doc(user_id, existing_doc)

    def upsert_hashnode_access_token(self, user_id: str, access_token: str) -> dict:
        return self._update_hashnode_distribution(user_id, access_token=access_token)

    def clear_hashnode_access_token(self, user_id: str) -> dict:
        return self._update_hashnode_distribution(user_id, access_token=None)

    def set_hashnode_publication_id(self, user_id: str, publication_id: str) -> dict:
        return self._update_hashnode_distribution(user_id, publication_id=publication_id)

    def remove_hashnode_distribution(self, user_id: str) -> dict:
        existing_doc = self.get_by_user_id(user_id)
        existing_doc["hashnode"] = None
        return self._replace_distribution_doc(user_id, existing_doc)

    def upsert_devto_access_token(self, user_id: str, access_token: str) -> dict:
        existing_doc = self.get_by_user_id(user_id)
        existing_doc["devto"] = {
            "accessToken": access_token,
        }
        return self._replace_distribution_doc(user_id, existing_doc)

    def remove_devto_access_token(self, user_id: str) -> dict:
        existing_doc = self.get_by_user_id(user_id)
        existing_doc["devto"] = None
        return self._replace_distribution_doc(user_id, existing_doc)

    def get_hashnode_access_token(self, user_id: str) -> str | None:
        hashnode = self.get_by_user_id(user_id).get("hashnode")
        if not isinstance(hashnode, dict):
            return None
        access_token = str(hashnode.get("accessToken") or "").strip()
        return access_token or None

    def get_devto_access_token(self, user_id: str) -> str | None:
        devto = self.get_by_user_id(user_id).get("devto")
        if not isinstance(devto, dict):
            return None
        access_token = str(devto.get("accessToken") or "").strip()
        return access_token or None

    def get_hashnode_publication_id(self, user_id: str) -> str | None:
        hashnode = self.get_by_user_id(user_id).get("hashnode")
        if not isinstance(hashnode, dict):
            return None
        publication_id = str(hashnode.get("publicationId") or "").strip()
        return publication_id or None


distributions_store_service = DistributionsStoreService()
