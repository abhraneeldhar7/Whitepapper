import { useEffect } from "react";
import { copyToClipboardWithToast } from "@/lib/utils";

type Props = {
  contentContainerId: string;
};

export default function PostPreviewCopyIsland({ contentContainerId }: Props) {
  useEffect(() => {
    if (typeof document === "undefined") return;

    const container = document.getElementById(contentContainerId);
    if (!container) return;

    const buttons = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button[data-copy-button]"),
    );

    const listeners: Array<() => void> = [];

    buttons.forEach((button) => {
      const pre = button.closest("pre");
      const codeEl = pre?.querySelector<HTMLElement>("code");
      if (!codeEl) return;

      const handleClick = async () => {
        const text = codeEl.textContent ?? "";
        if (!text.trim()) return;
        await copyToClipboardWithToast(text, "Copied", "Error");
      };

      button.addEventListener("click", handleClick);
      listeners.push(() => button.removeEventListener("click", handleClick));
    });

    return () => {
      listeners.forEach((dispose) => dispose());
    };
  }, [contentContainerId]);

  return null;
}
