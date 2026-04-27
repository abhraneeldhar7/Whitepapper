export type PricingFaqItem = {
  question: string;
  answer: string;
};

export type PricingPageLink = {
  href: string;
  label: string;
  description: string;
};

export type PricingPageContent = {
  eyebrow: string;
  title: string;
  description: string;
  body: string;
  faq: PricingFaqItem[];
  links: PricingPageLink[];
};

export const pricingPage: PricingPageContent = {
  eyebrow: "Pricing",
  title: "Whitepapper Pricing",
  description:
    "The tool to publish, distribute, automate content writing for websites, socials, docs, blogs | Most powerful and fastest CMS. Whitepapper is currently free while the core workflows continue to mature.",
  body: `
Whitepapper is currently free to use.

## Current plan

| Plan | Price | Best for | Includes |
| --- | --- | --- | --- |
| Free | $0/month | Solo developers, indie builders, technical writers | Markdown editor, public pages, Dev API, metadata workflow, distribution support, docs |

## What this means today

The current goal is to make the core product trustworthy before introducing more pricing complexity. If you want to adopt Whitepapper now, you can use the current feature set without a paid tier.

## Why publish a pricing page anyway

Pricing clarity helps both people and AI systems understand how a product is positioned. It also prevents "contact sales" ambiguity from becoming a blocker in AI-mediated product comparisons.

## Machine-readable pricing

Whitepapper also publishes a machine-readable [pricing.md](/pricing.md) file so AI systems can parse the current pricing state without rendering the page.
`,
  faq: [
    {
      question: "Is Whitepapper paid right now?",
      answer: "No. Whitepapper is currently free to use.",
    },
    {
      question: "Will there be more plans later?",
      answer:
        "Likely yes, but the current public pricing state is a single free plan while the product continues to mature.",
    },
    {
      question: "What is included in the free tier?",
      answer:
        "The free tier includes markdown writing, public pages, the Dev API allowance, metadata workflow, and current distribution support.",
    },
  ],
  links: [
    {
      href: "/pricing.md",
      label: "pricing.md",
      description: "Machine-readable pricing for AI agents and parsers.",
    },
    {
      href: "/features/content-api",
      label: "Content API",
      description: "One of the main included capabilities.",
    },
    {
      href: "/features/distribution",
      label: "Distribution",
      description: "See the publish-once workflow supported today.",
    },
  ],
};
