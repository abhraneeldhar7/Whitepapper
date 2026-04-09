import styles from "./postPreview.module.css";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useId } from "react";
import { CopyIcon } from "lucide-react";
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

export default function PostRender({ content, contentContainerId }: PostRenderProps) {
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
                                        data-copy-button
                                        size="icon-sm"
                                        // variant="outline"
                                        aria-label="Copy code"
                                        className="absolute top-2 p-[5px] rounded-sm right-2 z-2 trasnition-all duration-100"
                                    >
                                        <CopyIcon />
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
        </div>)
}
