import { useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type DocsCopyButtonProps = {
  markdown: string;
};

export default function DocsCopyButton({ markdown }: DocsCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
      
    } catch {
      setCopied(false);
    }
  };

  return (
    <Button type="button" variant="secondary"  onClick={handleCopy} className="gap-2">
      {copied ? <CheckIcon /> : <CopyIcon className="size-4" />}
      {copied ? "Copied" : "Copy Page"}
    </Button>
  );
}
