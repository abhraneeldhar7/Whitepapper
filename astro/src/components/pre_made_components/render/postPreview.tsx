"use client"
import styles from "./postPreview.module.css";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useId } from "react";
import PostPreviewTocIsland from "./PostPreviewTocIsland";

type PostRenderProps = {
    content: string
    contentContainerId?: string
}

export default function PostRender({ content, contentContainerId }: PostRenderProps) {
    const generatedContentContainerId = useId().replace(/:/g, "-")
    const resolvedContentContainerId = contentContainerId || generatedContentContainerId

    return (
        <div>
            <div id={resolvedContentContainerId} className={styles.markdownDiv}>
                <ReactMarkdown
                    children={content}
                    remarkPlugins={[remarkGfm]}
                    components={{
                        a: ({ node, ...props }) => (
                            <a
                                href={props.href || "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                {...props}
                            />
                        ),
                        code: ({ node, className, children, ...props }) => {
                            return (
                                <code {...props}>
                                    {children}
                                </code>
                            );
                        },
                    }} />
            </div>
        </div>)
}
