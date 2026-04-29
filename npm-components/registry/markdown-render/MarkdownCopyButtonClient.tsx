import { useState } from "react";

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

type MarkdownCopyButtonClientProps = {
    codeText: string;
};

export default function MarkdownCopyButtonClient({ codeText }: MarkdownCopyButtonClientProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        const text = String(codeText || "");
        if (!text.trim()) return;

        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
        } catch {
            // ignore clipboard failures
        }
    };

    return (
        <button
            type="button"
            aria-label="Copy code"
            className="markdownCopyButton"
            onClick={handleCopy}
        >
            <MarkdownActionIcon dataAttr="data-copy-icon" className={copied ? "markdownHidden" : undefined} />
            <MarkdownActionIcon dataAttr="data-check-icon" className={copied ? undefined : "markdownHidden"} />
        </button>
    );
}
