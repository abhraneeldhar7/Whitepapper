export type DocsPageEntry = {
  title: string;
  route: string;
  location: string;
  order: number;
  description: string;
  sectionTitle: string;
  children?: DocsPageEntry[];
};

export type DocsNavSection = {
  title: string;
  order: number;
  pages: DocsPageEntry[];
};

export type DocsPageNeighbors = {
  previous: DocsPageEntry | null;
  next: DocsPageEntry | null;
};

type DocsPageSeed = {
  title: string;
  route: string;
  location: string;
  order: number;
  description: string;
  children?: DocsPageSeed[];
};

function enrichPage(page: DocsPageSeed, sectionTitle: string): DocsPageEntry {
  return {
    ...page,
    sectionTitle,
    children: page.children?.map((child) => enrichPage(child, sectionTitle)),
  };
}

const rawDocsNavSections: Array<{ title: string; order: number; pages: DocsPageSeed[] }> = [
  {
    title: "Getting Started",
    order: 1,
    pages: [
      {
        title: "Introduction",
        route: "/docs/intro",
        location: "docs_intro.md",
        order: 1,
        description: "What Whitepapper is, who it is for, and what problems it solves.",
      },
      {
        title: "Quickstart",
        route: "/docs/quickstart",
        location: "docs_quickstart.md",
        order: 2,
        description: "First 15-minute path from account setup to first Dev API request.",
      },
    ],
  },
  {
    title: "Core Concepts",
    order: 2,
    pages: [
      {
        title: "Projects",
        route: "/docs/projects",
        location: "core/docs_projects.md",
        order: 1,
        description: "Project model, visibility, slug behavior, and API tab usage.",
      },
      {
        title: "Collections",
        route: "/docs/collections",
        location: "core/docs_collections.md",
        order: 2,
        description: "Collection model, project relationship, visibility, and publishing impact.",
      },
      {
        title: "Papers",
        route: "/docs/papers",
        location: "core/docs_papers.md",
        order: 3,
        description: "Paper lifecycle, metadata, thumbnails, and public URL behavior.",
      },
      {
        title: "Slug Collision Checks",
        route: "/docs/slug-collision-checks",
        location: "core/docs_slug_collision.md",
        order: 4,
        description: "Slug normalization, uniqueness rules, and availability checks.",
      },
    ],
  },
  {
    title: "Editor",
    order: 3,
    pages: [
      {
        title: "Editor Overview",
        route: "/docs/editor/overview",
        location: "editor/docs_editor_overview.md",
        order: 1,
        description: "Editor layout, save behavior, and where metadata and distribution actions live.",
      },
      {
        title: "Media Uploads",
        route: "/docs/editor/media-uploads",
        location: "editor/docs_editor_media.md",
        order: 2,
        description: "Thumbnail, embedded image, and metadata image workflows and limits.",
      },
      {
        title: "Metadata Workflow",
        route: "/docs/editor/metadata-workflow",
        location: "editor/docs_editor_metadata.md",
        order: 3,
        description: "Metadata generation, editing, and publish-time behavior.",
      },
    ],
  },
  {
    title: "SEO",
    order: 4,
    pages: [
      {
        title: "SEO Overview",
        route: "/docs/seo/overview",
        location: "seo/docs_seo_overview.md",
        order: 1,
        description: "SEO model in Whitepapper, canonical strategy, and metadata ownership.",
      },
      {
        title: "Paper Metadata",
        route: "/docs/seo/paper-metadata",
        location: "seo/docs_seo_paper_metadata.md",
        order: 2,
        description: "Field-by-field paper metadata mapping to search and social output.",
      },
      {
        title: "Public Pages",
        route: "/docs/seo/public-pages",
        location: "seo/docs_seo_public_pages.md",
        order: 3,
        description: "SEO behavior for profile, project, and public paper pages.",
      },
      {
        title: "Sitemaps",
        route: "/docs/seo/sitemaps",
        location: "seo/docs_seo_sitemaps.md",
        order: 4,
        description: "Available sitemap endpoints and their included URLs.",
      },
    ],
  },
  {
    title: "Dev API",
    order: 5,
    pages: [
      {
        title: "Dev API Overview",
        route: "/docs/dev-api/overview",
        location: "devApi/docs_devapi_overview.md",
        order: 1,
        description: "Dev API purpose, project scoping, and safe frontend usage.",
      },
      {
        title: "Authentication",
        route: "/docs/dev-api/authentication",
        location: "devApi/docs_devapi_auth.md",
        order: 2,
        description: "x-api-key header contract, key status checks, and auth errors.",
      },
      {
        title: "API Key Management",
        route: "/docs/dev-api/api-key-management",
        location: "devApi/docs_devapi_key_mgmt.md",
        order: 3,
        description: "Create, view, enable, disable, reset, and usage tracking flow.",
      },
      {
        title: "Dev API Contracts",
        route: "/docs/dev-api/contracts",
        location: "devApi/docs_devapi_contracts.md",
        order: 4,
        description: "Request and response contracts for all Dev API endpoints.",
        children: [
          {
            title: "Project Endpoint",
            route: "/docs/dev-api/contracts/project-endpoint",
            location: "devApi/docs_devapi_contracts_project.md",
            order: 1,
            description: "Contract for GET /dev/project.",
          },
          {
            title: "Collection Endpoint",
            route: "/docs/dev-api/contracts/collection-endpoint",
            location: "devApi/docs_devapi_contracts_collection.md",
            order: 2,
            description: "Contract for GET /dev/collection.",
          },
          {
            title: "Paper Endpoint",
            route: "/docs/dev-api/contracts/paper-endpoint",
            location: "devApi/docs_devapi_contracts_paper.md",
            order: 3,
            description: "Contract for GET /dev/paper.",
          },
        ],
      },
      {
        title: "Caching and Errors",
        route: "/docs/dev-api/caching-and-errors",
        location: "devApi/docs_devapi_caching.md",
        order: 5,
        description: "Cache behavior, usage increments, and troubleshooting by status code.",
      },
    ],
  },
  {
    title: "Distribution",
    order: 6,
    pages: [
      {
        title: "Distribution Overview",
        route: "/docs/distribution/overview",
        location: "distribution/docs_distribution_overview.md",
        order: 1,
        description: "Distribution model, token options, and editor publishing flow.",
      },
      {
        title: "Hashnode",
        route: "/docs/distribution/hashnode",
        location: "distribution/docs_distribution_hashnode.md",
        order: 2,
        description: "Hashnode setup and publish workflow.",
      },
      {
        title: "Dev.to",
        route: "/docs/distribution/devto",
        location: "distribution/docs_distribution_devto.md",
        order: 3,
        description: "Dev.to API key setup and publish workflow.",
      },
      {
        title: "Medium Import",
        route: "/docs/distribution/medium-import",
        location: "distribution/docs_distribution_medium.md",
        order: 4,
        description: "Medium import flow using a Whitepapper public URL.",
      },
      {
        title: "Platform Status",
        route: "/docs/distribution/platform-status",
        location: "distribution/docs_distribution_platform_status.md",
        order: 5,
        description: "Current live channels and pending distribution channels.",
      },
    ],
  },
  {
    title: "Self Host",
    order: 7,
    pages: [
      {
        title: "Self Host Overview",
        route: "/docs/self-host/overview",
        location: "selfHost/docs_selfhost_overview.md",
        order: 1,
        description: "Monorepo architecture and deployment targets for self-hosting.",
      },
      {
        title: "Environment Files",
        route: "/docs/self-host/environment-files",
        location: "selfHost/docs_selfhost_environment_files.md",
        order: 2,
        description: "How Astro and FastAPI env files map to production values.",
        children: [
          {
            title: "Astro Env",
            route: "/docs/self-host/environment-files/astro-env",
            location: "selfHost/docs_selfhost_environment_files_astro_env.md",
            order: 1,
            description: "Required Astro environment variables and deployment values.",
          },
          {
            title: "FastAPI Env",
            route: "/docs/self-host/environment-files/fastapi-env",
            location: "selfHost/docs_selfhost_environment_files_fastapi_env.md",
            order: 2,
            description: "Required FastAPI environment variables and deployment values.",
          },
        ],
      },
      {
        title: "Local Run",
        route: "/docs/self-host/local-run",
        location: "selfHost/docs_selfhost_local_run.md",
        order: 3,
        description: "Run Astro, FastAPI, and supporting services locally.",
      },
      {
        title: "Vercel Frontend",
        route: "/docs/self-host/vercel-frontend",
        location: "selfHost/docs_selfhost_vercel_frontend.md",
        order: 4,
        description: "Deploy Astro frontend from the correct monorepo folder.",
      },
      {
        title: "Cloud Run Backend",
        route: "/docs/self-host/cloud-run-backend",
        location: "selfHost/docs_selfhost_cloud_run_backend.md",
        order: 5,
        description: "Deploy FastAPI backend to Google Cloud Run.",
      },
      {
        title: "Cloudflare Worker",
        route: "/docs/self-host/cloudflare-worker",
        location: "selfHost/docs_selfhost_cloudflare_worker.md",
        order: 6,
        description: "Deploy and configure the Cloudflare proxy worker.",
      },
      {
        title: "Cron Jobs",
        route: "/docs/self-host/cron-jobs",
        location: "selfHost/docs_selfhost_cron_jobs.md",
        order: 7,
        description: "Configure scheduled monthly and hourly API key jobs.",
      },
      {
        title: "Production Checklist",
        route: "/docs/self-host/production-checklist",
        location: "selfHost/docs_selfhost_production_checklist.md",
        order: 8,
        description: "Final end-to-end verification checklist for production.",
      },
    ],
  },
];

