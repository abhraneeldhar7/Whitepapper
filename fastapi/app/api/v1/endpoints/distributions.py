from fastapi import APIRouter, Depends

from app.schemas.entities import (
    DevtoDistribution,
    DevtoDistributionUpsert,
    HashnodeDistribution,
    HashnodeDistributionUpsert,
)
from app.schemas.users import UserProfile
from app.services.auth_service import get_verified_id
from app.services.distributions_service import distributions_service
from app.services.user_service import user_service

router = APIRouter(prefix="/distributions", tags=["distributions"])


@router.get("/hashnode", response_model=HashnodeDistribution | None)
def get_hashnode_distribution(user_id: str = Depends(get_verified_id)) -> HashnodeDistribution | None:
    distribution = distributions_service.get_by_user_id(user_id)
    hashnode = distribution.get("hashnode")
    return hashnode if isinstance(hashnode, dict) else None


@router.put("/hashnode", response_model=UserProfile)
def put_hashnode_distribution(
    payload: HashnodeDistributionUpsert,
    user_id: str = Depends(get_verified_id),
) -> UserProfile:
    if payload.storeInCloud:
        distributions_service.upsert_hashnode_access_token(user_id, payload.accessToken)
    else:
        # If browser storage is chosen, clear cloud copy to keep a single source of truth.
        distributions_service.remove_hashnode_access_token(user_id)

    return user_service.update_user(
        user_id,
        {
            "preferences": {
                "hashnodeIntegrated": True,
                "hashnodeStoreInCloud": payload.storeInCloud,
            }
        },
    )


@router.delete("/hashnode", response_model=UserProfile)
def revoke_hashnode_distribution(user_id: str = Depends(get_verified_id)) -> UserProfile:
    distributions_service.remove_hashnode_access_token(user_id)
    return user_service.update_user(
        user_id,
        {
            "preferences": {
                "hashnodeIntegrated": False,
                "hashnodeStoreInCloud": False,
            }
        },
    )


@router.get("/devto", response_model=DevtoDistribution | None)
def get_devto_distribution(user_id: str = Depends(get_verified_id)) -> DevtoDistribution | None:
    distribution = distributions_service.get_by_user_id(user_id)
    devto = distribution.get("devto")
    return devto if isinstance(devto, dict) else None


@router.get("/dev.to", response_model=DevtoDistribution | None)
def get_devto_distribution_dot(user_id: str = Depends(get_verified_id)) -> DevtoDistribution | None:
    return get_devto_distribution(user_id)


@router.get("/dev-to", response_model=DevtoDistribution | None)
def get_devto_distribution_dash(user_id: str = Depends(get_verified_id)) -> DevtoDistribution | None:
    return get_devto_distribution(user_id)


@router.put("/devto", response_model=UserProfile)
def put_devto_distribution(
    payload: DevtoDistributionUpsert,
    user_id: str = Depends(get_verified_id),
) -> UserProfile:
    if payload.storeInCloud:
        distributions_service.upsert_devto_access_token(user_id, payload.accessToken)
    else:
        # If browser storage is chosen, clear cloud copy to keep a single source of truth.
        distributions_service.remove_devto_access_token(user_id)

    return user_service.update_user(
        user_id,
        {
            "preferences": {
                "devtoIntegrated": True,
                "devtoStoreInCloud": payload.storeInCloud,
            }
        },
    )


@router.put("/dev.to", response_model=UserProfile)
def put_devto_distribution_dot(
    payload: DevtoDistributionUpsert,
    user_id: str = Depends(get_verified_id),
) -> UserProfile:
    return put_devto_distribution(payload, user_id)


@router.put("/dev-to", response_model=UserProfile)
def put_devto_distribution_dash(
    payload: DevtoDistributionUpsert,
    user_id: str = Depends(get_verified_id),
) -> UserProfile:
    return put_devto_distribution(payload, user_id)


@router.delete("/devto", response_model=UserProfile)
def revoke_devto_distribution(user_id: str = Depends(get_verified_id)) -> UserProfile:
    distributions_service.remove_devto_access_token(user_id)
    return user_service.update_user(
        user_id,
        {
            "preferences": {
                "devtoIntegrated": False,
                "devtoStoreInCloud": False,
            }
        },
    )


@router.delete("/dev.to", response_model=UserProfile)
def revoke_devto_distribution_dot(user_id: str = Depends(get_verified_id)) -> UserProfile:
    return revoke_devto_distribution(user_id)


@router.delete("/dev-to", response_model=UserProfile)
def revoke_devto_distribution_dash(user_id: str = Depends(get_verified_id)) -> UserProfile:
    return revoke_devto_distribution(user_id)
