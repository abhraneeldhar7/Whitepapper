"use client";

import { useEffect, useState } from "react";
import { LockIcon } from "lucide-react";
import { toast } from "sonner";

import DevtoLogo from "@/assets/logos/devto.webp";
import HashnodeLogo from "@/assets/logos/hashnodeLogo.png";
import LinkedInLogo from "@/assets/logos/linkedinLogo.png";
import MediumLogo from "@/assets/logos/mediumLogo.jpeg";
import RedditLogo from "@/assets/logos/redditLogo.jpeg";
import ThreadsLogo from "@/assets/logos/threadsLogo.png";
import XLogo from "@/assets/logos/xLogo.jpg";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  getDevtoDistribution,
  getHashnodeDistribution,
  publishDevtoDistribution,
  publishHashnodeDistribution,
} from "@/lib/api/distributions";
import { resolveIntegrationBaseUrl } from "@/lib/integrationBaseUrl";
import type {
  DevtoDistribution,
  HashnodeDistribution,
  PaperMetadata,
  UserDoc,
} from "@/lib/types";
import { copyToClipboard } from "@/lib/utils";

const HASHNODE_ACCESS_TOKEN_KEY = "hashnode_access_token";
const DEVTO_ACCESS_TOKEN_KEY = "devto_access_token";

type SupportedPlatformId = "devto" | "hashnode";
type PlatformId =
  | "hashnode"
  | "devto"
  | "reddit"
  | "medium"
  | "linkedin"
  | "x"
  | "threads";

type DistributionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserDoc | null;
  paperId: string;
  title: string;
  slug: string;
  body: string;
  status: "draft" | "public";
  integrationBaseUrl?: string;
  thumbnailUrl?: string | null;
  metadata?: PaperMetadata | null;
};

type DistributionState = {
  hashnode: HashnodeDistribution | null;
  devto: DevtoDistribution | null;
};

type PlatformDefinition = {
  id: PlatformId;
  name: string;
  logoSrc: string;
  logoClassName?: string;
  behavior: "publish" | "medium_import" | "coming_soon";
};

const platformDefinitions: PlatformDefinition[] = [
  { id: "hashnode", name: "Hashnode", logoSrc: HashnodeLogo.src, behavior: "publish" },
  { id: "devto", name: "Dev.to", logoSrc: DevtoLogo.src, logoClassName: "rounded-[4px] dark:invert", behavior: "publish" },
  { id: "medium", name: "Medium", logoSrc: MediumLogo.src, behavior: "medium_import" },
  { id: "reddit", name: "Reddit", logoSrc: RedditLogo.src, behavior: "coming_soon" },
  { id: "linkedin", name: "LinkedIn", logoSrc: LinkedInLogo.src, behavior: "coming_soon" },
  { id: "x", name: "X", logoSrc: XLogo.src, behavior: "coming_soon" },
  { id: "threads", name: "Threads", logoSrc: ThreadsLogo.src, behavior: "coming_soon" },
];

const emptyDistributionState: DistributionState = {
  hashnode: null,
  devto: null,
};

function readLocalToken(key: string): string {
  if (typeof window === "undefined") {
    return "";
  }
  return localStorage.getItem(key)?.trim() || "";
}

