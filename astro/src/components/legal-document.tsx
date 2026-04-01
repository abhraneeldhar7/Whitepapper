import { ArrowLeftIcon } from "lucide-react";

type LegalSection = {
  title: string;
  content: string;
};

type LegalDocumentProps = {
  title: string;
  eyebrow: string;
  summary: string;
  effectiveDate: string;
  sections: LegalSection[];
  altHref: string;
  altLabel: string;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export default function LegalDocument({
  title,
  eyebrow,
  summary,
  effectiveDate,
  sections,
  altHref,
  altLabel,
}: LegalDocumentProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl px-6 py-8 md:px-10 md:py-10">
        <div className="flex items-center justify-between border-b border-border pb-5">
          <a
            href="/"
            className="inline-flex items-center gap-2 border border-foreground px-3 py-2 text-xs font-medium tracking-wide transition-colors hover:bg-foreground hover:text-background"
          >
            <ArrowLeftIcon size={14} />
            Back to home
          </a>
          <a
            href={altHref}
            className="text-xs uppercase tracking-[0.14em] text-muted-foreground underline-offset-4 hover:underline"
          >
            {altLabel}
          </a>
        </div>

        <header className="py-10 md:py-14">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p>
          <h1 className="mt-3 max-w-3xl font-[Instrument] text-4xl leading-[1.05] md:text-6xl">{title}</h1>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
            {summary}
          </p>
          <p className="mt-4 text-xs uppercase tracking-[0.12em] text-muted-foreground">
            Effective {effectiveDate}
          </p>
        </header>

        <div className="grid gap-8 border-t border-border pt-8 md:grid-cols-12">
          <aside className="md:col-span-4">
            <div className="md:sticky md:top-8">
              <p className="mb-3 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                On This Page
              </p>
              <nav className="space-y-1.5">
                {sections.map((section, index) => {
                  const id = slugify(section.title);
                  return (
                    <a
                      key={section.title}
                      href={`#${id}`}
                      className="block border-l border-border py-1 pl-3 text-sm text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                    >
                      {index + 1}. {section.title}
                    </a>
                  );
                })}
              </nav>
            </div>
          </aside>

          <main className="space-y-3 md:col-span-8">
            {sections.map((section, index) => {
              const id = slugify(section.title);
              return (
                <article
                  key={section.title}
                  id={id}
                  className="border border-border bg-muted p-5 md:p-6"
                >
                  <p className="text-[11px] uppercase tracking-[0.11em] text-muted-foreground">
                    Section {index + 1}
                  </p>
                  <h2 className="mt-2 font-[Instrument] text-2xl leading-tight md:text-3xl">{section.title}</h2>
                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground md:text-base">
                    {section.content}
                  </p>
                </article>
              );
            })}
          </main>
        </div>
      </div>
    </div>
  );
}
