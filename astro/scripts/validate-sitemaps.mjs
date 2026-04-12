const baseUrl = String(process.env.SITEMAP_BASE_URL || process.env.PUBLIC_SITE_URL || "").trim().replace(/\/+$/, "");

if (!baseUrl) {
  console.error("Set SITEMAP_BASE_URL or PUBLIC_SITE_URL before running sitemap validation.");
  process.exit(1);
}

const disallowedUrlPatterns = [
  /\/llms\.txt$/i,
  /\/llms-full\.txt$/i,
  /\/dashboard(\/|$)/i,
  /\/settings(\/|$)/i,
  /\/write(\/|$)/i,
  /\/login(\/|$)/i,
  /\/sign-in(\/|$)/i,
  /\/sign-up(\/|$)/i,
];

function extractLocs(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.text();
}

async function validatePublicUrl(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
}

async function main() {
  const sitemapIndexUrl = `${baseUrl}/sitemap.xml`;
  const sitemapIndexXml = await fetchText(sitemapIndexUrl);
  const sitemapLocs = extractLocs(sitemapIndexXml);

  if (sitemapLocs.some((loc) => /\/sitemap-index\.xml$/i.test(loc))) {
    throw new Error("sitemap.xml still references sitemap-index.xml.");
  }

  const seen = new Set();
  const pageUrls = [];

  for (const sitemapUrl of sitemapLocs) {
    const xml = await fetchText(sitemapUrl);
    const urls = extractLocs(xml);
    for (const url of urls) {
      if (seen.has(url)) {
        throw new Error(`Duplicate URL found in sitemap set: ${url}`);
      }
      if (disallowedUrlPatterns.some((pattern) => pattern.test(url))) {
        throw new Error(`Disallowed URL found in sitemap set: ${url}`);
      }
      seen.add(url);
      pageUrls.push(url);
    }
  }

  for (const url of pageUrls) {
    await validatePublicUrl(url);
  }

  console.log(`Validated ${pageUrls.length} sitemap URLs from ${sitemapLocs.length} sitemap files.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
