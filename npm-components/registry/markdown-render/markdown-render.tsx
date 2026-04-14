import "./markdown-render.css";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeShikiFromHighlighter from '@shikijs/rehype/core';
import { createHighlighter, type BuiltinLanguage, type BundledTheme } from 'shiki';
import { isInternalHref, isPlaceholderHref } from '@/lib/seo';

const SHIKI_THEME_LIGHT:BundledTheme = "ayu-light";
const SHIKI_THEME_DARK: BundledTheme = "vitesse-dark";
const SHIKI_LANGS: BuiltinLanguage[] = [
    'tsx',
    'typescript',
    'javascript',
    'jsx',
    'json',
    'bash',
    'markdown',
    'html',
    'css',
    'python',
    'yaml',
];

const shikiHighlighter = await createHighlighter({
    themes: [SHIKI_THEME_LIGHT, SHIKI_THEME_DARK],
    langs: SHIKI_LANGS,
});

function rehypeShikiSync() {
    return rehypeShikiFromHighlighter(shikiHighlighter,
        {
            themes: {
                light: SHIKI_THEME_LIGHT,
                dark: SHIKI_THEME_DARK,
            },
            defaultColor: 'light-dark()',
        });
}

type PostRenderProps = {
    content: string
    contentContainerId?: string
}

function MarkdownActionIcon({ className, dataAttr }: { className?: string; dataAttr: 'data-copy-icon' | 'data-check-icon' }) {
    const isCheck = dataAttr === 'data-check-icon';

    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            {...{ [dataAttr]: true }}
        >
            {isCheck ? (
                <path
                    d="M20 6L9 17L4 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            ) : (
                <>
                    <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
                    <path d="M5 15H4C2.89543 15 2 14.1046 2 13V4C2 2.89543 2.89543 2 4 2H13C14.1046 2 15 2.89543 15 4V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </>
            )}
        </svg>
    );
}

export default function MarkdownRender({ content, contentContainerId }: PostRenderProps) {
    const siteUrl = String(import.meta.env.PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4321')).trim();

    return (
        <div>
            <div id={contentContainerId} className="markdownDiv">
                <ReactMarkdown
                    children={content}
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[
                        rehypeRaw,
                        rehypeShikiSync,
                    ]}
                    components={{
                        a: ({ node, ...props }) => {
                            const href = String(props.href || '').trim();
                            if (isPlaceholderHref(href)) {
                                return <span {...props}>{props.children}</span>;
                            }

                            const external = href ? !isInternalHref(href, siteUrl) : false;
                            return (
                                <a
                                    href={href}
                                    target={external ? "_blank" : undefined}
                                    rel={external ? "noopener noreferrer" : undefined}
                                    {...props}
                                />
                            );
                        },
                        img: ({ node, alt, src, ...props }) => {
                            const fallbackAlt = String(src || '')
                                .split('/')
                                .pop()
                                ?.replace(/\.[a-z0-9]+$/i, '')
                                ?.replace(/[-_]+/g, ' ')
                                ?.trim() || 'Article image';

                            return (
                                <img
                                    src={src}
                                    alt={String(alt || fallbackAlt)}
                                    loading="lazy"
                                    decoding="async"
                                    {...props}
                                />
                            );
                        },
                        pre: ({ node, children, ...props }) => (
                            <div className="markdownCodeBlock">
                                <button
                                    type="button"
                                    data-copy-button
                                    aria-label="Copy code"
                                    className="markdownCopyButton"
                                >
                                    <MarkdownActionIcon dataAttr="data-copy-icon" />
                                    <MarkdownActionIcon dataAttr="data-check-icon" className="markdownHidden" />
                                </button>
                                <pre {...props}>{children}</pre>
                            </div>
                        ),
                        table: ({ node, children, ...props }) => (
                            <div className="markdownTableScrollArea">
                                <table className="markdownTable" {...props}>
                                    {children}
                                </table>
                            </div>
                        ),
                        th: ({ node, className, children, ...props }) => (
                            <th className={className} {...props}>
                                {children}
                            </th>
                        ),
                        td: ({ node, className, children, ...props }) => (
                            <td className={className} {...props}>
                                {children}
                            </td>
                        ),
                        mark: ({ node, children, ...props }) => (
                            <mark {...props}>
                                {children}
                            </mark>
                        ),
                    }} />
            </div>

            <script
                dangerouslySetInnerHTML={{
                    __html: `(function(){
    var bindCopyButtons = function() {
        var buttons = document.querySelectorAll('button[data-copy-button]');
        for (var i = 0; i < buttons.length; i++) {
            var button = buttons[i];
            if (!(button instanceof HTMLButtonElement)) continue;
            if (button.dataset.copyBound === '1') continue;
            button.dataset.copyBound = '1';
            button.addEventListener('click', async function() {
                var copyIcon = this.querySelector('[data-copy-icon]');
                var checkIcon = this.querySelector('[data-check-icon]');
                var block = this.closest('.markdownCodeBlock');
                var codeEl = block ? block.querySelector('pre code') : null;
                var text = codeEl && codeEl.textContent ? codeEl.textContent : '';
                if (!text.trim()) return;
                try {
                    await navigator.clipboard.writeText(text);
                    if (copyIcon) copyIcon.classList.add('markdownHidden');
                    if (checkIcon) checkIcon.classList.remove('markdownHidden');
                    window.setTimeout(function() {
                        if (checkIcon) checkIcon.classList.add('markdownHidden');
                        if (copyIcon) copyIcon.classList.remove('markdownHidden');
                    }, 1200);
                } catch (_) {}
            });
        }
    };

    if (window.__whitepapperCopyInit) {
        if (typeof window.__whitepapperBindCopyButtons === 'function') {
            window.__whitepapperBindCopyButtons();
        }
        return;
    }

    window.__whitepapperCopyInit = true;
    window.__whitepapperBindCopyButtons = bindCopyButtons;

    bindCopyButtons();
    document.addEventListener('astro:page-load', bindCopyButtons);
    document.addEventListener('astro:after-swap', function() {
        window.setTimeout(bindCopyButtons, 0);
    });
})();`,
                }}
            />
        </div>)
}
