# Testing Guide — Whitepapper

Comprehensive testing strategy covering the entire monorepo before release.

---

## 1. Test Stack Setup

### 1.1 Frontend (`astro/`)

Install test dependencies:

```bash
cd astro
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react
npm install -D @playwright/test    # for E2E
npx playwright install             # download browsers
```

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: { provider: "v8", reporter: ["text", "html", "lcov"] },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

Add to `astro/package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage",
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

### 1.2 Backend (`fastapi/`)

```bash
cd fastapi
pip install pytest pytest-asyncio pytest-cov httpx moto  # moto for Firebase emulation
```

`pyproject.toml` test config:

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["app"]
asyncio_mode = "auto"
markers = [
    "slow: slow tests (integration, network)",
    "firestore: requires Firestore emulator",
    "redis: requires Redis running",
    "mcp: MCP-specific tests",
]
```

`conftest.py`:

```python
@pytest.fixture(autouse=True)
def mock_env(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "TEST")
    monkeypatch.setenv("PUBLIC_SITE_URL", "http://localhost:4321")
    # mocks for firebase, redis, clerk, groq
```

---

## 2. Frontend Tests

### 2.1 Unit Tests — Utility Functions

**File**: `src/lib/utils.test.ts`

| Test | What to cover |
|------|---------------|
| `cn()` | class merging with tailwind-merge, conditional classes, falsy values filtering |
| `formatDate()` | ISO string → locale, edge cases (epoch, far future, invalid) |
| `slugify()` | spaces → hyphens, uppercase → lowercase, special chars stripped |

**Example**:

```ts
import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("merges tailwind classes", () => {
    expect(cn("px-4", "px-2")).toBe("px-2");
  });
  it("filters falsy values", () => {
    expect(cn("base", false && "hidden", null, undefined, "visible")).toBe("base visible");
  });
});
```

### 2.2 Unit Tests — API Client

**File**: `src/lib/api/client.test.ts`

| Test | What to cover |
|------|---------------|
| `apiClient.get()` builds correct URL with query params | URL construction |
| `apiClient.get()` sends Authorization header when mode=required | Header correctness |
| `apiClient` handles 401 → throws ApiError | Error handling |
| `apiClient` handles timeout → throws NetworkError | Timeout behavior |
| `resolveApiBaseUrl()` falls back to window.location.origin | SSR safety |

### 2.3 Unit Tests — Dev API

**File**: `src/lib/api/dev.test.ts`

| Test | What to cover |
|------|---------------|
| `getDevProject()` sends `x-api-key` header | Header injection |
| `getDevProject()` constructs correct URL | URL correctness |
| Non-200 responses throw with body as message | Error propagation |
| `getDevCollection()` passes id/slug query param correctly | Query param handling |

### 2.4 Unit Tests — Components

**File**: `src/components/apiShowcase.test.tsx`

| Test | What to cover |
|------|---------------|
| Renders endpoint selector buttons | Basic rendering |
| Clicking an endpoint changes displayed variables | State update |
| Missing required variables shows error message | Validation |
| Successful API call displays response JSON | Success flow |
| Failed API call displays error | Error flow |
| Code snippet replaces placeholders correctly | Template rendering |
| Language toggle switches between TS/Python | Language toggle |

**Example**:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ApiShowcase } from "./apiShowcase";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/api/dev", () => ({
  getDevProject: vi.fn().mockResolvedValue({ project: { name: "Test" }, collections: [] }),
  getDevCollection: vi.fn(),
  getDevPaper: vi.fn(),
}));

