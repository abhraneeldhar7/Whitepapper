from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.core.limits import DEV_API_LIMIT_PER_MONTH


class AuthUser(BaseModel):
    userId: str
    sessionId: str | None = None
    email: str | None = None


class UserPreferences(BaseModel):
    showKeyboardEffect: bool = False
    typingSoundEnabled: bool = False
    hashnodeStoreInCloud: bool = False
    hashnodeIntegrated: bool = False
    devtoStoreInCloud: bool = False
    devtoIntegrated: bool = False


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
    updatedAt: datetime


class HashnodeDistribution(BaseModel):
    accessToken: str | None = None
    publicationId: str | None = None

class HashnodeDistributionUpsert(BaseModel):
    accessToken: str = Field(min_length=1)
    storeInCloud: bool = False


class DevtoDistribution(BaseModel):
    accessToken: str | None = None


class DevtoDistributionUpsert(BaseModel):
    accessToken: str = Field(min_length=1)
    storeInCloud: bool = False



class DistributionDoc(BaseModel):
    userId: str
    hashnode: HashnodeDistribution | None = None
    devto: DevtoDistribution | None = None

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
    description: str | None = None
    logoUrl: str | None = None
    isPublic: bool = True


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    slug: str | None = Field(default=None, min_length=2, max_length=80)
    description: str | None = None
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
    slug: str | None = Field(default=None, min_length=2, max_length=80)
    description: str | None = None
    isPublic: bool | None = None


class CollectionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    title: str | None = Field(default=None, min_length=1, max_length=120)
    slug: str | None = Field(default=None, min_length=2, max_length=80)
    description: str | None = None


class CollectionVisibilityToggle(BaseModel):
    isPublic: bool


class PaperMetadata(BaseModel):
    title: str
    metaDescription: str
    canonical: str
    robots: str
    ogTitle: str
    ogDescription: str
    ogImage: str
    ogImageWidth: int
    ogImageHeight: int
    ogImageAlt: str
    ogLocale: str
    ogPublishedTime: str
    ogModifiedTime: str
    ogAuthorUrl: str
    ogTags: list[str]
    twitterTitle: str
    twitterDescription: str
    twitterImage: str
    twitterImageAlt: str
    twitterCreator: str | None = None
    headline: str
    abstract: str
    keywords: str
    articleSection: str
    wordCount: int
    readingTimeMinutes: int = 1
    inLanguage: str
    datePublished: str
    dateModified: str
    authorName: str
    authorHandle: str = ""
    authorUrl: str
    authorId: str
    coverImageUrl: str
    publisherName: str = "Whitepapper"
    publisherUrl: str = ""
    isAccessibleForFree: bool
    license: str


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
    metadata: PaperMetadata | None = None
    createdAt: datetime
    updatedAt: datetime


class PublicAuthorSummary(BaseModel):
    username: str
    displayName: str | None = None
    avatarUrl: str | None = None


class PublicPaperPagePayload(BaseModel):
    paper: PaperDoc


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
    metadata: PaperMetadata | None = None


class PaperMetadataGenerate(BaseModel):
    payload: PaperDoc


class DistributionPublishInput(BaseModel):
    paperId: str
    payload: PaperDoc | None = None
    accessToken: str | None = None


class DistributionPublishResult(BaseModel):
    platform: Literal["hashnode", "devto"]
    postId: str
    url: str | None = None


class PaperCreateResponse(BaseModel):
    paperId: str


class DevProjectPayload(BaseModel):
    project: ProjectDoc
    collections: list[CollectionDoc]


class DevCollectionPayload(BaseModel):
    collection: CollectionDoc
    papers: list[PaperDoc]


class DevPaperPayload(BaseModel):
    paper: PaperDoc


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
    limitPerMonth: int = DEV_API_LIMIT_PER_MONTH
    isActive: bool = True
    createdAt: datetime


class ApiKeySummary(BaseModel):
    keyId: str
    ownerId: str
    projectId: str
    usage: int = 0
    limitPerMonth: int = DEV_API_LIMIT_PER_MONTH
    isActive: bool = True
    createdAt: datetime


class ApiKeyCreateResponse(ApiKeySummary):
    rawKey: str


class ApiKeyToggle(BaseModel):
    isActive: bool
