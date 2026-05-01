# Pre-Launch Code Audit Report

This document outlines critical issues that need attention before releasing to production.

---

## 1. Over-Fetching & API Optimization Issues

### 1.1 Unnecessary Full Data Fetch for Simple Checks

**Location:** `astro/src/pages/[handle]/p/[projectSlug]/index.astro:66-76`

```javascript
const currentUser = await getCurrentUser(serverClient).catch(() => null);
currentUserId = currentUser?.userId ?? null;
```

**Issue:** Fetches entire user object when only user ID is needed. The `data.user` from `getPublicProjectBySlug` already contains user information.

**Recommendation:** Use `data.user.userId` directly instead of making a second API call.

---

### 1.2 Fetching All Papers Just to Count

**Locations:**
- `astro/src/components/dashboard/DashboardApp.tsx:112`
- `astro/src/components/collection/CollectionWorkspace.tsx:98`

```javascript
const ownedPapers = await listOwnedPapers();
if (ownedPapers.length >= MAX_PAPERS_PER_USER) { ... }
```

**Issue:** Fetches all paper documents (including full body content) just to check count against a limit.

**Recommendation:** Create a dedicated endpoint `/papers/count` that returns only the count.

---

### 1.3 Missing Pagination

**Location:** All list endpoints in `astro/src/lib/api/`

**Issue:** `listOwnedPapers()`, `listStandalonePapers()`, `listProjectPapers()` return all results without pagination. This will cause performance issues as users create more papers.

**Recommendation:** Implement pagination with `limit` and `cursor` parameters.

---

### 1.4 Duplicate API Calls in Project Page

**Location:** `astro/src/pages/[handle]/p/[projectSlug]/index.astro:33-42`

**Issue:** The endpoint fetches user, project, collections, and papers in one call - but for public profile pages, only user + projects + papers are needed. Collections may not be needed if empty.

**Recommendation:** Add query params to control which data is returned.

---

## 2. Performance Issues

### 2.1 Full Page Reload on Navigation

**Locations:**
- `astro/src/components/dashboard/DashboardApp.tsx:126` - `window.location.href = /write/${paper.paperId}`
- `astro/src/components/dashboard/DashboardApp.tsx:158` - `window.location.href = /dashboard/${project.projectId}`
- `astro/src/components/collection/CollectionWorkspace.tsx:114` - `window.location.href = /write/${paper.paperId}`
- `astro/src/components/write/WriteEditor.tsx:732` - `window.location.href = /dashboard`

**Issue:** Uses `window.location.href` causing full page reload instead of client-side navigation. Loses React state, causes slower transitions.

**Recommendation:** Use Astro's `<a href>` or React Router navigation.

---

### 2.2 Unnecessary useEffect Sync on Every Render

**Location:** `astro/src/components/dashboard/DashboardApp.tsx:93-96`

```javascript
useEffect(() => {
  setProjects(initialProjects);
  setPages(sortPapersLatestFirst(initialPages));
}, [initialProjects, initialPages]);
```

**Issue:** This effect runs on every render since `initialProjects` and `initialPages` are new array references each time. Causes unnecessary re-renders.

**Recommendation:** Use proper equality check or move to initialization only.

---

### 2.3 Synchronous Sorting on Large Datasets

**Location:** `astro/src/components/dashboard/DashboardApp.tsx:77`

```javascript
const [pages, setPages] = useState<PaperDoc[]>(() => sortPapersLatestFirst(initialPages));
```

**Issue:** Sorting runs synchronously on main thread. With many papers, this blocks UI.

**Recommendation:** Move sorting to server/API level.

---

### 2.4 Large Component Bundle - WriteEditor

**Location:** `astro/src/components/write/WriteEditor.tsx` (~1400 lines)

**Issue:** Single massive component with 30+ useState hooks, multiple complex dialogs, inline handlers. Causes large JS bundle.

**Recommendation:** Split into smaller components:
- `EditorToolbar.tsx`
- `SettingsSheet.tsx`
- `MetadataDialog.tsx`
- `ThumbnailUploader.tsx`
- `StatusPopover.tsx`

---

### 2.5 No Request Deduplication

**Issue:** Multiple components can trigger same API call simultaneously (e.g., `listOwnedPapers` in both Dashboard and Collection).

**Recommendation:** Implement request caching/deduplication (e.g., React Query, TanStack Query).

---

## 3. SEO & Crawlability Issues

### 3.1 Sitemap Validates URLs with Extra Fetch (Performance)

**Location:** `astro/src/pages/sitemaps/public-papers.xml.ts:50-57`

```javascript
const validationResponse = await fetch(loc, { method: "GET" });
if (!validationResponse.ok) {
  return "";
}
```

