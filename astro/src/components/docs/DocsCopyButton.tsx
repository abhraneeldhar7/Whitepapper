import { useMemo, useState } from "react";
import { CheckIcon, ChevronDown, CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

type DocsCopyButtonProps = {
  markdown: string;
};
import chatgptLogo from "@/assets/logos/chatgpt.svg"
import claudeLogo from "@/assets/logos/claude.svg"

const buildAssistantPrompt = (url: string) => `I'm looking at this whitepapper documentation:
${url}
Help me understand how to use it. Be ready to explain concepts, give examples, or help debug based on it.
`;

export default function DocsCopyButton({ markdown }: DocsCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const pageUrl = useMemo(() => {
    if (typeof window === "undefined") return "https://whitepapper.antk.in/docs";
    return window.location.href;
  }, []);

  const prompt = useMemo(() => buildAssistantPrompt(pageUrl), [pageUrl]);
  const encodedPrompt = useMemo(() => encodeURIComponent(prompt), [prompt]);

  const copyOptions = useMemo(
    () => [
      {
        name: "Claude",
        logo: claudeLogo,
        href: `https://claude.ai/new?q=${encodedPrompt}`,
      },
      {
        name: "ChatGPT",
        logo: chatgptLogo,
        href: `https://chatgpt.com/?q=${encodedPrompt}`,
      },
      // {
      //   name: "Gemini",
      //   logo: geminiLogo,
      //   href: `https://www.google.com/search?q=${encodedPrompt}`,
      // },
    ],
    [encodedPrompt],
  );

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
    <div className="overflow-hidden rounded-[5px] border w-fit shrink-0 flex">
      <Button variant="secondary" size="sm" onClick={handleCopy} className="rounded-[0px] border-0">
        {copied ? <CheckIcon /> : <CopyIcon />}
        Copy
      </Button>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="secondary" size="sm" className="border-0 rounded-[0px] px-[10px]"><ChevronDown className="size-3" /></Button>
        </PopoverTrigger>
        <PopoverContent className="p-1 w-fit">
          <div className="flex flex-col gap-1">
            {copyOptions.map((item, index) => (
              <a key={index} href={item.href} target="_blank" rel="noreferrer noopener" className="block">
                <Button variant="ghost" className="justify-start text-muted-foreground py-[20px] w-full" size="sm">
                  <img src={item.logo.src} height={16} width={16} className="dark:invert opacity-[0.8]" /> Open in {item.name}
                </Button>
              </a>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
