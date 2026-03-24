from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class AuthUser(BaseModel):
    userId: str
    sessionId: str | None = None
    email: str | None = None


class UserPreferences(BaseModel):
    showKeyboardEffect: bool = False
    typingSoundEnabled: bool = False


class UserDoc(BaseModel):
    userId: str
    displayName: str | None = None
    description: str = ""
    email: str | None = None
    avatarUrl: str | None = None
    username: str
    plan: Literal["free", "pro"] = "free"
    preferences: UserPreferences = Field(default_factory=UserPreferences)
    createdAt: datetime


class ProjectDoc(BaseModel):
    projectId: str
    ownerId: str
    name: str
    slug: str
    description: str
    logoUrl: str | None = None
    isPublic: bool = False
    pagesNumber: int = 0
    createdAt: datetime
    updatedAt: datetime


class ProjectCreate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=50000)
    logoUrl: str | None = None
    isPublic: bool = False


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    slug: str | None = Field(default=None, min_length=2, max_length=80)
    description: str | None = Field(default=None, max_length=50000)
    logoUrl: str | None = None


class ProjectVisibilityToggle(BaseModel):
    isPublic: bool


class CollectionDoc(BaseModel):
    collectionId: str
    projectId: str
    ownerId: str
    name: str
    description: str = ""
    slug: str
    isPublic: bool = False
    pagesNumber: int = 0
    createdAt: datetime
    updatedAt: datetime


class CollectionCreate(BaseModel):
    projectId: str
    name: str = Field(min_length=1, max_length=120)
    slug: str = Field(min_length=2, max_length=80)
    description: str | None = Field(default=None, max_length=50000)
    isPublic: bool | None = None


class CollectionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    title: str | None = Field(default=None, min_length=1, max_length=120)
    slug: str | None = Field(default=None, min_length=2, max_length=80)
    description: str | None = Field(default=None, max_length=50000)


class CollectionVisibilityToggle(BaseModel):
    isPublic: bool


class PaperDoc(BaseModel):
    paperId: str
    collectionId: str | None = None
    projectId: str | None = None
    ownerId: str
    thumbnailUrl: str | None = None
    title: str
    slug: str
    body: str = ""
    status: Literal["draft", "published", "archived"] = "draft"
    createdAt: datetime
    updatedAt: datetime


class PublicAuthorSummary(BaseModel):
    username: str
    displayName: str | None = None
    avatarUrl: str | None = None


class PublicPaperPagePayload(BaseModel):
    paper: PaperDoc
    author: PublicAuthorSummary


class PaperCreate(BaseModel):
    collectionId: str | None = None
    projectId: str | None = None
    thumbnailUrl: str | None = None
    title: str | None = Field(default=None, min_length=1, max_length=200)
    slug: str | None = Field(default=None, min_length=2, max_length=120)
    body: str = ""
    status: Literal["draft", "published", "archived"] = "draft"


class PaperUpdate(BaseModel):
    collectionId: str | None = None
    projectId: str | None = None
    thumbnailUrl: str | None = None
    title: str | None = Field(default=None, min_length=1, max_length=200)
    slug: str | None = Field(default=None, min_length=2, max_length=120)
    body: str | None = None
    status: Literal["draft", "published", "archived"] | None = None


class PaperCreateResponse(BaseModel):
    paperId: str


class DevProjectPayload(BaseModel):
    project: ProjectDoc
    collections: list[CollectionDoc]
    papers: list[PaperDoc]


class DevCollectionPayload(BaseModel):
    collection: CollectionDoc
    papers: list[PaperDoc]


class DevPaperPayload(BaseModel):
    paper: PaperDoc
    project: ProjectDoc | None = None
    collection: CollectionDoc | None = None


class DashboardPayload(BaseModel):
    user: UserDoc
    projects: list[ProjectDoc]
    papers: list[PaperDoc]


class ProjectDashboardPayload(BaseModel):
    project: ProjectDoc
    collections: list[CollectionDoc]
    papers: list[PaperDoc]


class ApiKeyDoc(BaseModel):
    keyId: str
    ownerId: str
    projectId: str
    keyHash: str
    usage: int = 0
    limitPerMonth: int = 10000
    isActive: bool = True
    createdAt: datetime


class ApiKeySummary(BaseModel):
    keyId: str
    ownerId: str
    projectId: str
    usage: int = 0
    limitPerMonth: int = 10000
    isActive: bool = True
    createdAt: datetime


class ApiKeyCreateResponse(ApiKeySummary):
    rawKey: str


class ApiKeyToggle(BaseModel):
    isActive: bool
