# Whitepapper Documentation Build Plan

## Docs Root Note
- `/docs` will be finalized later as a custom `.astro` page.
- This plan starts from routed content pages like `/docs/intro`, `/docs/quickstart`, and section-based pages.

## Product Context
- Whitepapper is a markdown-first content system for developers.
- Core flow: write content, organize it, publish public pages, expose content through a project-scoped Dev API, and distribute to external platforms.
- Current hierarchy:
  - User
  - Standalone papers
  - Projects
  - Project standalone papers
  - Collections
  - Collection papers
- No workspace entity right now.

## Data Types
```ts
type UserPreferences = {
  showKeyboardEffect: boolean
  typingSoundEnabled: boolean
  hashnodeStoreInCloud: boolean
  hashnodeIntegrated: boolean
  devtoStoreInCloud: boolean
  devtoIntegrated: boolean
}

type UserDoc = {
  userId: string
  displayName: string | null
  description: string
  email: string | null
  avatarUrl: string | null
  username: string
  plan: "free" | "pro"
  preferences: UserPreferences
  createdAt: string
  updatedAt: string
}

type ProjectDoc = {
  projectId: string
  ownerId: string
  name: string
  slug: string
  description: string
  logoUrl: string | null
  isPublic: boolean
  pagesNumber: number
  createdAt: string
  updatedAt: string
}

type CollectionDoc = {
  collectionId: string
  projectId: string
  ownerId: string
  name: string
  description: string
  slug: string
  isPublic: boolean
  pagesNumber: number
  createdAt: string
  updatedAt: string
}

type PaperMetadata = {
  title: string
  metaDescription: string
  canonical: string
  robots: string
  ogTitle: string
  ogDescription: string
  ogImage: string
  ogImageWidth: number
  ogImageHeight: number
  ogImageAlt: string
  ogLocale: string
  ogPublishedTime: string
  ogModifiedTime: string
  ogAuthorUrl: string
  ogTags: string[]
  twitterTitle: string
  twitterDescription: string
  twitterImage: string
  twitterImageAlt: string
  twitterCreator: string | null
  headline: string
  abstract: string
  keywords: string
  articleSection: string
  wordCount: number
  readingTimeMinutes: number
  inLanguage: string
  datePublished: string
  dateModified: string
  authorName: string
  authorHandle: string
  authorUrl: string
  authorId: string
  coverImageUrl: string
  publisherName: string
  publisherUrl: string
  isAccessibleForFree: boolean
  license: string
}

type PaperDoc = {
  paperId: string
  collectionId: string | null
  projectId: string | null
  ownerId: string
  thumbnailUrl: string | null
  title: string
  slug: string
  body: string
  status: "draft" | "published" | "archived"
  metadata: PaperMetadata | null
  createdAt: string
  updatedAt: string
}

type ApiKeySummary = {
  keyId: string
  ownerId: string
  projectId: string
  usage: number
  limitPerMonth: number
  isActive: boolean
  createdAt: string
}

type ApiKeyCreateResponse = {
  keyId: string
  ownerId: string
  projectId: string
  usage: number
  limitPerMonth: number
  isActive: boolean
  createdAt: string
  rawKey: string
}

type HashnodeDistribution = {
  accessToken: string | null
  publicationId: string | null
}

type DevtoDistribution = {
  accessToken: string | null
}

type DistributionPublishResult = {
  platform: "hashnode" | "devto"
  postId: string
  url: string | null
}
```

## System Rules To Carry Into Docs Content
- Project visibility is controlled by `isPublic`.
- Collection visibility is controlled by `isPublic`.
- Paper public state is controlled by `status` where `published` is public.
- Changing project visibility propagates visibility to project collections.
- Changing collection visibility propagates paper status in that collection:
  - collection public => paper status `published`
  - collection private => paper status `draft`
  - archived papers stay archived
- New papers inherit status from parent context:
  - inside public project/collection => `published`
  - inside private project/collection => `draft`
  - standalone => default `draft`

## Limits
- Limits are generous and enforced in both frontend flows and backend business logic.
- Canonical backend source:
  - `fastapi/app/core/limits.py`
- Frontend mirror:
  - `astro/src/lib/limits.ts`

### Entity count limits
- `MAX_PROJECTS_PER_USER = 50`
- `MAX_COLLECTIONS_PER_PROJECT = 10`
- `MAX_PAPERS_PER_USER = 500`
- Paper limit is total-per-user across standalone papers, project standalone papers, and collection papers.

### Content length limits
- `MAX_DESCRIPTION_LENGTH = 50000`
- Applied to project and collection descriptions.
- `MAX_PAPER_BODY_LENGTH = 500000`

