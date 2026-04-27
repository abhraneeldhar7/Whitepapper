from datetime import datetime
from typing import Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from app.core.limits import DEV_API_LIMIT_PER_MONTH


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


class DevtoDistribution(BaseModel):
    accessToken: str | None = None


class ProjectDoc(BaseModel):
    projectId: str
    ownerId: str
    name: str
    slug: str
    description: str
    contentGuidelines: str = ""
    logoUrl: str | None = None
    isPublic: bool = False
    pagesNumber: int = 0
    createdAt: datetime
    updatedAt: datetime


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


class PaperMetadata(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

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
    # New AI/SEO fields
    keyTakeaways: list[str] | None = None
    faq: list[dict] | None = None
    authorBio: str | None = Field(default=None, validation_alias=AliasChoices("authorBio", "author_bio"))
    jsonLd: dict | list[dict] | None = Field(default=None, validation_alias=AliasChoices("jsonLd", "jsonld"))


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
