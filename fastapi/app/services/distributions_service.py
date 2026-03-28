from app.core.firestore_store import firestore_store

DISTRIBUTIONS_COLLECTION = "distributions"


class DistributionsService:
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

    def upsert_hashnode_access_token(self, user_id: str, access_token: str) -> dict:
        existing_doc = self.get_by_user_id(user_id)
        existing_doc["hashnode"] = {
            "accessToken": access_token,
        }
        return self._replace_distribution_doc(user_id, existing_doc)

    def remove_hashnode_access_token(self, user_id: str) -> dict:
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


distributions_service = DistributionsService()