### Paper media limits
- `MAX_IMAGES_PER_PAPER = 20`
- Enforced during paper save/update and embedded image upload operations.

### Dev API usage limit
- `DEV_API_LIMIT_PER_MONTH = 10000`
- Used for API key creation defaults and key validation checks.

### Error behavior to document
- Project create beyond limit:
  - `400`: `Project limit reached (50). Delete an existing project to create a new one.`
- Collection create beyond limit:
  - `400`: `Collection limit reached (10) for this project.`
- Paper create beyond per-user total limit:
  - `400`: `Paper limit reached (500) for this user. Delete an existing paper to create a new one.`
- Project description too long:
  - `400`: `Project description is too long. Maximum length is 50000 characters.`
- Collection description too long:
  - `400`: `Collection description is too long. Maximum length is 50000 characters.`
- Paper body too long:
  - `400`: `Paper content is too long. Maximum length is 500000 characters.`
- Paper image limit reached:
  - `400`: `Paper image limit reached (20). Remove some images before saving.`
  - `400`: `Paper image limit reached (20). Remove some images before uploading a new one.`

## Sidebar Plan

## Getting Started
- `/docs/intro`
  - Brief description: What Whitepapper is, who it is for, and what problems it solves.
- `/docs/quickstart`
  - Brief description: Complete first-15-minutes flow in one page: create account, create project, create paper, publish, copy public URL, generate API key, test one API call.

## Core Concepts
- `/docs/projects`
  - Brief description: Project model, visibility, slug, description/logo, API tab, and how publishing works for project-level papers.
- `/docs/collections`
  - Brief description: Collection model, relation to project, visibility behavior, and how publishing works for papers inside a collection.
- `/docs/papers`
  - Brief description: Paper lifecycle (`draft`, `published`, `archived`), metadata, thumbnails, and public URL behavior.
- `/docs/slug-collision-checks`
  - Brief description: Slug normalization, uniqueness scope, availability checks, reserved path behavior, and practical collision handling rules for projects/collections/papers.

## Editor
- `/docs/editor/overview`
  - Brief description: Editor UI map, autosave behavior, manual save/publish flow, and where metadata/distribution actions live.
- `/docs/editor/media-uploads`
  - Brief description: Thumbnail uploads, embedded image uploads, metadata image uploads, and image limits.
- `/docs/editor/metadata-workflow`
  - Brief description: Metadata generation, metadata editing, and when metadata is auto-generated.

## SEO
- `/docs/seo/overview`
  - Brief description: SEO approach in Whitepapper, canonical URL strategy, and metadata ownership.
- `/docs/seo/paper-metadata`
  - Brief description: Field-by-field paper metadata usage and how each field maps to search/social/schema output.
- `/docs/seo/public-pages`
  - Brief description: SEO behavior of profile, project, and paper public pages.
- `/docs/seo/sitemaps`
  - Brief description: Sitemap endpoints and what is included in each feed.

## Dev API
- `/docs/dev-api/overview`
  - Brief description: Dev API purpose, project scoping, and public frontend usage model.
- `/docs/dev-api/authentication`
  - Brief description: `x-api-key` header, project ownership, key status checks, and quota behavior.
- `/docs/dev-api/api-key-management`
  - Brief description: Create, view, enable/disable, reset key, and usage tracking from project API tab.
- `/docs/dev-api/contracts`
  - Brief description: Full request/response contracts and error contracts for each Dev API endpoint.
  - `/docs/dev-api/contracts/project-endpoint`
    - Brief description: Contract for `GET /dev/project`.
  - `/docs/dev-api/contracts/collection-endpoint`
    - Brief description: Contract for `GET /dev/collection` with `id` or `slug`.
  - `/docs/dev-api/contracts/paper-endpoint`
    - Brief description: Contract for `GET /dev/paper` with `id` or `slug`.
- `/docs/dev-api/caching-and-errors`
  - Brief description: Cache headers, usage increment behavior, and troubleshooting by status code.

## Distribution
- `/docs/distribution/overview`
  - Brief description: Distribution model, token storage options, and publish-from-editor flow.
- `/docs/distribution/hashnode`
  - Brief description: Hashnode token setup and publish flow.
- `/docs/distribution/devto`
  - Brief description: Dev.to key setup and publish flow.
- `/docs/distribution/medium-import`
  - Brief description: Medium import flow using public paper URL.
- `/docs/distribution/platform-status`
  - Brief description: Live vs pending distribution channels and current operational state.

## Self Host
- `/docs/self-host/overview`
  - Brief description: Monorepo architecture and deployment targets.
