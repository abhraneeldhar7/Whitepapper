# llms.txt: What It Is, Why It Matters, and How to Create Yours

**Meta title:** llms.txt: What It Is, Why It Matters, and How to Create Yours  
**Meta description:** llms.txt is a plain text file that tells AI tools what your site is and which pages matter most. Here's what it is, how it works, and how to write one for your site today.  
**Slug:** `/blog/llms-txt-guide`  
**Category:** AI Search Readiness  
**Cluster role:** Supporting (links to pillar: GEO Guide)

---

You probably know what `robots.txt` is: a plain text file that lives at the root of your site and tells search crawlers which pages to access and which to skip.

`llms.txt` is the same idea, applied to AI systems. It's a plain text file that tells AI tools  ChatGPT, Perplexity, Claude, and others  what your site is, what it does, and which pages are most important for understanding it.

It takes about thirty minutes to create. It costs nothing. And as AI tools increasingly use it during live retrieval, it's one of the lowest-effort, highest-value GEO actions you can take.

---

## Why llms.txt Exists

AI tools that do real-time web retrieval face a practical problem: when they fetch a web page, they get everything  navigation menus, footers, cookie banners, sidebar widgets, and the actual content, all mixed together. Parsing out what matters from what doesn't requires extra processing, and the results aren't always accurate.

`llms.txt` is a proposed solution to this. Instead of making the AI tool parse your full site to understand what it is, you give it a clean, structured summary: here's our product, here's what it does, here are the most important pages to know about.

The format was proposed by Jeremy Howard (of fast.ai) in 2024 and has seen growing adoption among developer tools, SaaS products, and content platforms. It's not an official standard and not all AI tools read it yet  but support is growing, the cost of creating it is minimal, and it positions your site well as adoption increases.

---

## What llms.txt Contains

The file uses a simple Markdown-like format. A complete `llms.txt` has four parts:

**1. H1 heading  your product name**
**2. Blockquote  your one-sentence product description**
**3. Optional prose  a short paragraph or list of key facts**
**4. Sections with links  the most important URLs on your site, organized by category**

That's it. No special syntax, no configuration, no build step. A plain text file.

---

## A Complete Example for Whitepaper

Here's what a well-written `llms.txt` looks like for Whitepaper:

```markdown
# Whitepaper

> API-first CMS platform for developer publishing with built-in SEO enforcement, 
> structured content management, and multi-platform content distribution.

Whitepaper lets developers publish standalone papers and organized projects via a 
structured API. Content is stored in Firestore, served through a FastAPI backend, 
and rendered on an Astro frontend. Users can cross-post content to Dev.to, Hashnode, 
Reddit, Threads, Peerlist, and Substack through native integrations.

Each project has its own API key for GET requests. Papers support full Markdown 
content with thumbnails, metadata, and author attribution. Collections group related 
papers within a project.

## Product

- [Features](https://whitepaper.so/features): Full overview of platform capabilities
- [Pricing](https://whitepaper.so/pricing): Plans and pricing information
- [Changelog](https://whitepaper.so/changelog): Recent updates and releases

## Developer API

- [API Documentation](https://whitepaper.so/docs): Complete API reference
- [Get project details](https://whitepaper.so/docs/api/project): /dev/project endpoint
- [Get paper by ID or slug](https://whitepaper.so/docs/api/paper): /dev/paper endpoint
- [Get collection](https://whitepaper.so/docs/api/collection): /dev/collection endpoint

## Integrations

- [Integrations overview](https://whitepaper.so/integrations): All supported platforms
- Supported: Hashnode, Dev.to, Reddit, Threads, Peerlist, Substack

## Learn

- [Blog](https://whitepaper.so/blog): Guides on developer publishing, SEO, and content operations
- [Use cases](https://whitepaper.so/use-cases): How teams use Whitepaper

## Company

- [About](https://whitepaper.so/about): Team and mission
- [Contact](https://whitepaper.so/contact): Get in touch
```

---

## What Each Section Is Doing

