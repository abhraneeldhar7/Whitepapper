import "./markdown-render.css";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkHighlight from 'remark-highlight';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

type PostRenderProps = {
    content: string
    contentContainerId?: string
}

function MarkdownActionIcon({ className, dataAttr }: { className?: string; dataAttr: 'data-copy-icon' | 'data-check-icon' }) {
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
            <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M5 15H4C2.89543 15 2 14.1046 2 13V4C2 2.89543 2.89543 2 4 2H13C14.1046 2 15 2.89543 15 4V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}

export default function MarkdownRender({ content, contentContainerId }: PostRenderProps) {

    return (
        <div>
            <div id={contentContainerId} className="markdownDiv">
                <ReactMarkdown
                    children={content}
                    remarkPlugins={[remarkGfm, remarkHighlight]}
                    rehypePlugins={[rehypeRaw]}
                    components={{
                        a: ({ node, ...props }) => {
                            return (
                                <a
                                    href={props.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    {...props}
                                />
                            );
                        },
                        code({ node, inline, className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || '');
                            return !inline && match ? (
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
                                    <SyntaxHighlighter style={oneDark} language={match[1]} customStyle={{
                                        background: 'transparent',
                                        color: 'var(--foreground)'
                                    }}
                                        codeTagProps={{
                                            style: {
                                                color: 'var(--foreground)',
                                            }
                                        }}
                                    >
                                        {String(children).replace(/\n$/, '')}
                                    </SyntaxHighlighter>
                                </div>
                            ) : (
                                <code className={className} {...props}>{children}</code>
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
