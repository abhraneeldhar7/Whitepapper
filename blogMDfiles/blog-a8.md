# Content Audit for Developers: How to Find and Fix Underperforming Pages

**Meta title:** Content Audit for Developers: Find and Fix Underperforming Pages  
**Meta description:** A content audit finds the pages dragging your site down  thin content, broken links, cannibalization, and orphan pages. Here's a developer-friendly process to run one.  
**Slug:** `/blog/content-audit-developers-underperforming-pages`  
**Category:** Programmatic SEO and Content Operations  
**Cluster role:** Supporting

---

At some point, publishing more content stops being the answer. You've got 60 posts and organic traffic has plateaued. You add a new post, it gets a few clicks, and nothing else changes.

The problem is usually not what you're adding. It's what's already there. Thin pages that Google decided weren't worth indexing. Duplicate content competing with your best posts. Orphan pages sitting in your database with zero internal links pointing to them. Old posts that were once relevant but are now outdated enough to hurt your credibility.

A content audit finds all of this. It's not glamorous work, but it consistently produces better results than publishing twenty new posts on a site with sixty broken ones.

---

## What a Content Audit Is (and Isn't)

A content audit is a systematic review of every public page on your site to assess whether it's helping, hurting, or doing nothing for your SEO.

It is not a rewrite of all your content. It's a triage process. You categorize pages into four buckets:

1. **Keep as-is**  performing well, content is current and complete
2. **Update**  good topic, outdated or thin content, needs work
3. **Consolidate**  multiple pages covering the same topic, merge them
4. **Remove or noindex**  no value, thin content that hurts more than it helps

The goal is to end the audit with fewer, stronger pages  not more.

---

## Step 1: Export Your Full URL List

You can't audit what you can't see. Start with a complete list of all public URLs on your site.

For an API-first CMS, pull this from your database directly:

```sql
-- Pseudocode, adapt to your schema
SELECT 
  handle, slug, title, published_at, updated_at, view_count
FROM papers
WHERE status = 'published' AND is_public = true
ORDER BY published_at ASC;
```

Do the same for project pages, user profile pages, and any static marketing pages. Combine them into a spreadsheet with these columns:

- Full URL
- Page type (paper, project, profile, marketing)
- Title
- Published date
- Last updated date
- Word count (if available)

This is your audit working document.

---

## Step 2: Pull Google Search Console Data

Google Search Console shows you how each URL is performing in search. Export the Performance report (last 6 months) at the page level. Add these columns to your spreadsheet:

- Impressions (how many times this URL appeared in search results)
- Clicks (how many people actually clicked)
- Average position (your average ranking position)
- CTR (click-through rate)

Now you have traffic data for every URL. This is where the decisions come from.

---

## Step 3: Categorize Each Page

With your URL list and performance data combined, categorize each page:

**High impressions + decent clicks + good position = Keep.** Don't touch these. They're working.

**High impressions + very low CTR = Update title and meta description.** The page is showing up in search but people aren't clicking. The title or description isn't compelling enough. Rewrite them.

**Low impressions + no clicks + published more than 6 months ago = Investigate.** Either the topic has no search demand, the content is too thin, or Google decided not to index it. Check the Index Coverage report to confirm whether it's indexed.

**Zero impressions + zero clicks = Likely not indexed.** Check Search Console's URL inspection tool. If it's not indexed, find out why. Common reasons: thin content, noindex tag accidentally applied, canonical pointing elsewhere.

**Two or more pages with similar topics and split performance = Consolidate candidates.** These are your cannibalization problems.

---

## Step 4: Check for Orphan Pages

An orphan page is a published page with no internal links pointing to it. Google can find it through your sitemap, but it's treated as lower priority because your own site doesn't seem to consider it important.

To find orphans, you need two lists:

1. All your published URLs
2. All URLs referenced by at least one internal link on any page

The difference is your orphan list.

For a database-backed CMS, this is a query:

```
All published paper slugs
MINUS
All slugs that appear in any relatedPostIds array
MINUS
All slugs that appear in any pillarSlug reference
= Orphans
```

For each orphan, decide: is this content worth keeping? If yes, add it as a related post on at least two relevant pages and include it in the appropriate pillar's supporting posts list. If no, consolidate or remove it.

---

## Step 5: Identify Thin Content

Thin content is content that doesn't provide enough value to justify being indexed. Google's Helpful Content guidelines specifically target pages that exist to fill a topic gap rather than to genuinely help users.

Signs of thin content:
- Under 300 words for a topic that deserves more depth
- Content that could be a paragraph in another post rather than its own page
- Placeholder text or "coming soon" pages
- Automatically generated content with no unique insight
- Pages that restate the title in different words without adding information

For thin pages, you have three options:
- **Beef them up**  add depth, examples, data, or practical guidance until the page genuinely earns its place
- **Merge them** into a stronger, more comprehensive page on the same topic
- **Add `noindex`** until you have time to fix them  this removes them from Google's index without deleting them

---

## Step 6: Check Technical Issues on Underperforming Pages

For pages with good topics but bad performance, rule out technical problems before assuming the content is the issue:

**Is the page actually indexed?** Use the URL inspection tool in Search Console.

**Is the title tag unique?** Search `site:yourdomain.com` and look for duplicate titles in the results.

**Is the canonical correct?** View source and find the canonical tag. Does it point to this URL or to a different one?

**Are there broken links on the page?** A page with broken outbound links signals low maintenance to Google.

**Is the content server-rendered?** If key content loads client-side, Google may not be seeing the full page.

---

## Step 7: Act on Your Findings

An audit is only valuable if you act on it. Prioritize by impact:

**Do first:**
- Fix any pages with incorrect canonicals or accidental noindex tags (immediate indexation recovery)
- Consolidate obvious cannibalization pairs (simplest wins)
- Add internal links to orphan pages that have good content (quick signal boost)

**Do next:**
- Rewrite titles and meta descriptions for high-impression, low-CTR pages
- Beef up the most important thin pages

**Do eventually:**
- Full rewrites for outdated posts that cover important topics
- Remove or noindex confirmed low-value pages

---

## How Often to Audit

For a growing content operation, a lightweight quarterly audit is manageable. You're not reviewing every page every time  you're:

- Checking for new orphans from recently published content
- Reviewing the bottom 20% of pages by impressions
- Scanning for new cannibalization as your keyword map grows

A full audit  every page, full categorization  once a year is usually enough once the initial cleanup is done.

---

## The Mindset Shift

Most content strategies are additive. The instinct is always: publish more, cover more topics, fill more gaps. A content audit introduces a subtractive mindset  what do we remove, consolidate, or improve?

Both are necessary. But for most sites that have been publishing for a year or more, the subtractive work produces faster results. Making 10 existing pages significantly better is usually faster and more impactful than writing 10 new pages from scratch.

---

*Part of our series on Programmatic SEO and Content Operations. Start with [the pillar guide](#) or explore [how to build a content hub that ranks](#).*