describe("ApiShowcase", () => {
  it("renders endpoint buttons", () => {
    render(<ApiShowcase />);
    expect(screen.getByText("Project")).toBeDefined();
    expect(screen.getByText("Collection")).toBeDefined();
    expect(screen.getByText("Paper")).toBeDefined();
  });

  it("shows error when required fields missing", async () => {
    render(<ApiShowcase />);
    fireEvent.click(screen.getByText("Run"));
    await waitFor(() => {
      expect(screen.getByText(/Missing required variables/)).toBeDefined();
    });
  });
});
```

### 2.5 Unit Tests — ProjectWorkspace

**File**: `src/components/project/ProjectWorkspace.test.tsx`

| Test | What to cover |
|------|---------------|
| Renders tabs (Overview, API, Settings) | Tab rendering |
| Clicking tab switches visible panel | Tab switching |
| Renders skeleton during loading | Loading state |
| Fetches project data on mount | Data fetching |

### 2.6 Integration Tests — Page Render

**File**: `src/pages/index.test.ts` (Astro/Vitest integration)

| Test | What to cover |
|------|---------------|
| Homepage renders without errors | Page integrity |
| Dashboard redirects unauthenticated users | Auth guard |
| Public paper page renders correct metadata | SEO rendering |
| Sitemap generates valid XML | Sitemap generation |

---

## 3. Backend Tests

### 3.1 Unit Tests — Services

**All service files** in `app/services/` need test coverage.

#### `test_dev_api_service.py`

| Test | What to cover |
|------|---------------|
| `validate_key` hashes raw key and queries Firestore | Hash correctness |
| `validate_key` raises 401 for unknown key | Invalid key |
| `validate_key` raises 403 for inactive key | Inactive key |
| `validate_key` raises 429 when usage >= limit | Rate limiting |
| `create` generates key with `wp_` prefix + UUID | Key formatting |
| `create` stores SHA-256 hash, not raw key | Security |
| `get_project_api_key` filters by projectId + ownerId | Auth scoping |
| `reset` generates new key, preserves project binding | Key rotation |
| `increment_usage` atomically increments counter | Usage tracking |
| `toggle_active` flips isActive flag | Key enable/disable |

#### `test_papers_service.py`

| Test | What to cover |
|------|---------------|
| `create` sets default fields (status=draft, createdAt) | Defaults |
| `create` validates body size limits | Body limits |
| `get_by_id` returns paper or None | Get by ID |
| `update` merges fields, updates updatedAt | Partial update |
| `delete` removes paper and associated images | Cascade delete |
| `list_by_collectionId` filters by collection | Collection filter |
| `list_by_projectId` supports `standalone` filter | Standalone filter |
| Slug uniqueness enforced per project | Slug scoping |
| `list_owned_papers` paginates correctly | Pagination |

**Example**:

```python
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.papers_service import PapersService

@pytest.fixture
def service():
    return PapersService()

@patch("app.services.papers_service.papers_service")
def test_create_sets_default_status(mock_store):
    mock_store.create.return_value = {"paperId": "p1", "status": "draft"}
    result = service.create(ownerId="u1", projectId="pr1", title="Test")
    assert result["status"] == "draft"
```

#### `test_collections_service.py`

| Test | What to cover |
|------|---------------|
| Create with default visibility | Defaults |
| Cascade delete removes all child papers | Cascade |
| Visibility propagation to child papers | Propagation |
| Slug uniqueness per project | Uniqueness |

#### `test_projects_service.py`

| Test | What to cover |
|------|---------------|
| Create sets ownerId correctly | Ownership |
| Visibility propagation to collections + papers | Propagation |
| Delete cascades to collections, papers, uploads | Cascade |
| Logo upload updates thumbnailUrl | Image handling |

#### `test_user_service.py`

| Test | What to cover |
|------|---------------|
| Create user doc from Clerk webhook | Webhook handling |
| Username release cooldown (7 days) | Cooldown |
| Cascade delete removes all user data | Data cleanup |

#### `test_paper_metadata_service.py`

| Test | What to cover |
|------|---------------|
| Canonical URL construction | URL building |
| OG tag generation | Open Graph |
| Twitter card generation | Twitter Cards |
| JSON-LD structuring | Structured data |
| AI metadata generation using Groq (mock) | AI integration |

#### `test_groq_service.py`

| Test | What to cover |
|------|---------------|
| Calls Groq API with correct prompt | Prompt construction |
| Parses AI response into structured fields | Response parsing |
| Handles API error gracefully | Error handling |

#### `test_auth_service.py`

| Test | What to cover |
|------|---------------|
| `get_verified_id` decodes valid Clerk JWT | Token verification |
| Returns None for expired/invalid JWT | Token expiry |
| Requires Authorization: Bearer header | Header format |

#### `test_distributions.py`

| Test | What to cover |
|------|---------------|
| Hashnode publication fetch | Hashnode API |
| Dev.to publish article | Dev.to API |
| Token storage/retrieval | Token management |
| Token rotation | Security |

### 3.2 Unit Tests — MCP

#### `test_mcp_auth.py`

| Test | What to cover |
|------|---------------|
| PKCE code challenge verification | PKCE flow |
| Token exchange returns valid Bearer token | Token exchange |
| Consent flow creates authorization | Consent flow |
| Token revocation removes access | Revocation |
| Usage tracking increments correctly | Usage |
| Authorization expiry | Expiry |

#### `test_mcp_read_tools.py`

| Test | What to cover |
|------|---------------|
| All 15 read tools return correct shapes | Tool output |
| `list_papers` returns paginated results | Pagination |
| `search_papers` filters by query | Search |
| Error handling for invalid IDs | Error handling |

#### `test_mcp_write_tools.py`

| Test | What to cover |
|------|---------------|
| `create_paper` creates valid paper | Creation |
| `update_paper` partial update | Update |
| `delete_paper` removes paper | Deletion |
| `create_project` sets required fields | Required fields |
| Input validation rejects bad data | Validation |

### 3.3 Unit Tests — API Endpoints

#### `test_endpoints_dev.py`

| Test | What to cover |
|------|---------------|
| `GET /dev/project` returns project + collections | Response shape |
| Missing `x-api-key` returns 401 | Auth required |
| Invalid key returns 401 | Invalid key |
| Inactive key returns 403 | Inactive key |
| Response has Cache-Control headers | Caching |
| Usage counter increments per call | Usage tracking |

**Example**:

```python
from httpx import AsyncClient, ASGITransport
import pytest
from app.main import app