- `/docs/self-host/environment-files`
  - Brief description: `.env.example` update requirements and exact env mapping for Astro and FastAPI.
  - `/docs/self-host/environment-files/astro-env`
    - Brief description: `astro/.env.example` variables and production values.
  - `/docs/self-host/environment-files/fastapi-env`
    - Brief description: `fastapi/.env.example` variables and production values.
- `/docs/self-host/local-run`
  - Brief description: Local bootstrap for Astro + FastAPI + worker.
- `/docs/self-host/vercel-frontend`
  - Brief description: Connect Vercel to `astro/` folder and set required env vars.
- `/docs/self-host/cloud-run-backend`
  - Brief description: Deploy FastAPI from `fastapi/` folder to Cloud Run.
- `/docs/self-host/cloudflare-worker`
  - Brief description: Deploy worker from `cloudflare-proxy/` and point it to Cloud Run.
- `/docs/self-host/cron-jobs`
  - Brief description: Configure GitHub Actions secrets and monthly/hourly jobs.
- `/docs/self-host/production-checklist`
  - Brief description: End-to-end verification checklist for self-hosted deployment.

## Slug Collision Content To Include
- Normalization logic:
  - lowercasing
  - spaces replaced with `-`
  - non `[a-z0-9-]` replaced with `-`
  - repeated `--` collapsed
  - leading/trailing `-` trimmed
- Uniqueness scope:
  - project slug: unique per owner
  - collection slug: unique per project
  - paper slug: unique per owner
- Availability endpoints:
  - `GET /projects/slug/available?slug=<slug>&projectId=<optional>`
  - `GET /collections/slug/available?slug=<slug>&projectId=<projectId>&collectionId=<optional>`
  - `GET /papers/slug/available?slug=<slug>&paperId=<optional>`
- Collision handling:
  - project create and collection create can auto-adjust to a unique slug
  - project update / collection update / paper create with duplicate explicit slug can fail with conflict response

## Dev API Contracts

### Header Contract
- Required header on all Dev API routes:

```http
x-api-key: <project_api_key>
```

### Dev Entity Types

```ts
type DevProject = Omit<ProjectDoc, "ownerId"> & { ownerId: null }
type DevCollection = Omit<CollectionDoc, "ownerId"> & { ownerId: null }
type DevPaper = Omit<PaperDoc, "ownerId"> & { ownerId: null }

type DevProjectResponse = {
  project: DevProject
  collections: DevCollection[]
}

type DevCollectionResponse = {
  collection: DevCollection
  papers: DevPaper[]
}

type DevPaperResponse = {
  paper: DevPaper
}

type ApiError = {
  detail: string
}
```

### Endpoint Contract: `GET /dev/project`
- Query params: none.
- Success `200` response type: `DevProjectResponse`.
- Errors:
  - `401` invalid/missing key
  - `403` inactive key
  - `429` monthly limit exceeded

### Endpoint Contract: `GET /dev/collection`
- Query params:
  - `id: string` or `slug: string`
  - exactly one must be provided
- Success `200` response type: `DevCollectionResponse`.
- Errors:
  - `400` invalid query (both or neither id/slug)
  - `401` invalid/missing key
  - `403` collection outside key project or inactive key
  - `404` collection not found
  - `429` monthly limit exceeded

### Endpoint Contract: `GET /dev/paper`
- Query params:
  - `id: string` or `slug: string`
  - exactly one must be provided
- Success `200` response type: `DevPaperResponse`.
- Errors:
  - `400` invalid query (both or neither id/slug)
  - `401` invalid/missing key
  - `403` paper outside key project or inactive key
  - `404` paper not found
  - `429` monthly limit exceeded

### API Key Management Contracts

#### `GET /projects/{project_id}/api-key`
- Success `200`: `ApiKeySummary | null`

#### `POST /projects/{project_id}/api-key`
- Success `201`: `ApiKeyCreateResponse`

#### `PATCH /api-keys/{key_id}`
- Request body:

```ts
type ApiKeyToggle = {
  isActive: boolean
}
```

- Success `200`: `ApiKeySummary`

#### `POST /api-keys/{key_id}/reset`
- Success `200`: `ApiKeyCreateResponse`

## Caching Context For Dev API Docs
- Dev API response headers:
  - `Cache-Control: public, max-age=300, s-maxage=300, stale-while-revalidate=300`
  - `Vary: x-api-key`
- Public API responses include cache headers and ETag behavior.
- API key usage increments in cache and is synced/reset by scheduled jobs.

## Self Host Runbook Content (Detailed)

### 1) Clone and prepare repo
```bash
git clone <your-fork-or-repo-url>
cd whitepapper
```

### 2) Create env files from examples
```bash
copy astro\.env.example astro\.env
copy fastapi\.env.example fastapi\.env
```