export default function DistributionDialog({
  open,
  onOpenChange,
  user,
  paperId,
  title,
  slug,
  body,
  status,
  integrationBaseUrl,
  thumbnailUrl,
  metadata,
}: DistributionDialogProps) {
  const [distributionState, setDistributionState] = useState<DistributionState>(emptyDistributionState);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [postingPlatform, setPostingPlatform] = useState<SupportedPlatformId | null>(null);
  const [postedUrlMap, setPostedUrlMap] = useState<Partial<Record<SupportedPlatformId, string>>>({});
  const [mediumImportExpanded, setMediumImportExpanded] = useState(false);
  const [mediumImportUrl, setMediumImportUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPostingPlatform(null);
      setMediumImportExpanded(false);
      setMediumImportUrl(null);
      return;
    }

    let cancelled = false;

    async function loadDistributionState() {
      setLoadingConfig(true);
      const [hashnodeResult, devtoResult] = await Promise.allSettled([
        getHashnodeDistribution(),
        getDevtoDistribution(),
      ]);

      if (cancelled) {
        return;
      }

      setDistributionState({
        hashnode: hashnodeResult.status === "fulfilled" ? hashnodeResult.value : null,
        devto: devtoResult.status === "fulfilled" ? devtoResult.value : null,
      });

      if (hashnodeResult.status === "rejected" || devtoResult.status === "rejected") {
        toast.error("Unable to load every distribution setting right now.");
      }

      setLoadingConfig(false);
    }

    void loadDistributionState();

    return () => {
      cancelled = true;
    };
  }, [open]);

  function resolveAccessToken(platform: SupportedPlatformId): string {
    if (platform === "hashnode") {
      return readLocalToken(HASHNODE_ACCESS_TOKEN_KEY) || distributionState.hashnode?.accessToken?.trim() || "";
    }
    return readLocalToken(DEVTO_ACCESS_TOKEN_KEY) || distributionState.devto?.accessToken?.trim() || "";
  }

  function hasConfiguredAccessToken(platform: SupportedPlatformId): boolean {
    return Boolean(resolveAccessToken(platform));
  }

  function getPlatformStatus(platform: PlatformDefinition): string {
    if (platform.behavior === "coming_soon") {
      return "Awaiting approval";
    }
    if (platform.behavior === "medium_import") {
      return status === "public" ? "Import available" : "Publish paper to import";
    }
    if (loadingConfig) {
      return "Checking connection";
    }
    if (platform.id === "hashnode") {
      if (hasConfiguredAccessToken("hashnode")) {
        return "Ready to post";
      }
      return user?.preferences?.hashnodeIntegrated ? "Missing key" : "Not connected";
    }
    if (hasConfiguredAccessToken("devto")) {
      return "Ready to post";
    }
    return user?.preferences?.devtoIntegrated ? "Missing key" : "Not connected";
  }

  function resolveArticleUrl(): string | null {
    const normalizedSlug = slug.trim();
    const username = user?.username?.trim();
    if (!normalizedSlug || !username) {
      return null;
    }

    const base = resolveIntegrationBaseUrl(integrationBaseUrl);
    if (!base) {
      return null;
    }
    return `${base}/${username}/${normalizedSlug}`;
  }

  function resolveMediumImportUrl(): string | null {
    return "https://medium.com/me/stories";
  }

  async function handleMediumImport() {
    if (status !== "public") {
      toast.info("This paper needs to be published to be imported.");
      return;
    }

    const articleUrl = resolveArticleUrl();
    const importUrl = resolveMediumImportUrl();
    if (!articleUrl || !importUrl) {
      toast.error("Unable to build paper URL for Medium import.");
      return;
    }

    const copied = await copyToClipboard(articleUrl);
    if (!copied) {
      toast.error("Unable to copy the paper URL.");
      return;
    }

    setMediumImportUrl(importUrl);
    setMediumImportExpanded(true);
  }

  async function publishToPlatform(platform: SupportedPlatformId) {
    const resolvedTitle = title.trim();
    const resolvedSlug = slug.trim();
    const resolvedBody = body.trim();
    const accessToken = resolveAccessToken(platform);

    if (!resolvedTitle) {
      toast.error("Add a title before distributing.");
      return;
    }
    if (!resolvedSlug) {
      toast.error("Save a slug before distributing.");
      return;
    }
    if (!resolvedBody) {
      toast.error("Write some content before distributing.");
      return;
    }
    if (!user?.username) {
      toast.error("User handle is missing. Reload the page and try again.");
      return;
    }
    if (!accessToken) {
      toast.error(`No ${platform === "hashnode" ? "Hashnode" : "Dev.to"} key was found.`);
      return;
    }

    setPostingPlatform(platform);
    try {
      const payload = {
        paperId,
        title: resolvedTitle,
        slug: resolvedSlug,
        body,
        thumbnailUrl: thumbnailUrl || null,
        metadata: metadata || null,
        accessToken,
      };

      const result = platform === "hashnode"
        ? await publishHashnodeDistribution(payload)
        : await publishDevtoDistribution(payload);

      toast.success(`Posted to ${platform === "hashnode" ? "Hashnode" : "Dev.to"}.`);
      if (result.url) {
        setPostedUrlMap((current) => ({ ...current, [platform]: result.url as string }));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Distribution failed.");
    } finally {
      setPostingPlatform(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Distribute paper</DialogTitle>
          <DialogDescription>
            Every platform from your integration logos is listed here.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {platformDefinitions.map((platform) => {
            const isPublishPlatform = platform.id === "hashnode" || platform.id === "devto";
            const canPost =
              platform.behavior === "publish" &&
              !loadingConfig &&
              ((platform.id === "hashnode" && hasConfiguredAccessToken("hashnode")) ||
                (platform.id === "devto" && hasConfiguredAccessToken("devto")));
            const isPosting = isPublishPlatform && postingPlatform === platform.id;
            const postedUrl = isPublishPlatform ? postedUrlMap[platform.id as SupportedPlatformId] : undefined;
            const showMediumExpanded =
              platform.id === "medium" &&
              mediumImportExpanded &&
              Boolean(mediumImportUrl) &&
              status === "public";

            return (
              <div
                key={platform.id}
                className={`rounded-md border bg-card px-3 py-3 ${showMediumExpanded ? "space-y-3" : ""}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      alt={platform.name}
                      src={platform.logoSrc}
                      width={30}
                      height={30}
                      className={`h-[30px] w-[30px] shrink-0 object-contain rounded-[5px] ${platform.logoClassName ?? ""}`}
                    />
                    <div className="min-w-0">
                      <p className="text-[14px] font-[500] leading-none">{platform.name}</p>
                      <p className="mt-1 text-[12px] text-muted-foreground">{getPlatformStatus(platform)}</p>
                    </div>
                  </div>

                  {postedUrl ? (
                    <a href={postedUrl} target="_blank" rel="noreferrer noopener" className="shrink-0">
                      <Button variant="secondary" className="shrink-0">
                        Visit
                      </Button>
                    </a>
                  ) : platform.behavior === "publish" ? (
                    <Button
                      variant="secondary"
                      className="shrink-0"
                      onClick={() => {
                        if (platform.id === "hashnode" || platform.id === "devto") {
                          void publishToPlatform(platform.id);
                        }
                      }}
                      disabled={!canPost}
                      loading={Boolean(isPosting)}
                    >
                      Post
                    </Button>
                  ) : platform.behavior === "medium_import" ? (
                    status === "public" ? (
                      <Button
                        variant="secondary"
                        className="shrink-0"
                        onClick={() => {
                          void handleMediumImport();
                        }}
                      >
                        Import
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        className="shrink-0"
                        onClick={() => toast.info("This paper needs to be published to be imported.")}
                      >
                        <LockIcon className="mr-1" /> Private
                      </Button>
                    )
                  ) : (
                    <Button variant="secondary" className="shrink-0" disabled>
                      Post
                    </Button>
                  )}
                </div>

                {showMediumExpanded ? (
                  <div className="pl-[42px] pr-1">
                    <p className="text-[14px] text-center text-muted-foreground">
                      Url copied, now paste this into medium
                    </p>
                    <a
                      href={mediumImportUrl || "#"}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex mt-2 w-full"
                    >
                      <Button className="w-full" size="lg">
                        Continue
                      </Button>
                    </a>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
