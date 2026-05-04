"use client"

import { MarkdownEditorView, useMarkdownEditor, wysiwygToolbarConfigs } from "@gravity-ui/markdown-editor";
import { ThemeProvider, Toaster, ToasterComponent, ToasterProvider } from "@gravity-ui/uikit";
import { forwardRef, useImperativeHandle, useEffect, useMemo, useRef, useState } from "react";
import "./editor-custom.css";

export interface TextEditorRef {
    focus: () => void;
    setContent: (content: string) => void;
}

interface TextEditorProps {
    onChange: (content: string) => void;
    onImageUpload: (file: File) => Promise<{ success: boolean; url?: string; message?: string }>;
    preloadImage?: (url: string) => Promise<void>;
    initialContent?: string;
    placeholder?: string;
}

const TextEditor = forwardRef<TextEditorRef, TextEditorProps>(
    ({ onChange, onImageUpload, preloadImage, initialContent = "", placeholder = "press / for options" }, ref) => {
        const fileInputRef = useRef<HTMLInputElement>(null);
        const editor = useMarkdownEditor({
            md: {
                html: false,
            },
            initial: {
                mode: 'wysiwyg',
                markup: initialContent,
                toolbarVisible: false,
            },
            handlers: {
                uploadFile: async (file: File) => {
                    const result = await onImageUpload(file);
                    if (result.success && result.url) {
                        await preloadImage?.(result.url);
                        return { url: result.url };
                    } else {
                        throw new Error(result.message || "Upload failed");
                    }
                },
            },
            wysiwygConfig: {
                placeholderOptions: {
                    value: placeholder,
                    behavior: 'empty-row',
                },
                extensionOptions: {
                    selectionContext: {
                        config: [
                            [wysiwygToolbarConfigs.wToggleHeadingFoldingItemData, wysiwygToolbarConfigs.textContextItemData],
                            [
                                wysiwygToolbarConfigs.wBoldItemData,
                                wysiwygToolbarConfigs.wItalicItemData,
                                wysiwygToolbarConfigs.wUnderlineItemData,
                                wysiwygToolbarConfigs.wMarkedItemData,
                                wysiwygToolbarConfigs.wStrikethroughItemData,
                                wysiwygToolbarConfigs.wCodeItemData,
                            ],
                        ]
                    }
                }
            },
        });

        useImperativeHandle(ref, () => ({
            focus: () => {
                editor.moveCursor('end');
                editor.focus();
            },
            setContent: (newContent: string) => {
                editor.replace(newContent);
            }
        }));

        const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;

            const tempUrl = URL.createObjectURL(file);

            (editor as any).actions.addImage.run({ src: tempUrl, alt: 'Uploading...' });

            const placeholderRegex = new RegExp(
                `!\\[Uploading\\.\\.\\.\\]\\(${tempUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^)]*\\)`,
                'g',
            );

            const uploadPromise = (async () => {
                const result = await onImageUpload(file);

                if (result.success && result.url) {
                    await preloadImage?.(result.url);
                    const currentContent = editor.getValue();
                    const newContent = currentContent.replace(placeholderRegex, `![image](${result.url})`);
                    editor.replace(newContent);
                } else {
                    const currentContent = editor.getValue();
                    const newContent = currentContent.replace(placeholderRegex, '');
                    editor.replace(newContent);
                    throw new Error(result.message || "Upload failed");
                }
            })();

            try {
                await uploadPromise;
            } finally {
                URL.revokeObjectURL(tempUrl);
                if (e.target) e.target.value = '';
            }
        };

    const toaster = useMemo(() => new Toaster(), []);

    const [mounted, setMounted] = useState(false);
    const [editorTheme, setEditorTheme] = useState<"light" | "dark">("light");
    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        const updateTheme = () => {
            const isDark = document.documentElement.classList.contains("dark");
            setEditorTheme(isDark ? "dark" : "light");
        };
        updateTheme();
        const observer = new MutationObserver(updateTheme);
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class"],
        });
        return () => observer.disconnect();
    }, []);

        useEffect(() => {
            if (mounted && initialContent) {
                if (editor.getValue() !== initialContent) {
                    const timer = setTimeout(() => {
                        editor.replace(initialContent);
                    }, 100);
                    return () => clearTimeout(timer);
                }
            }
        }, [mounted, initialContent, editor]);

        useEffect(() => {
            if (!(editor as any).actions.addImageWidget) return;

            const originalRun = (editor as any).actions.addImageWidget.run;
            (editor as any).actions.addImageWidget.run = () => {
                fileInputRef.current?.click();
            };

            return () => {
                (editor as any).actions.addImageWidget.run = originalRun;
            };
        }, [editor]);

        useEffect(() => {
            const handleChange = () => {
                const content = editor.getValue();
                onChange(content);
            };

            editor.on('change', handleChange);
            return () => {
                editor.off('change', handleChange);
            };
        }, [editor, onChange]);

        if (!mounted) {
            return <div className="h-screen w-full rounded-[8px] opacity-[0.5] py-[0.3em] px-[0.2em]">welcome</div>;
        }

        return (
            <ThemeProvider theme={editorTheme}>
                <ToasterProvider toaster={toaster}>
                    <ToasterComponent />
                    <div className="w-full flex flex-col gap-[10px] relative">
                        <MarkdownEditorView
                            stickyToolbar={false}
                            editor={editor}
                            autofocus={initialContent.length > 0}
                            settingsVisible={false}
                        />

                        <div
                            className="w-full cursor-text min-h-[300px]"
                            onClick={() => {
                                editor.moveCursor('end');
                                editor.focus();
                            }} />
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileChange}
                        />
                    </div>
                </ToasterProvider>
            </ThemeProvider>
        );
    }
);

TextEditor.displayName = "TextEditor";
export default TextEditor;