**Issue:** For each paper in sitemap, makes an extra HTTP request to validate. This is:
- Slow for large sitemaps
- Consumes server resources
- May trigger rate limiting

**Issue 2:** No paging - fetches ALL papers in one call.

**Recommendation:** Remove validation fetch; trust the API data is valid. Add pagination.

---

### 3.2 Missing Canonical URLs on Some Pages

**Issue:** Not all pages explicitly set canonical URLs in meta tags.

**Current:** Only some dynamic pages (papers, projects) have canonical handling.

**Recommendation:** Add canonical tag to ALL pages including:
- Landing page (`/`)
- Pricing (`/pricing`)
- Features (`/features`)
- Use cases (`/use-cases`)
- Docs (`/docs`)

---

### 3.3 Hardcoded Production Domain

**Location:** `astro/src/layouts/Layout.astro:47`

```javascript
const PRODUCTION_DOMAIN = "whitepapper.antk.in";
```

**Issue:** This should be environment-based, not hardcoded. Will cause issues if domain changes.

**Recommendation:** Use `import.meta.env.PUBLIC_SITE_URL` or similar.

---

### 3.4 Missing Structured Data (JSON-LD)

**Current State:** Only some dynamic pages have structured data.

**Missing on:**
- Pricing page
- Features page
- Use cases page
- About page

**Recommendation:** Add JSON-LD for:
- Organization (on all pages)
- Product (pricing page)
- Article (blog posts if any)

---

### 3.5 No Open Graph Images for Dynamic Content

**Issue:** User-generated papers/projects may not have OG images set, falling back to default.

**Recommendation:** Ensure OG image defaults to paper thumbnail or project logo when available.

---

### 3.6 Missing Meta Description on Some Pages

**Issue:** Some pages may have empty meta descriptions.

**Recommendation:** Audit all pages and ensure each has:
- `<meta name="description">`
- `<meta property="og:description">`

---

## 4. Bad Code Practices

### 4.1 Dead Code / Unused Components

**Locations:**
- `astro/src/components/unused/tweetCards.tsx` - 116 lines, never imported
- `astro/src/components/unused/ssoCardStack.tsx` - never imported

**Issue:** Clutters codebase, increases build time slightly.

**Recommendation:** Delete these files.

---

### 4.2 Pointless Wrapper Functions

**Location:** `astro/src/lib/api/contentFetcher.ts:1-9`

```typescript
export async function fetchCollectionBySlug(slug: string, apiKey: string) {
  return getDevCollection(apiKey, "slug", slug);
}
```

**Issue:** Adds no value, just wraps another function with different parameter order.

**Recommendation:** Direct import of `getDevCollection` or remove entirely.

---

### 4.3 Magic Strings and Hardcoded Values

**Locations:**
- `DashboardApp.tsx:54` - `optimistic-project-${nonce}`
- `WriteEditor.tsx:82` - `INIT_PAPER_SLUG_PREFIX = "init-paper-"`
- `WriteEditor.tsx:83` - `EMPATHETIC_SLUG_SUFFIXES = ["new", "updated", "fresh", "kind"]`

**Recommendation:** Move to constants file or environment config.

---

### 4.4 Unsafe Type Casting

**Locations:**
- `WriteEditor.tsx:647` - `(next as any)[key] = ...`
- `WriteEditor.tsx:656` - `(next as any)[key] = value`

**Issue:** Uses `any` type, defeats TypeScript safety.

**Recommendation:** Use proper type guards or generic constraints.

---

### 4.5 Duplicate Code Patterns

**Similar patterns repeated:**
- `listStandalonePapers` and `listOwnedPapers` - identical except for query param
- `getProjectBySlug` and `getProjectById` - could be single endpoint with optional param
- Both DashboardApp and CollectionWorkspace have identical `handleCreatePage` logic

**Recommendation:** Consolidate into shared utilities.

---

### 4.6 Empty Catch Blocks

**Location:** `WriteEditor.tsx:127-129`

```javascript
} catch {
  // toast.promise handles failure UI.
}
```

**Issue:** Silent failures make debugging difficult.

**Recommendation:** Log errors at minimum, or handle gracefully.

---

### 4.7 Inconsistent Error Handling

**Issue:** Some places use `toast.promise()`, others manual try/catch with different messages.

**Recommendation:** Standardize error handling across all components.

---

### 4.8 Unused Imports

**Location:** Multiple files have unused imports that increase bundle size.

**Recommendation:** Run ESLint with `no-unused-vars` rule.

---

## 5. Security Concerns

### 5.1 API Key Exposure Risk

**Location:** `astro/src/lib/api/dev.ts:30`