@pytest.mark.asyncio
async def test_dev_project_missing_key():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/dev/project")
        assert resp.status_code == 401
        assert "Missing x-api-key" in resp.text
```

#### `test_endpoints_papers.py`

| Test | What to cover |
|------|---------------|
| `GET /papers` returns owned papers | Auth scope |
| `POST /papers` creates paper with auth | Creation |
| `PATCH /papers/{id}` partial update | Update |
| `DELETE /papers/{id}` removes paper | Deletion |
| Non-owner cannot modify | Authorization |
| Body size validation | Body limits |
| Empty slug generates one | Slug generation |

#### `test_endpoints_projects.py`

| Test | What to cover |
|------|---------------|
| `GET /projects` returns user's projects | Scope |
| `POST /projects` creates project | Creation |
| `DELETE /projects/{id}` cascade deletes | Cascade |

#### `test_endpoints_collections.py`

| Test | What to cover |
|------|---------------|
| `GET /collections` filtered by projectId | Project scoping |
| `POST /collections` creates in project | Creation |
| PATCH updates visibility | Visibility |

#### `test_endpoints_public.py`

| Test | What to cover |
|------|---------------|
| `GET /public/{handle}` returns public profile | Public access |
| `GET /public/{handle}/papers/{slug}` only returns published | Status filter |
| Returns 404 for drafts | Draft protection |
| Non-existent handle returns 404 | Not found |
| Sitemap endpoints return valid XML | Sitemap |

#### `test_endpoints_users.py`

| Test | What to cover |
|------|---------------|
| `GET /users/me` returns current user | Auth |
| `PATCH /users/me` updates fields | Update |
| Username uniqueness check | Uniqueness |

#### `test_endpoints_webhooks.py`

| Test | What to cover |
|------|---------------|
| Clerk webhook with valid signature processes event | Webhook verification |
| Invalid signature returns 401 | Security |
| `user.created` creates user doc | User creation |
| `user.deleted` cascades delete | User deletion |

#### `test_endpoints_health.py`

| Test | What to cover |
|------|---------------|
| `GET /health` returns 200 | Health check |
| Response contains expected fields | Response shape |

### 3.4 Integration Tests

| Test | What it validates |
|------|------------------|
| Full create-project → add-collection → write-paper → publish flow | Complete CRUD |
| Dev API key create → use key → get project data | Dev API flow |
| Clerk login → protected route access | Auth flow |
| Paper creation → distribute to Hashnode → verify | Distribution flow |
| MCP OAuth → connect → read papers tool → write paper | MCP flow |
| Rate limit exceeded → 429 response | Rate limiting |
| Monthly usage reset → usage counter resets | Cron behavior |
| Redis cache → Firestore sync consistency | Cache sync |

---

## 4. End-to-End (E2E) Tests

Using Playwright. Test **critical user journeys**.

### 4.1 Auth Flow

**File**: `e2e/auth.spec.ts`

```
? User lands on homepage → sees CTA buttons
? User clicks Login → redirected to Clerk sign-in
? User signs up with Google → redirected to dashboard
? User signs up with email → redirected to dashboard
? User without project → sees empty state
? User logs out → redirected to homepage
? Protected routes redirect unauthenticated users to login
```

### 4.2 Paper Lifecycle

**File**: `e2e/paper.spec.ts`

```
? User creates a new paper → lands in editor
? User writes markdown content → preview renders correctly
? User adds a thumbnail → thumbnail displays
? User saves draft → paper appears in dashboard
? User publishes paper → paper appears on public profile
? User visits public paper page → correct title, body, metadata
? User deletes paper → paper removed from dashboard
? 404 shown for deleted paper's public URL
```

### 4.3 Project & Collection Management

**File**: `e2e/project.spec.ts`

```
? User creates a project → project shows in dashboard
? User adds a collection to project → collection appears
? User moves paper into collection → paper listed in collection
? User toggles project visibility → public page reflects change
? User deletes project → all child content removed
```

### 4.4 Dev API Showcase

**File**: `e2e/api-showcase.spec.ts`

```
? User navigates to API tab in project workspace
? User enters API key → clicks Run → sees project data
? User switches to Collection endpoint → enters slug → sees data
? User switches to Paper endpoint → enters ID → sees data
? Empty/missing API key → validation error shown
? Code snippets match actual API responses
```

### 4.5 Settings & Profile

**File**: `e2e/settings.spec.ts`

```
? User updates profile name → reflected immediately
? User generates API key → key shown once
? User toggles API key inactive → dev endpoint returns 403
? User resets API key → old key invalid, new key works
```

### 4.6 MCP Connection (UI)

**File**: `e2e/mcp.spec.ts`

```
? User visits /mcp/connect → sees consent UI
? User approves → sees confirmation
? User revokes authorization → token invalidated
```

### 4.7 Mobile Responsiveness

```
? Dashboard renders correctly at 375px width
? Editor is usable on mobile viewport
? Public paper page is readable on mobile
? All buttons meet 44px touch target minimum
```

---

## 5. Security Tests

### 5.1 API Security

| Test | What to check |
|------|---------------|
| Missing auth header returns 401 | Auth required |
| Expired JWT returns 401 | Token expiry |
| One user cannot access another's data | Data isolation |
| Draft papers not accessible via public URL | Access control |
| Deleted paper returns 404, not 403 | Resource cleanup |
| API keys scoped to one project | Key scoping |
| Inactive API key returns 403 | Key deactivation |
| API key that exceeded monthly limit returns 429 | Usage limits |
| XSS in paper body → sanitized on render | XSS prevention |
| SQL injection (Firestore injection) in queries | Injection prevention |

### 5.2 CORS & Headers

| Test | What to check |
|------|---------------|
| Only allowed origins can make cross-origin requests | CORS allowed |
| `x-api-key` header is in CORS `allow_headers` | Checked via preflight |
| Security headers present: HSTS, X-Content-Type-Options, etc. | Headers |
| API responses include `X-Content-Type-Options: nosniff` | MIME sniffing |

### 5.3 Rate Limiting (after implementation)

| Test | What to check |
|------|---------------|
| 100 rapid requests to `/public/*` → 429 after threshold | Rate limiting |
| MCP tool calls from same token → limited | MCP limits |
| Dev API with same key → limited | Dev API limits |

### 5.4 Auth & Token Security

| Test | What to check |
|------|---------------|
| API key exposed in client bundle? (grep `wp_`) | Key exposure |
| Firestore security rules deny direct public access | Firestore rules |
| Clerk webhook secret cannot be guessed | Webhook signature |
| OAuth state parameter is cryptographically random | PKCE state |

---

## 6. Performance & Load Tests

### 6.1 Lighthouse / PageSpeed

Run against these production URLs:

| Page | Target (mobile) |
|------|----------------|
| Homepage | Performance ≥ 80, Accessibility ≥ 90, SEO ≥ 90 |
| Public paper page | Performance ≥ 70 (markdown rendering overhead) |
| Dashboard | Performance ≥ 70 (auth overhead) |

### 6.2 Load Testing (k6 or locust)

| Test | Scenario | Target |
|------|----------|--------|
| Public endpoints | 100 concurrent users hitting `/public/*` | p95 < 500ms |
| Dev API | 50 concurrent requests to `/dev/project` | p95 < 1s |
| Paper creation | 20 concurrent users creating papers | p95 < 2s |
| MCP reads | 30 concurrent MCP read tool calls | p95 < 1s |

### 6.3 Firestore Read/Write Budget

| Test | What to check |
|------|---------------|
| Single paper page load counts reads | Read count |
| Dashboard load counts reads across collections | Dashboard reads |
| Public page with 100 papers reads efficiently | List reads |

---

## 7. Accessibility Tests

### 7.1 Automated (axe-core via Playwright)

```
? All public pages pass axe-core scan
? Dashboard passes axe-core scan
? Editor passes axe-core scan (focus management)
? All interactive elements have accessible names
```

### 7.2 Manual Checks

- Navigate entire app using **keyboard only** (Tab, Enter, Escape)
- Screen reader test with **NVDA** or **VoiceOver**
- **Color contrast** on all text (WCAG AA: 4.5:1 normal, 3:1 large)
- **Focus indicators** visible on all interactive elements

---

## 8. Visual Regression Tests

Using Playwright's screenshot comparison:

| Page | Screenshot to capture |
|------|----------------------|
| Homepage | Full page (light + dark mode) |
| Public paper | Paper content rendering |
| Dashboard | Project list, empty states |
| Editor | Toolbar, empty paper, populated paper |
| Pricing page | Full page |
| API Showcase | Code snippet, response panel |
| Mobile | Dashboard, public page (375px) |

---

## 9. Distribution Integration Tests

### 9.1 Hashnode

| Test | What to check |
|------|---------------|
| Store Hashnode PAT → appears in settings | Token storage |
| Publish paper to Hashnode → article created | Publish |
| Update paper → republish → Hashnode article updated | Update |
| Markdown conversion (Whitepapper → Hashnode) | Format fidelity |

### 9.2 Dev.to

| Test | What to check |
|------|---------------|
| Store Dev.to API key | Token storage |
| Publish paper to Dev.to → article created | Publish |
| Tags and canonical URL sent correctly | Metadata |

---

## 10. MCP-Specific Tests

### 10.1 OAuth Flow

```
? Client registration → receives client_id
? Authorization request with PKCE → stores state
? Token exchange → returns Bearer token
? Expired token → returns 401
? Revoked token → returns 401
```

### 10.2 Read Tools

```
? get_workspace_overview returns paginated summaries
? list_projects returns user projects
? list_papers with collectionId filter works
? get_paper_by_id returns full body when includeBody=true
? search_papers returns ranked results
? resolve_slug_to_id correctly resolves slugs
? All tools return correct error for bad inputs
```

### 10.3 Write Tools

```
? create_project → project exists in Firestore
? create_collection → collection appears under project
? create_paper → paper appears in collection
? update_paper → fields updated correctly
? delete_paper → paper removed
? upsert_paper_by_slug → creates new or updates existing
? Input validation rejects invalid data
```

---

## 11. Data Integrity & Migration Tests

| Test | What to check |
|------|---------------|
| Paper body backup (Firestore) stores full content | Data durability |
| Deleting project removes ALL child collections + papers | Cascade integrity |
| Deleting user removes ALL owned content | Cascade integrity |
| Image cleanup on paper delete (Firebase Storage) | Storage cleanup |
| Image cleanup on project delete | Storage cleanup |
| Slug uniqueness across all documents | Slug integrity |
| Orphaned images (no parent paper) → cleanup job | Data hygiene |
| API key hash → key mapping is one-way (no plaintext recovery) | Security |

---

## 12. Cron Job Tests

### 12.1 Monthly Usage Reset

```python
# POST /reset-api-usage
def test_reset_resets_all_keys():
    # Given keys with usage=50
    # When reset endpoint called with CRON_SECRET
    # Then all apiKeys have usage=0
```

### 12.2 Redis → Firestore Cache Sync

```python
# POST /sync-api-keys-cache
def test_sync_persists_usage_from_redis():
    # Given usage data in Redis but not synced to Firestore
    # When sync endpoint called
    # Then Firestore documents have updated usage
```

---

## 13. Test Data Strategy

### Fixture Factory

Create a test data factory module for both frontend and backend:

**Backend** (`tests/factories.py`):

```python
def make_user(overrides=None):
    data = {
        "userId": str(uuid4()),
        "handle": "testuser",
        "email": "test@example.com",
        "createdAt": datetime.utcnow(),
    }
    if overrides:
        data.update(overrides)
    return data

def make_project(overrides=None):
    data = {
        "projectId": str(uuid4()),
        "name": "Test Project",
        "slug": "test-project",
        "ownerId": str(uuid4()),
        "isPublic": True,
    }
    if overrides:
        data.update(overrides)
    return data

def make_paper(overrides=None):
    data = {
        "paperId": str(uuid4()),
        "title": "Test Paper",
        "slug": "test-paper",
        "body": "# Hello\nWorld",
        "status": "published",
        "projectId": str(uuid4()),
        "ownerId": str(uuid4()),
    }
    if overrides:
        data.update(overrides)
    return data

def make_api_key(overrides=None):
    data = {
        "keyHash": hashlib.sha256(b"wp_test_key").hexdigest(),
        "projectId": str(uuid4()),
        "ownerId": str(uuid4()),
        "isActive": True,
        "usage": 0,
        "limitPerMonth": 10000,
    }
    if overrides:
        data.update(overrides)
    return data
```

**Frontend** (`src/test/factories.ts`):

```ts
export function makeProject(overrides?: Partial<ProjectDoc>): ProjectDoc {
  return {
    projectId: crypto.randomUUID(),
    name: "Test Project",
    slug: "test-project",
    ownerId: crypto.randomUUID(),
    isPublic: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makePaper(overrides?: Partial<PaperDoc>): PaperDoc {
  return {
    paperId: crypto.randomUUID(),
    title: "Test Paper",
    slug: "test-paper",
    body: "# Hello\nWorld",
    status: "published",
    projectId: crypto.randomUUID(),
    ownerId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}
```

---

## 14. Mocking Strategy

### 14.1 Backend Mocks

| External Service | Mock Strategy | Library |
|-----------------|---------------|---------|
| Firestore | `unittest.mock.patch` on `FirestoreStore` methods | unittest.mock |
| Redis | `unittest.mock.patch` on `redis_client` | fake-redis / mock |
| Clerk JWT | Mock `clerk-backend-api` verify_token | unittest.mock |
| Firebase Storage | Mock `storage_service` upload/delete | unittest.mock |
| Groq AI | Mock `groq` client responses | unittest.mock |
| Hashnode GraphQL | Mock httpx POST responses | respx / mock |
| Dev.to REST | Mock httpx responses | respx / mock |
| External distributions | Mock the distribution service | unittest.mock |

### 14.2 Frontend Mocks

| External Service | Mock Strategy | Library |
|-----------------|---------------|---------|
| Clerk | Mock `useAuth()`, `useUser()` | vitest.mock |
| API calls | Mock all `@/lib/api/*` modules | vitest.mock |
| fetch (dev.ts) | Mock global fetch | vitest.mock / msw |
| Window/scroll | Mock window APIs | jsdom config |

---

## 15. CI/CD Integration

### GitHub Actions Workflow

**File**: `.github/workflows/test.yml`

```yaml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: "pip"
      - run: cd fastapi && pip install -r requirements.txt
      - run: cd fastapi && pip install pytest pytest-asyncio pytest-cov httpx
      - run: cd fastapi && python -m pytest tests/ --cov=app --cov-report=term

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: astro/package-lock.json
      - run: cd astro && npm ci
      - run: cd astro && npm test

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/ruff-action@v1
        with:
          src: fastapi/app/
      - run: cd astro && npm run check  # Astro type-check

  e2e-tests:
    runs-on: ubuntu-latest
    needs: [backend-tests, frontend-tests]
    services:
      redis: # if needed
        image: redis
    steps:
      - uses: actions/checkout@v4
      - run: cd astro && npm ci
      - run: cd astro && npx playwright install
      - run: cd fastapi && pip install -r requirements.txt
      - run: |
          # Start backend + frontend, run E2E
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-screenshots
          path: astro/test-results/
```

---

## 16. Pre-Release Checklist

### 16.1 Test Execution Order

```
1. lint + type-check (fast, catch syntax/type errors)
2. backend unit tests (fast, no deps)
3. frontend unit tests (fast, no deps)
4. backend integration tests (needs emulator)
5. frontend component tests (jsdom)
6. E2E tests (slowest, needs full stack)
7. security audit (manual + automated)
8. Lighthouse audit
```

### 16.2 Gate Criteria

| Gate | Must pass |
|------|-----------|
| Lint | 0 errors, 0 warnings |
| Unit tests | 100% pass, ≥ 70% coverage (backend), ≥ 50% coverage (frontend) |
| Integration | All critical paths pass |
| E2E | All critical user journeys pass |
| Security | `wp_` API keys NOT found in frontend bundle (grep `wp_[a-f0-9]` in dist/) |
| Performance | Lighthouse ≥ 70 on all core pages |
| Accessibility | axe-core scan = 0 critical issues |
| Build | `astro build` succeeds, `npm run check` passes |

### 16.3 Manual Smoke Tests

- [ ] Create account → verify email
- [ ] Create project → add collection → write paper → publish
- [ ] Public paper page loads with correct title, body, metadata
- [ ] Generate API key → test via curl (both id and slug lookups)
- [ ] Revoke API key → curl returns 403
- [ ] Edit paper → re-publish → changes reflect
- [ ] Delete paper → 404 on public URL
- [ ] Create 100 papers → dashboard loads within 2s
- [ ] Search works across papers
- [ ] All sitemaps generate valid XML
- [ ] robots.txt returns correct crawl rules
- [ ] `/health` returns 200

---

## 17. Coverage Targets

| Area | Minimum coverage | Stretch target |
|------|-----------------|----------------|
| Backend services | 80% | 90%+ |
| Backend API endpoints | 70% | 85%+ |
| Backend MCP tools | 60% | 80%+ |
| Frontend utilities | 80% | 95%+ |
| Frontend API client | 80% | 95%+ |
| Frontend components | 50% | 70%+ |
| E2E critical flows | 100% of defined flows | All flows |
| Security tests | All defined | Full OWASP Top 10 |

---

## 18. Test Directory Structure

```
whitepapper/
  astro/
    src/
      test/
        setup.ts                  # jsdom setup, global mocks
        factories.ts              # test data factories
        mocks.ts                  # shared mocks (clerk, fetch)
      lib/
        api/
          client.test.ts
          dev.test.ts
          papers.test.ts
          projects.test.ts
        utils.test.ts
      components/
        apiShowcase.test.tsx
        project/
          ProjectWorkspace.test.tsx
        collection/
          CollectionWorkspace.test.tsx
        dashboard/
          DashboardApp.test.tsx
        write/
          WriteEditor.test.tsx
      pages/
        index.test.ts
        dashboard.test.ts
    e2e/
      auth.spec.ts
      paper.spec.ts
      project.spec.ts
      api-showcase.spec.ts
      settings.spec.ts
      mobile.spec.ts
      mcp.spec.ts
    playwright.config.ts

  fastapi/
    tests/
      conftest.py                   # fixtures, mocks, env overrides
      factories.py                  # test data builders
      test_services/
        test_dev_api_service.py
        test_papers_service.py
        test_collections_service.py
        test_projects_service.py
        test_user_service.py
        test_auth_service.py
        test_groq_service.py
        test_paper_metadata_service.py
        test_distributions.py
      test_endpoints/
        test_dev.py
        test_papers.py
        test_collections.py
        test_projects.py
        test_public.py
        test_users.py
        test_webhooks.py
        test_health.py
        test_mcp_auth.py
      test_mcp/
        test_read_tools.py
        test_write_tools.py
      test_integration/
        test_full_crud.py
        test_dev_api_flow.py
        test_mcp_flow.py
      test_cron/
        test_reset_usage.py
        test_sync_cache.py
    pytest.ini
    .coveragerc
```