### 3) Update `astro/.env.example` and `astro/.env`
Required keys to document and set:
- `PUBLIC_API_BASE_URL`
- `PUBLIC_SITE_URL`
- `PRODUCTION_BASE_URL`
- `PUBLIC_PRODUCTION_BASE_URL`
- `ENVIRONMENT`
- `PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `PUBLIC_CLERK_SIGN_IN_URL`
- `PUBLIC_CLERK_SIGN_UP_URL`
- `PUBLIC_CLERK_AFTER_SIGN_IN_URL`
- `PUBLIC_CLERK_AFTER_SIGN_UP_URL`
- `WHITEPAPPER_API_KEY`

### 4) Update `fastapi/.env.example` and `fastapi/.env`
Required keys to document and set:
- `APP_NAME`
- `REDIS_PREFIX`
- `CORS_ORIGINS`
- `PUBLIC_SITE_URL`
- `CLERK_SECRET_KEY`
- `CLERK_JWT_KEY`
- `CLERK_AUTHORIZED_PARTIES`
- `CLERK_WEBHOOK_SIGNING_SECRET`
- `FIREBASE_STORAGE_BUCKET`
- `FIRESTORE_DATABASE_ID`
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `CRON_SECRET`
- `VALKEY_SERVICE_URI`
- `VALKEY_HOST`
- `VALKEY_PORT`
- `VALKEY_USER`
- `VALKEY_PASSWORD`
- `GROQ_API_KEY`

Template for `astro/.env.example`:
```env
PUBLIC_API_BASE_URL=http://127.0.0.1:8000
PUBLIC_SITE_URL=http://localhost:4321
PRODUCTION_BASE_URL=https://your-domain.example
PUBLIC_PRODUCTION_BASE_URL=https://your-domain.example
ENVIRONMENT=DEVELOPMENT
PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
PUBLIC_CLERK_SIGN_IN_URL=/login
PUBLIC_CLERK_SIGN_UP_URL=/login
PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
WHITEPAPPER_API_KEY=wp_xxx
```

Template for `fastapi/.env.example`:
```env
APP_NAME=Whitepapper_API
REDIS_PREFIX=whitepapper
CORS_ORIGINS=https://your-domain.example,http://localhost:4321
PUBLIC_SITE_URL=https://your-domain.example
CLERK_SECRET_KEY=sk_test_xxx
CLERK_JWT_KEY=-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----
CLERK_AUTHORIZED_PARTIES=https://your-domain.example,http://localhost:4321
CLERK_WEBHOOK_SIGNING_SECRET=whsec_xxx
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIRESTORE_DATABASE_ID=(default)
FIREBASE_SERVICE_ACCOUNT_JSON={...}
CRON_SECRET=change-me
VALKEY_SERVICE_URI=redis://default:password@host:6379/0
VALKEY_HOST=
VALKEY_PORT=
VALKEY_USER=
VALKEY_PASSWORD=
GROQ_API_KEY=gsk_xxx
```

### 5) Run locally
Frontend:
```bash
cd astro
npm install
npm run dev
```

Backend:
```bash
cd fastapi
python -m venv .venv
. .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 6) Connect Vercel to the correct folder
- Create Vercel project from this monorepo.
- Set project root directory to `astro/`.
- Configure all Astro env vars in Vercel project settings.
- Deploy and verify frontend can call API base URL.

### 7) Deploy backend to Google Cloud Run from the correct folder
- Deploy service from `fastapi/` folder.
- Set runtime env vars from `fastapi/.env` values.
- Ensure Cloud Run URL is reachable from frontend domain and worker.
- Verify `/health` endpoint returns `{"status":"ok"}`.

### 8) Deploy Cloudflare worker proxy from correct folder
- Use `cloudflare-proxy/` as worker project folder.
- Set worker env `CLOUD_RUN_URL` to the Cloud Run service URL.
- Deploy worker and verify proxy GET caching behavior.

### 9) Configure scheduled jobs
- In GitHub repository secrets, add:
  - `API_BASE_URL`
  - `CRON_SECRET`
- Enable workflows:
  - monthly `reset-api-usage`
  - hourly `sync-api-keys-cache`

### 10) Production verification checklist
- Authenticated dashboard works.
- Public profile/project/paper routes render.
- Dev API key creation and calls work.
- Distribution to Hashnode/Dev.to works.
- Worker proxy serves API correctly.
- Cron jobs execute successfully.

## Content Rules For Every Docs Page
- Start with one short purpose statement.
- Add prerequisites.
- Add step-by-step actions.
- Add expected output/result.
- Add common errors and fixes.
- Add related pages links.
