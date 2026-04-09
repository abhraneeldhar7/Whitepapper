import styles from "./markdown-render.module.css";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useId } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type PostRenderProps = {
    content: string
    contentContainerId?: string
}

const HIGHLIGHT_REGEX = /==(.+?)==/g;

function remarkHighlight() {
    return (tree: any) => {
        const walk = (node: any) => {
            if (!node || !Array.isArray(node.children)) {
                return;
            }

            const nextChildren: any[] = [];

            for (const child of node.children) {
                if (child?.type === "text" && typeof child.value === "string" && child.value.includes("==")) {
                    let lastIndex = 0;
                    let match: RegExpExecArray | null;

                    HIGHLIGHT_REGEX.lastIndex = 0;
                    while ((match = HIGHLIGHT_REGEX.exec(child.value)) !== null) {
                        const [fullMatch, highlightedText] = match;
                        const startIndex = match.index;

                        if (startIndex > lastIndex) {
                            nextChildren.push({
                                type: "text",
                                value: child.value.slice(lastIndex, startIndex),
                            });
                        }

                        nextChildren.push({
                            type: "highlight",
                            data: { hName: "mark" },
                            children: [{ type: "text", value: highlightedText }],
                        });

                        lastIndex = startIndex + fullMatch.length;
                    }

                    if (lastIndex < child.value.length) {
                        nextChildren.push({
                            type: "text",
                            value: child.value.slice(lastIndex),
                        });
                    }

                    continue;
                }

                walk(child);
                nextChildren.push(child);
            }

            node.children = nextChildren;
        };

        walk(tree);
    };
}

export default function MarkdownRender({ content, contentContainerId }: PostRenderProps) {
    const generatedContentContainerId = useId().replace(/:/g, "-")
    const resolvedContentContainerId = contentContainerId || generatedContentContainerId

    return (
        <div>
            <div id={resolvedContentContainerId} className={styles.markdownDiv}>
                <ReactMarkdown
                    children={content}
                    remarkPlugins={[remarkGfm, remarkHighlight]}
                    components={{
                        a: ({ node, ...props }) => {
                            const href = props.href || "#";
                            const isExternal =
                                /^(https?:)?\/\//i.test(href) ||
                                href.startsWith("mailto:") ||
                                href.startsWith("tel:");

                            if (!isExternal) {
                                return <a href={href} {...props} />;
                            }

                            return (
                                <a
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    {...props}
                                />
                            );
                        },
                        code: ({ node, className, children, ...props }) => {
                            return (
                                <code {...props} >
                                    {children}
                                </code>
                            );
                        },
                        pre: ({ node, className, children, ...props }) => {
                            return (
                                <pre {...props} className="relative">
                                    <Button
                                        type="button"
                                        size="icon-sm"
                                        data-copy-button
                                        aria-label="Copy code"
                                        className="absolute top-2 p-[5px] rounded-sm right-2 z-2 trasnition-all duration-100"
                                    >
                                        <CopyIcon data-copy-icon />
                                        <CheckIcon data-check-icon className="hidden" />
                                    </Button>
                                    {children}
                                </pre>
                            )
                        },
                        // mark: ({ node, children, ...props }) => (
                        //     <div className={styles.highlightedText}>
                        //         <mark {...props}>{children}</mark>
                        //     </div>
                        // ),
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
    var root = document.getElementById(${JSON.stringify(resolvedContentContainerId)});
    if (!root) return;
    var buttons = root.querySelectorAll('button[data-copy-button]');
    for (var i = 0; i < buttons.length; i++) {
        var button = buttons[i];
        if (!(button instanceof HTMLButtonElement)) continue;
        if (button.dataset.copyBound === '1') continue;
        button.dataset.copyBound = '1';
        button.addEventListener('click', async function() {
            var copyIcon = this.querySelector('[data-copy-icon]');
            var checkIcon = this.querySelector('[data-check-icon]');
            var pre = this.closest('pre');
            var codeEl = pre ? pre.querySelector('code') : null;
            var text = codeEl && codeEl.textContent ? codeEl.textContent : '';
            if (!text.trim()) return;
            try {
                await navigator.clipboard.writeText(text);
                if (copyIcon) copyIcon.classList.add('hidden');
                if (checkIcon) checkIcon.classList.remove('hidden');
                window.setTimeout(function() {
                    if (checkIcon) checkIcon.classList.add('hidden');
                    if (copyIcon) copyIcon.classList.remove('hidden');
                }, 1200);
            } catch (_) {}
        });
    }
})();`,
                                }}
                        />
        </div>)
}