**The H1 and blockquote** are the most important part. When an AI tool reads this file, the first thing it extracts is: "Whitepaper is an API-first CMS platform for developer publishing." That single sentence is what gets embedded in the AI's understanding of what your product is. Write it carefully  it's your entity definition in one line.

**The prose section** adds supporting detail that helps AI tools answer follow-up questions about your product. What tech is it built on? Who is it for? What specific features exist? This is not marketing copy  it's factual description. Write it the way you'd describe your product to a developer who's never heard of it.

**The linked sections** serve two purposes. First, they tell AI tools which pages are most valuable to read for more information. Second, they create a machine-readable index of your site's most important content. AI tools doing live retrieval can follow these links and read the full pages.

Keep link descriptions short and factual. "Full overview of platform capabilities" is better than "Discover everything Whitepaper can do for your content strategy." The goal is information, not persuasion.

---

## Where to Put It and How to Serve It

The file lives at the root of your domain: `https://whitepaper.so/llms.txt`

In an Astro project, create it as a static file in your `public/` folder:

```
astro/
  public/
    llms.txt
    robots.txt
    favicon.ico
```

Files in `public/` are served as-is at the root of your site. No routing, no build step, no API call. Just a static text file.

The content type should be `text/plain`. Astro serves `.txt` files from `public/` with the correct content type automatically.

Verify it's working by visiting `https://yoursite.com/llms.txt` in your browser. You should see plain text, not a 404 or a formatted page.

---

## The llms-full.txt Variant

Some sites also create an `llms-full.txt`  an extended version that includes more detail.

Where `llms.txt` is a concise summary (one page worth of content), `llms-full.txt` can be a longer, richer document that includes:

- Full feature descriptions
- Detailed integration documentation
- FAQ sections about the product
- Comparison information vs. alternatives
- Glossary of product-specific terms

This is useful for products with complex APIs or many distinct features, where the summary in `llms.txt` leaves important things out. AI tools that read `llms-full.txt` get a much more complete picture of what you offer.

Reference `llms-full.txt` from your `llms.txt` file:

```markdown
## Extended documentation

- [Full product documentation](https://whitepaper.so/llms-full.txt): 
  Complete machine-readable product reference
```

For most sites, `llms.txt` alone is sufficient to start. Add `llms-full.txt` when you have enough to say that the summary version can't cover it.

---

## How to Reference It From robots.txt

Just as `robots.txt` references your sitemap, you can reference your `llms.txt` from `robots.txt`. This is not a formal standard, but it signals to AI crawlers that the file exists:

```
User-agent: *
Allow: /

Sitemap: https://whitepaper.so/sitemap-index.xml
LLMs: https://whitepaper.so/llms.txt
```

Some AI crawlers look for this directive. Others discover `llms.txt` by checking the standard location (`/llms.txt`) directly. Adding the reference covers both cases.

---

## Keeping llms.txt Current

Unlike your sitemap, `llms.txt` doesn't need to update automatically. It's a curated document, not a generated one.

Update it when:
- You launch a significant new feature
- You add a new integration
- A key page URL changes
- Your product description changes meaningfully

A quarterly review is usually sufficient. Read through it, check that all links still work, and update any information that's no longer accurate.

An inaccurate `llms.txt`  one that describes features you no longer offer or links to pages that 404  is worse than no file at all. It gives AI tools incorrect information and undermines trust in your entity signals.

---

## The Realistic Expectation

`llms.txt` is not a magic switch. AI tools that don't actively crawl for it won't read it, and tools that do read it won't cite your content just because the file exists.

What it does: it gives AI tools that do look for it a clean, accurate, immediately usable understanding of what your product is. When someone asks "what is Whitepaper?" or "what CMS should I use for developer publishing?", a tool that has read your `llms.txt` has better information to work with than one that had to piece it together from your marketing pages.

Combined with the other GEO practices in this series  factual density, entity consistency, Q&A structure, structured data  `llms.txt` contributes to a coherent picture of your site that AI systems can use reliably.

Create it today. It takes thirty minutes and there's no downside.

---

*Part of our series on AI Search Readiness. Start with [the complete GEO guide](#) or explore [how to write content that AI assistants quote](#).*
