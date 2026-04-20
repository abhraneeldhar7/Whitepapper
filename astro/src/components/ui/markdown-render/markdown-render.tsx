import "./markdown-render.css";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeShikiFromHighlighter from '@shikijs/rehype/core';
import { createHighlighter, type BuiltinLanguage, type BundledTheme } from 'shiki';
import { isInternalHref, isPlaceholderHref } from '@/lib/seo';
import MarkdownCopyButtonClient from './MarkdownCopyButtonClient';
import type { ReactNode } from 'react';

const SHIKI_THEME_LIGHT:BundledTheme = "github-light"
const SHIKI_THEME_DARK: BundledTheme = "vitesse-dark";
const SHIKI_LANGS: BuiltinLanguage[] = [
    'ts',
    'tsx',
    'typescript',
    'javascript',
    'jsx',
    'json',
    'http',
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
            addLanguageClass: true,
            defaultLanguage: 'txt',
            fallbackLanguage: 'txt',
        });
}

type PostRenderProps = {
    content: string
    contentContainerId?: string
}

function getPreLanguage(node: unknown): string {
    const preNode = node as { children?: Array<{ tagName?: string; properties?: { class?: string | string[]; className?: string | string[] } }> } | undefined;
    const codeNode = (preNode?.children || []).find((child) => child?.tagName === 'code');
    const rawClass = codeNode?.properties?.class ?? codeNode?.properties?.className ?? '';
    const className = Array.isArray(rawClass) ? rawClass.join(' ') : String(rawClass || '');
    const match = /language-(\w+)/.exec(className || '');
    const language = match?.[1];
    return language === 'txt' ? '' : (language || '');
}

function extractTextContent(node: ReactNode): string {
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (!node || typeof node !== 'object') return '';
    if (Array.isArray(node)) return node.map(extractTextContent).join('');

    const reactNode = node as { props?: { children?: ReactNode } };
    return extractTextContent(reactNode.props?.children);
}

export default function MarkdownRender({ content, contentContainerId }: PostRenderProps) {
    const siteUrl = String(import.meta.env.PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4321')).trim();
    let imageIndex = 0;

    return (
        <div>
            <div id={contentContainerId} className="markdownDiv">
                <ReactMarkdown
                    children={content}
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[
                        rehypeRaw,
                        [rehypeSanitize, defaultSchema],
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
                            imageIndex += 1;
                            const isFirstImage = imageIndex === 1;
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
                                    loading={isFirstImage ? "eager" : "lazy"}
                                    decoding="async"
                                    fetchPriority={isFirstImage ? "high" : undefined}
                                    {...props}
                                />
                            );
                        },
                        pre: ({ node, children, ...props }) => {
                            const language = getPreLanguage(node);
                            const codeText = extractTextContent(children).replace(/\n$/, '');

                            return (
                                <div className="markdownCodeBlock">
                                    <div className="markdownCodeBlockHeader">
                                        <span className="markdownCodeBlockLanguage">{language}</span>
                                        <div className="markdownCodeBlockActions">
                                            <MarkdownCopyButtonClient codeText={codeText} />
                                        </div>
                                    </div>
                                    <pre {...props}>{children}</pre>
                                </div>
                            );
                        },
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

        </div>)
}