export const docsNavSections: DocsNavSection[] = rawDocsNavSections.map((section) => ({
  title: section.title,
  order: section.order,
  pages: section.pages.map((page) => enrichPage(page, section.title)),
}));

function sortByOrder<T extends { order: number }>(items: T[]): T[] {
  return items.slice().sort((a, b) => a.order - b.order);
}

function flattenPages(pages: DocsPageEntry[]): DocsPageEntry[] {
  return sortByOrder(pages).flatMap((page) => [
    page,
    ...(page.children ? flattenPages(page.children) : []),
  ]);
}

export const docsPageEntries = docsNavSections
  .slice()
  .sort((a, b) => a.order - b.order)
  .flatMap((section) => flattenPages(section.pages));

export function getDocsPageByRoute(route: string): DocsPageEntry | null {
  const normalizedRoute = route.replace(/\/+$/, "") || "/";
  return docsPageEntries.find((entry) => entry.route === normalizedRoute) ?? null;
}

export function getDocsPageNeighbors(route: string): DocsPageNeighbors {
  const normalizedRoute = route.replace(/\/+$/, "") || "/";
  const currentIndex = docsPageEntries.findIndex((entry) => entry.route === normalizedRoute);

  if (currentIndex === -1) {
    return { previous: null, next: null };
  }

  return {
    previous: currentIndex > 0 ? docsPageEntries[currentIndex - 1] : null,
    next: currentIndex < docsPageEntries.length - 1 ? docsPageEntries[currentIndex + 1] : null,
  };
}