```javascript
const DEV_API_BASE_URL = `${import.meta.env.PUBLIC_API_BASE_URL}/dev`;
```

**Issue:** If API key is sent in headers on client-side, could be exposed.

**Recommendation:** Ensure dev endpoints are server-side only, never exposed to client.

---

### 5.2 No Rate Limiting on Client

**Issue:** Client can spam API calls (create paper, save, etc.) with no debounce/throttle.

**Recommendation:** Add client-side debounce on save buttons, rate limiting indicator.

---

## 6. Maintainability Issues

### 6.1 Monolithic Components

**Worst Offenders:**
- `WriteEditor.tsx` - 1400+ lines
- `DashboardApp.tsx` - 516 lines

**Issue:** Hard to test, debug, and maintain.

**Recommendation:** Break into smaller, focused components.

---

### 6.2 No Consistent State Management

**Issue:** Each component manages its own state with useState. No global store (Zustand, Redux, etc.).

**Recommendation:** Consider adding global state for:
- Current user data
- Theme preference
- Toast queue

---

### 6.3 Mixed Responsibility in Components

**Example:** WriteEditor handles:
- Text editing
- Image uploads
- Metadata generation
- Distribution
- Preferences (keyboard sounds)
- Settings dialogs

**Recommendation:** Single Responsibility Principle - each component should do one thing.

---

### 6.4 No Code Splitting / Lazy Loading

**Issue:** All components load immediately, even ones in dialogs/sheets not visible.

**Recommendation:** Use React.lazy() for:
- MetadataDialog
- DistributionDialog
- Settings Sheet content

---

## 7. Accessibility Issues

### 7.1 Missing ARIA Labels

**Location:** Several components

**Issue:** Icons and buttons lack proper ARIA labels.

**Recommendation:** Add `aria-label` to all icon buttons.

---

### 7.2 Keyboard Navigation

**Issue:** Not all interactive elements are keyboard accessible.

**Recommendation:** Test with keyboard only, add focus states.

---

### 7.3 Color Contrast

**Issue:** Some muted foreground colors may not meet WCAG AA.

**Recommendation:** Audit with axe-core or similar.

---

## 8. Mobile/Responsive Concerns

### 8.1 Touch Targets Too Small

**Issue:** Some buttons may be under 44x44px on mobile.

**Recommendation:** Ensure all interactive elements meet minimum touch target size.

---

## 9. Bundle Size Concerns

### 9.1 Unused UI Components

**Location:** `astro/src/components/ui/`

**Issue:** Many UI components may not be used but are still in bundle.

**Recommendation:** Run bundle analyzer and remove unused imports.

---

### 9.2 Large Dependencies

**Check:** `package.json` for unnecessary packages.

**Recommendation:** Audit dependencies - remove unused ones, tree-shake where possible.

---

## 10. Testing Gaps

### 10.1 No Unit Tests

**Issue:** No unit tests for utility functions or components.

**Recommendation:** Add Vitest/Jest for:
- Utility functions (slug normalization, date formatting)
- API client
- Component logic

---

### 10.2 No E2E Tests

**Recommendation:** Add Playwright/Cypress for critical flows:
- User registration/login
- Paper creation and publishing
- Project creation

---

## Priority Matrix

| Priority | Issue | Effort |
|----------|-------|--------|
| HIGH | Add pagination to list APIs | Medium |
| HIGH | Fix full page reloads | Low |
| HIGH | Remove sitemap URL validation fetch | Low |
| HIGH | Delete unused components | Low |
| MEDIUM | Split WriteEditor into smaller components | High |
| MEDIUM | Add proper error handling | Medium |
| MEDIUM | Add canonical URLs to all pages | Low |
| MEDIUM | Implement pagination for sitemaps | Medium |
| LOW | Add JSON-LD structured data | Medium |
| LOW | Fix hardcoded production domain | Low |
| LOW | Remove magic strings to constants | Low |

---

## Quick Wins (Under 1 Hour)

1. Delete `astro/src/components/unused/` folder
2. Remove `contentFetcher.ts` wrapper or inline it
3. Fix `window.location.href` to use `<a>` tags or client router
4. Remove sitemap URL validation fetch
5. Fix hardcoded domain in Layout
6. Add proper error logging in catch blocks
7. Remove unused imports (run ESLint)

---

## Summary

This codebase has solid fundamentals but needs cleanup before production. The main areas to focus on:

1. **API Optimization** - Add pagination, reduce over-fetching
2. **Performance** - Fix navigation, code splitting, lazy loading
3. **SEO** - Add canonicals, structured data, fix sitemap
4. **Code Quality** - Delete dead code, split large components
5. **Security** - Ensure API keys aren't exposed

The issues are mostly incremental fixes rather than fundamental architecture problems.