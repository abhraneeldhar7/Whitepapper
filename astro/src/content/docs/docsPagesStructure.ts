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

const docsPaperSlugByRoute: Record<string, string> = {
  "/docs/intro": "introduction",
  "/docs/quickstart": "quickstart",
  "/docs/entities": "docs-entities",
  "/docs/mcp/quickstart": "docs-mcp-quickstart",
  "/docs/mcp/tools": "docs-mcp-tools",
  "/docs/mcp/chatgpt": "docs-mcp-chatgpt",
  "/docs/mcp/codex": "docs-mcp-codex",
  "/docs/mcp/copilot": "docs-mcp-copilot",
  "/docs/mcp/opencode": "docs-mcp-opencode",
  "/docs/seo/auto-tags": "docs-seo-auto-tags",
  "/docs/seo/custom-metatags": "docs-seo-custom-metatags",
  "/docs/dev-api/quickstart": "docs-dev-api-overview",
  "/docs/dev-api/authentication": "docs-dev-api-authentication",
  "/docs/dev-api/api-key-management": "docs-dev-api-api-key-management",
  "/docs/dev-api/contracts/project-endpoint": "docs-dev-api-contracts-project-endpoint",
  "/docs/dev-api/contracts/collection-endpoint": "docs-dev-api-contracts-collection-endpoint",
  "/docs/dev-api/contracts/paper-endpoint": "docs-dev-api-contracts-paper-endpoint",
  "/docs/dev-api/caching-and-errors": "docs-dev-api-caching-and-errors",
  "/docs/dev-api/best-practices": "docs-dev-api-best-practices",
  "/docs/dev-api/troubleshooting": "docs-dev-api-troubleshooting",
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
        description: "App structure, content hierarchy, and how Whitepapper fits into your workflow.",
      },
      {
        title: "Quickstart",
        route: "/docs/quickstart",
        location: "docs_quickstart.md",
        order: 2,
        description: "Overview of Dev API, MCP, and installable components with links to dedicated guides.",
      },
      {
        title: "Entities",
        route: "/docs/entities",
        location: "docs_entities.md",
        order: 3,
        description: "TypeScript type definitions for Paper, Project, and Collection entities.",
      },
    ],
  },
  {
    title: "MCP",
    order: 2,
    pages: [
      {
        title: "Quickstart",
        route: "/docs/mcp/quickstart",
        location: "mcp/docs_mcp_quickstart.md",
        order: 1,
        description: "Locate your MCP URL in Dashboard settings, understand workspace access and monthly limits.",
      },
      {
        title: "Tools",
        route: "/docs/mcp/tools",
        location: "mcp/docs_mcp_tools.md",
        order: 2,
        description: "Complete reference of all MCP tools: purpose, input schemas, and output types.",
      },
      {
        title: "ChatGPT",
        route: "/docs/mcp/chatgpt",
        location: "mcp/docs_mcp_chatgpt.md",
        order: 3,
        description: "Connect Whitepapper MCP to ChatGPT via the Apps settings panel.",
      },
      {
        title: "Codex",
        route: "/docs/mcp/codex",
        location: "mcp/docs_mcp_codex.md",
        order: 4,
        description: "Add Whitepapper as an MCP server in OpenAI Codex CLI.",
      },
      {
        title: "Copilot",
        route: "/docs/mcp/copilot",
        location: "mcp/docs_mcp_copilot.md",
        order: 5,
        description: "Configure Whitepapper MCP in VS Code / GitHub Copilot via the MCP command palette.",
      },
      {
        title: "OpenCode",
        route: "/docs/mcp/opencode",
        location: "mcp/docs_mcp_opencode.md",
        order: 6,
        description: "Set up the Whitepapper MCP server in OpenCode CLI.",
      },
    ],
  },
  {
    title: "Dev API",
    order: 3,
    pages: [
      {
        title: "Quickstart",
        route: "/docs/dev-api/quickstart",
        location: "devApi/docs_devapi_overview.md",
        order: 1,
        description: "Create a project, populate it via MCP or the editor, generate an API key, and make your first request.",
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
        title: "Project Endpoint",
        route: "/docs/dev-api/contracts/project-endpoint",
        location: "devApi/docs_devapi_contracts_project.md",
        order: 4,
        description: "Contract for GET /dev/project — fetch project metadata and content tree.",
      },
      {
        title: "Collection Endpoint",
        route: "/docs/dev-api/contracts/collection-endpoint",
        location: "devApi/docs_devapi_contracts_collection.md",
        order: 5,
        description: "Contract for GET /dev/collection — fetch a collection and its papers.",
      },
      {
        title: "Paper Endpoint",
        route: "/docs/dev-api/contracts/paper-endpoint",
        location: "devApi/docs_devapi_contracts_paper.md",
        order: 6,
        description: "Contract for GET /dev/paper — fetch a single paper by slug or ID.",
      },
      {
        title: "Caching and Errors",
        route: "/docs/dev-api/caching-and-errors",
        location: "devApi/docs_devapi_caching.md",
        order: 7,
        description: "Cache behavior, usage increments, and troubleshooting by status code.",
      },
      {
        title: "Best Practices",
        route: "/docs/dev-api/best-practices",
        location: "devApi/docs_devapi_best_practices.md",
        order: 8,
        description: "Environment variables, edge caching, Astro/Next.js page cache integration.",
      },
    ],
  },
  {
    title: "SEO",
    order: 4,
    pages: [
      {
        title: "Auto Tags",
        route: "/docs/seo/auto-tags",
        location: "seo/docs_seo_auto_tags.md",
        order: 1,
        description: "How Whitepapper generates meta tags and JSON-LD, and the exact output structure.",
      },
      {
        title: "Custom Metatags",
        route: "/docs/seo/custom-metatags",
        location: "seo/docs_seo_custom_metatags.md",
        order: 2,
        description: "Override auto-generated tags via the editor sidebar: titles, descriptions, OG images, and more.",
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

export function getDocsPaperSlugByRoute(route: string): string | null {
  const normalizedRoute = route.replace(/\/+$/, "") || "/";
  return docsPaperSlugByRoute[normalizedRoute] ?? null;
}
