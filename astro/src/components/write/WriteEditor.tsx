import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRightFromSquare,
  CodeXmlIcon,
  CopyIcon,
  DownloadIcon,
  ForwardIcon,
  ImagePlusIcon,
  KeyboardIcon,
  KeyboardOffIcon,
  LoaderCircle,
  LockIcon,
  RssIcon,
  SaveIcon,
  SettingsIcon,
  ShuffleIcon,
  Trash2Icon,
  Volume2Icon,
  VolumeOffIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import TextEditor from "@/components/pre_made_components/editor/textEditor";
import type { TextEditorRef } from "@/components/pre_made_components/editor/textEditor";
import { Button } from "@/components/ui/button";
import blueBgPattern from "@/assets/landingPage/blueBgPattern.jpg"

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  checkPaperSlugAvailable,
  deletePaper,
  generatePaperMetadata,
  updatePaper,
} from "@/lib/api/papers";
import { uploadEmbeddedImage, uploadPaperMetadataImage, uploadThumbnail, getRandomDefaultThumbnailUrl } from "@/lib/api/uploads";
import { countImagesInContent, MAX_IMAGES_PER_PAPER, MAX_PAPER_BODY_LENGTH } from "@/lib/limits";
import { getCurrentUser } from "@/lib/api/users";
import { apiClient } from "@/lib/api/client";
import {
  MAX_EMBEDDED_HEIGHT,
  MAX_EMBEDDED_WIDTH,
  MAX_THUMBNAIL_HEIGHT,
  MAX_THUMBNAIL_WIDTH,
} from "@/lib/constants";
import type { PaperDoc, PaperMetadata, UserDoc } from "@/lib/entities";
import { compressImage, copyToClipboard, deepEqual, downloadMarkdownFile, isImageFile, normalizeSlug } from "@/lib/utils";
import { uploadImage } from "@/lib/useImageUpload";
import click1Sound from "@/assets/sounds/click1.mp3";
import click2Sound from "@/assets/sounds/click2.mp3";
import click3Sound from "@/assets/sounds/click3.mp3";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import OnscreenKeyboard from "../keyboard";
import ScrollToTop from "../scrollToTop";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";
import DistributionDialog from "./DistributionDialog";
import IntegrationsSection from "../integrations-4";
import { MAX_CONTENT_PAPER_WIDTH } from "@/lib/design";

type WriteEditorProps = {
  initialPaper: PaperDoc;
  isMobileUA: boolean;
};

const typingSoundSources = [click1Sound, click2Sound, click3Sound];


function toReadableSlug(value: string): string {
  return normalizeSlug(value) || "untitled-paper";
}

const metadataFieldConfig: Array<{ key: keyof PaperMetadata; type: "text" | "number" | "boolean" | "list" | "image" }> = [
  { key: "title", type: "text" },
  { key: "metaDescription", type: "text" },
  { key: "canonical", type: "text" },
  { key: "robots", type: "text" },
  { key: "ogTitle", type: "text" },
  { key: "ogDescription", type: "text" },
  { key: "ogImage", type: "image" },
  { key: "ogImageWidth", type: "number" },
  { key: "ogImageHeight", type: "number" },
  { key: "ogImageAlt", type: "text" },
  { key: "ogLocale", type: "text" },
  { key: "ogPublishedTime", type: "text" },
  { key: "ogModifiedTime", type: "text" },
  { key: "ogAuthorUrl", type: "text" },
  { key: "ogTags", type: "list" },
  { key: "twitterTitle", type: "text" },
  { key: "twitterDescription", type: "text" },
  { key: "twitterImage", type: "image" },
  { key: "twitterImageAlt", type: "text" },
  { key: "twitterCreator", type: "text" },
  { key: "headline", type: "text" },
  { key: "abstract", type: "text" },
  { key: "keywords", type: "text" },
  { key: "articleSection", type: "text" },
  { key: "wordCount", type: "number" },
  { key: "readingTimeMinutes", type: "number" },
  { key: "inLanguage", type: "text" },
  { key: "datePublished", type: "text" },
  { key: "dateModified", type: "text" },
  { key: "authorName", type: "text" },
  { key: "authorHandle", type: "text" },
  { key: "authorUrl", type: "text" },
  { key: "authorId", type: "text" },
  { key: "coverImageUrl", type: "image" },
  { key: "publisherName", type: "text" },
  { key: "publisherUrl", type: "text" },
  { key: "isAccessibleForFree", type: "boolean" },
  { key: "license", type: "text" },
];

export default function WriteEditor({ initialPaper, isMobileUA }: WriteEditorProps) {
  const [user, setUser] = useState<UserDoc | null>(null);
  const paperId = initialPaper.paperId;

  useEffect(() => {
    getCurrentUser(apiClient).then(setUser).catch(() => setUser(null));
  }, []);
  const [paperDoc, setPaperDoc] = useState<PaperDoc>(() => ({
    ...initialPaper,
    body: initialPaper.body || "",
    metadata: initialPaper.metadata ?? null,
  }));
  const [savedPaperDoc, setSavedPaperDoc] = useState<PaperDoc>(() => ({
    ...initialPaper,
    body: initialPaper.body || "",
    metadata: initialPaper.metadata ?? null,
  }));
  const [saving, setSaving] = useState(false);
  const [distributionDialogOpen, setDistributionDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [uploadingEmbeddedCount, setUploadingEmbeddedCount] = useState(0);
  const [tempUploadingThumbnail, setTempUploadingThumbnail] = useState<string | null>(null);
  const [metadataDialogOpen, setMetadataDialogOpen] = useState(false);
  const [metadataGenerating, setMetadataGenerating] = useState(false);
  const [uploadingMetadataImageMap, setUploadingMetadataImageMap] = useState<Record<string, boolean>>({});
  const [tempMetadataImageMap, setTempMetadataImageMap] = useState<Record<string, string>>({});
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isTopBarHovered, setIsTopBarHovered] = useState(false);
  const [isTopBarPinned, setIsTopBarPinned] = useState(false);
  const [keyboardEffectEnabled, setKeyboardEffectEnabled] = useState(() => {
    try { return localStorage.getItem("wp_keyboardEffect") !== "0"; } catch { return Boolean(initialPaper.ownerId); }
  });
  const [typingSoundEnabled, setTypingSoundEnabled] = useState(() => {
    try { return localStorage.getItem("wp_typingSound") === "1"; } catch { return false; }
  });
  const [defaultThumbnailsLoading, setDefaultThumbnailsLoading] = useState(false);
  const [thumbnailPopoverOpen, setThumbnailPopoverOpen] = useState(false);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const topBarRef = useRef<HTMLDivElement>(null);
  const hiddenImgRef = useRef<HTMLImageElement>(null);

  const preloadImage = useCallback((url: string): Promise<void> => {
    return new Promise((resolve) => {
      if (hiddenImgRef.current) {
        hiddenImgRef.current.src = url;
      }
      setTimeout(resolve, 500);
    });
  }, []);

  const editorRef = useRef<TextEditorRef>(null);

  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const previousTempMetadataImageMapRef = useRef<Record<string, string>>({});
  const title = paperDoc.title;
  const slug = paperDoc.slug;
  const body = paperDoc.body || "";
  const metadata = paperDoc.metadata ?? null;
  const pageDetails = {
    thumbnailUrl: paperDoc.thumbnailUrl || "",
    status: paperDoc.status,
    lastSavedSlug: savedPaperDoc.slug,
  };
  const isMobile = isMobileUA;

  useEffect(() => {
    document.documentElement.dataset.writeEditorReady = "true";
    return () => {
      delete document.documentElement.dataset.writeEditorReady;
      if (tempUploadingThumbnail) {
        URL.revokeObjectURL(tempUploadingThumbnail);
      }
      const previousMap = previousTempMetadataImageMapRef.current;
      for (const field of Object.keys(previousMap)) {
        URL.revokeObjectURL(previousMap[field]);
      }
    };
  }, [tempUploadingThumbnail]);

  useEffect(() => {
    const previousMap = previousTempMetadataImageMapRef.current;
    const nextMap = tempMetadataImageMap;

    for (const field of Object.keys(previousMap)) {
      if (!nextMap[field] && previousMap[field]) {
        URL.revokeObjectURL(previousMap[field]);
      }
    }

    previousTempMetadataImageMapRef.current = nextMap;
  }, [tempMetadataImageMap]);

  const isAssetUploading = uploadingThumb || uploadingEmbeddedCount > 0;

  const saveActionRef = useRef(handleSaveAction);
  saveActionRef.current = handleSaveAction;

  const isSavingRef = useRef(false);
  isSavingRef.current = saving;
  const isUploadingRef = useRef(false);
  isUploadingRef.current = isAssetUploading;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (isUploadingRef.current || isSavingRef.current) {
          return;
        }
        void saveActionRef.current();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (sheetOpen || statusPopoverOpen) {
      setIsTopBarPinned(true);
    }
  }, [sheetOpen, statusPopoverOpen]);

  const titleRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isNew) {
      const el = titleRef.current;
      if (el) { el.focus(); el.select(); }
    } else {
      editorRef.current?.focus();
    }
  }, []);

  function playTypingSound() {
    if (!typingSoundEnabled) {
      return;
    }
    const randomSource = typingSoundSources[Math.floor(Math.random() * typingSoundSources.length)];
    const audio = new Audio(randomSource);
    audio.volume = 0.35;
    void audio.play().catch(() => {
      // Ignore autoplay errors; sound will work after first user interaction.
    });
  }

  function handleToggleKeyboardEffect(checked: boolean) {
    setKeyboardEffectEnabled(checked);
    try { localStorage.setItem("wp_keyboardEffect", checked ? "1" : "0"); } catch {}
  }

  function handleToggleTypingSound(checked: boolean) {
    setTypingSoundEnabled(checked);
    try { localStorage.setItem("wp_typingSound", checked ? "1" : "0"); } catch {}
  }

  async function onSave(slugOverride?: string) {
    setSaving(true);
    try {
      const updatePayload: Parameters<typeof updatePaper>[1] = {
        title,
        slug: slugOverride ?? slug,
        body,
        thumbnailUrl: pageDetails.thumbnailUrl || null,
        status: paperDoc.status,
      };
      if (metadata) {
        updatePayload.metadata = metadata;
      }

      const updated = await updatePaper(paperId, updatePayload);
      const normalizedUpdated: PaperDoc = {
        ...updated,
        body: updated.body || "",
        metadata: updated.metadata ?? null,
      };
      setPaperDoc(normalizedUpdated);
      setSavedPaperDoc(normalizedUpdated);
      return updated;
    } finally {
      setSaving(false);
    }
  }

  function resolvePublicPaperUrl(nextSlug?: string): string | null {
    if (!user?.username) return null;
    return `/${user.username}/${nextSlug || slug}`;
  }

  const isNew = paperDoc.new === true;

  async function resolveAutoSlugForSave(): Promise<string> {
    const currentSlug = String(slug || "").trim();

    if (!isNew) {
      if (currentSlug !== savedPaperDoc.slug) {
        const available = await checkPaperSlugAvailable(currentSlug, paperId);
        if (!available) {
          throw new Error("This URL is already taken. Try a different one.");
        }
      }
      return currentSlug;
    }

    const fromTitle = toReadableSlug(title);
    if (fromTitle && fromTitle !== "untitled-paper") {
      const available = await checkPaperSlugAvailable(fromTitle, paperId);
      if (available) {
        setPaperDoc((prev) => ({ ...prev, slug: fromTitle }));
        return fromTitle;
      }
      const suffix = Math.random().toString(36).slice(2, 7);
      setPaperDoc((prev) => ({ ...prev, slug: `${fromTitle}-${suffix}` }));
      return `${fromTitle}-${suffix}`;
    }

    const fromBody = toReadableSlug(body.slice(0, 60));
    if (fromBody && fromBody !== "untitled-paper") {
      const available = await checkPaperSlugAvailable(fromBody, paperId);
      if (available) {
        setPaperDoc((prev) => ({ ...prev, slug: fromBody }));
        return fromBody;
      }
      const suffix = Math.random().toString(36).slice(2, 7);
      setPaperDoc((prev) => ({ ...prev, slug: `${fromBody}-${suffix}` }));
      return `${fromBody}-${suffix}`;
    }

    setPaperDoc((prev) => ({ ...prev, slug: paperId }));
    return paperId;
  }

  async function handleSaveAction() {
    if (isAssetUploading || saving || !hasSheetChanges) {
      return;
    }

    if (body.length > MAX_PAPER_BODY_LENGTH) {
      toast.error(`Paper content is too long. Maximum length is ${MAX_PAPER_BODY_LENGTH} characters.`);
      return;
    }

    const imageCount = countImagesInContent(body);
    if (imageCount > MAX_IMAGES_PER_PAPER) {
      toast.error(`Paper image limit reached (${MAX_IMAGES_PER_PAPER}). Remove some images before saving.`);
      return;
    }

    let resolvedSlug = slug;
    try {
      resolvedSlug = await resolveAutoSlugForSave();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to prepare a slug right now. Please try again.");
      return;
    }

    const toastId = toast.loading("Saving...");
    try {
      const updated = await onSave(resolvedSlug);
      toast.dismiss(toastId);
      if (updated.status === "public") {
        const publicUrl = resolvePublicPaperUrl(updated.slug);
        if (publicUrl) {
          toast.success("Published", {
            action: {
              label: "Visit",
              onClick: () => window.open(publicUrl, "_blank", "noopener,noreferrer"),
            },
          });
        } else {
          toast.success("Published");
        }
      } else {
        toast.success("Paper saved.");
      }
    } catch (error) {
      toast.dismiss(toastId);
      toast.error(error instanceof Error ? error.message : "Failed to save page.");
    }
  }

  async function onThumbnailUpload(file: File) {
    let localPreview: string | null = null;
    await uploadImage<{ url: string }>(file, {
      compress: { maxWidth: MAX_THUMBNAIL_WIDTH, maxHeight: MAX_THUMBNAIL_HEIGHT, crop: false },
      upload: (f) => uploadThumbnail(paperId, f),
      onStart: () => setUploadingThumb(true),
      onFinish: () => {
        if (localPreview) URL.revokeObjectURL(localPreview);
        setTempUploadingThumbnail(null);
        setUploadingThumb(false);
      },
      toastMessages: {
        loading: "Uploading thumbnail...",
        success: "Thumbnail uploaded.",
        error: (error) => (error instanceof Error ? error.message : "Thumbnail upload failed."),
      },
      onPrepare: (uploadableFile) => {
        localPreview = URL.createObjectURL(uploadableFile);
        setTempUploadingThumbnail(localPreview);
      },
      onSuccess: async (uploaded) => {
        await preloadImage(uploaded.url);
        setPaperDoc((prev) => ({ ...prev, thumbnailUrl: uploaded.url }));
      },
    });
  }

  async function onEditorImageUpload(file: File): Promise<{ success: boolean; url?: string; message?: string }> {
    const imageCount = countImagesInContent(body);
    if (imageCount >= MAX_IMAGES_PER_PAPER) {
      return {
        success: false,
        message: `Paper image limit reached (${MAX_IMAGES_PER_PAPER}). Remove some images before uploading a new one.`,
      };
    }

    const result = await uploadImage<{ url: string }>(file, {
      compress: { maxWidth: MAX_EMBEDDED_WIDTH, maxHeight: MAX_EMBEDDED_HEIGHT, crop: false },
      upload: (f) => uploadEmbeddedImage(paperId, f),
      onStart: () => setUploadingEmbeddedCount((prev) => prev + 1),
      onFinish: () => setUploadingEmbeddedCount((prev) => Math.max(0, prev - 1)),
      toastMessages: {
        loading: "Uploading image",
        success: "Embedded image uploaded.",
        error: (error) => (error instanceof Error ? error.message : "Embedded image upload failed."),
      },
    });

    if (result) {
      return { success: true, url: result.url };
    }
    return { success: false, message: "Upload failed." };
  }

  const slugValue = slug.trim();
  const hasSheetChanges = !deepEqual(
    {
      ...savedPaperDoc,
      body: savedPaperDoc.body || "",
      thumbnailUrl: savedPaperDoc.thumbnailUrl || null,
      metadata: savedPaperDoc.metadata ?? null,
    },
    {
      ...paperDoc,
      body: paperDoc.body || "",
      thumbnailUrl: paperDoc.thumbnailUrl || null,
      metadata: paperDoc.metadata ?? null,
    },
  );

  const handleSaveWithStatus = (nextStatus: "draft" | "public") => {
    setPaperDoc((prev) => ({ ...prev, status: nextStatus }));
    setSavedPaperDoc((prev) => ({ ...prev, status: nextStatus }));
    setStatusPopoverOpen(false);
    updatePaper(paperId, { status: nextStatus }).catch(() => {});
  };

  const handleCopyPageId = async () => {
    const ok = await copyToClipboard(paperId);
    if (ok) {
      toast.info("Page ID copied.");
    } else {
      toast.error("Unable to copy Page ID.");
    }
  };

  const handleShare = async () => {
    if (paperDoc.status !== "public") {
      toast.error("This paper is private");
      return;
    }
    if (!slugValue) {
      toast.error("Save a slug before sharing.");
      return;
    }
    const baseUrl = String(import.meta.env.PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "")
      || (typeof window !== "undefined" ? window.location.origin : "");
    if (!baseUrl) {
      toast.error("PUBLIC_SITE_URL is not configured.");
      return;
    }
    const ok = await copyToClipboard(`${baseUrl}/${slugValue}`);
    if (ok) {
      toast.info("Public URL copied.");
    } else {
      toast.error("Unable to copy public URL.");
    }
  };

  const handleExport = () => {
    if (!body) {
      toast.info("Nothing to export yet.");
      return;
    }
    downloadMarkdownFile(body, slugValue || "page");
  };

  const handleOpenMetadataDialog = () => {
    if (!metadata) return;
    setMetadataDialogOpen(true);
  };

  const generateMetadata = async () => {
    setMetadataGenerating(true);
    try {
      const generated = await generatePaperMetadata(paperId, {
        ...paperDoc,
        thumbnailUrl: paperDoc.thumbnailUrl || null,
        metadata: paperDoc.metadata ?? null,
      });
      setPaperDoc((prev) => ({ ...prev, metadata: generated }));
      toast.success("Metadata generated");
    } catch (error) {
      console.error("generateMetadata failed:", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate metadata.");
    } finally {
      setMetadataGenerating(false);
    }
  };

  const handleMetadataValueChange = (
    key: keyof PaperMetadata,
    type: "text" | "number" | "boolean" | "list",
    value: string,
  ) => {
    setPaperDoc((prev) => {
      const next = { ...prev.metadata } as any;
      if (!next || !prev.metadata) return prev;
      if (type === "number") {
        const parsed = Number(value);
        next[key] = Number.isFinite(parsed) ? parsed : 0;
      } else if (type === "boolean") {
        next[key] = value.toLowerCase() === "true";
      } else if (type === "list") {
        next[key] = value.split(",").map((item: string) => item.trim()).filter(Boolean);
      } else {
        next[key] = value;
      }
      return { ...prev, metadata: next as PaperMetadata };
    });
  };

  const handleClearMetadataImage = (field: keyof PaperMetadata) => {
    setPaperDoc((prev) => {
      if (!prev.metadata) return prev;
      return { ...prev, metadata: { ...prev.metadata, [field]: "" } };
    });
  };

  const handleMetadataImageUpload = async (field: keyof PaperMetadata, file: File) => {
    setUploadingMetadataImageMap((prev) => ({ ...prev, [field]: true }));
    let localPreview: string | null = null;

    try {
      if (!isImageFile(file)) {
        throw new Error("Only image files are allowed.");
      }

      const compressed = await compressImage({
        file,
        maxWidth: 500,
        maxHeight: 500,
        crop: false,
      });
      const uploadableFile = compressed instanceof File ? compressed : file;
      localPreview = URL.createObjectURL(uploadableFile);
      setTempMetadataImageMap((prev) => ({ ...prev, [field]: localPreview as string }));

      const uploaded = await uploadPaperMetadataImage(paperId, String(field), uploadableFile);
      setPaperDoc((prev) => {
        if (!prev.metadata) return prev;
        return { ...prev, metadata: { ...prev.metadata, [field]: uploaded.url } };
      });
    } catch (error) {
      console.error(error);
    } finally {
      if (localPreview) {
        setTempMetadataImageMap((prev) => {
          const { [field]: _removed, ...rest } = prev;
          return rest;
        });
      }
      setUploadingMetadataImageMap((prev) => ({ ...prev, [field]: false }));
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await deletePaper(paperId);
      const cid = initialPaper.collectionId;
      const pid = initialPaper.projectId;
      if (cid && pid) window.location.href = `/dashboard/${pid}/${cid}`;
      else if (pid) window.location.href = `/dashboard/${pid}`;
      else window.location.href = "/dashboard";
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete page.");
      setDeleteLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col w-full pt-15 relative" onClick={() => setIsTopBarPinned(false)}>
      <ScrollToTop />
      <div
        className="fixed top-0 left-0 w-full z-[10] md:pb-8 md:bg-[unset] bg-background/20 md:backdrop-blur-[0px] backdrop-blur-[30px]"
        data-editor-topbar
        ref={topBarRef}
        onPointerDownCapture={() => setIsTopBarPinned(true)}
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={() => setIsTopBarHovered(true)}
        onMouseLeave={() => setIsTopBarHovered(false)}
      >
        <div
          className={`px-[10px] py-[5px] flex items-center justify-between transition-all duration-300
          ${isTopBarHovered || isTopBarPinned || sheetOpen || statusPopoverOpen ? "md:translate-y-0 md:opacity-100" : "md:translate-y-[-100%] md:opacity-0"}
          `}
        >
          <a href={initialPaper.collectionId ? `/dashboard/${initialPaper.projectId}/${initialPaper.collectionId}` : initialPaper.projectId ? `/dashboard/${initialPaper.projectId}` : "/dashboard"}>
            <img
              src="/appLogo.png"
              height={28}
              width={28}
              alt="" />
          </a>

          <div className="flex gap-[5px] items-center">
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost">
                  <SettingsIcon />
                </Button>
              </SheetTrigger>
              <SheetContent
                side={isMobile ? "bottom" : "right"}
                className="p-0 pb-10 data-[side=right]:h-full data-[side=bottom]:h-[80vh] "
                data-editor-overlay
              >
                <SheetHeader className="p-4 pb-2">
                  <SheetTitle>Paper settings</SheetTitle>
                </SheetHeader>
                <ScrollArea className="h-full">
                  <div className="flex flex-col gap-5 px-[15px] text-sm">
                    <div className="space-y-2">
                      <Label>Visibility</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              className="items-center flex-1"
                              variant={pageDetails.status == "draft" ? "outline" : "default"}
                              disabled={saving || isAssetUploading}
                            >
                              {pageDetails.status == "draft" ?
                                <LockIcon /> :
                                <RssIcon />
                              }
                              {pageDetails.status.toUpperCase()}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="p-[3px] w-[100px] space-y-[3px]"
                            data-editor-overlay
                          >
                            <Button
                              size="sm"
                              className="w-full"
                              variant={pageDetails.status == "draft" ? "outline" : "ghost"}
                              disabled={saving || isAssetUploading}
                              onClick={() => handleSaveWithStatus("draft")}
                            >
                              <LockIcon />
                              Draft
                            </Button>
                            <Button
                              size="sm"
                              variant={pageDetails.status == "public" ? "outline" : "ghost"}
                              className="w-full"
                              disabled={saving || isAssetUploading}
                              onClick={() => handleSaveWithStatus("public")}
                            >
                              <RssIcon />
                              Public
                            </Button>
                          </PopoverContent>
                        </Popover>
                        {isNew ? (
                          <Button variant="outline" className="flex-1" disabled={isAssetUploading || saving} loading={saving} onClick={() => { void handleSaveAction(); }}>
                            <SaveIcon /> Save
                          </Button>
                        ) : pageDetails.status == "public" ? (
                          user?.username ? (
                            <a href={`/${user.username}/${pageDetails.lastSavedSlug || slug}`} className="flex-1 flex" target="_blank">
                              <Button variant="outline" className="flex-1"><ArrowUpRightFromSquare /> Open</Button>
                            </a>
                          ) : (
                            <Button variant="outline" className="flex-1" disabled>
                              <ArrowUpRightFromSquare /> Open
                            </Button>
                          )
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Page ID</Label>
                      <div className="flex gap-2 items-center">
                        <Input value={paperId} disabled />
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-[34px] w-[34px] items-center justify-center"
                          onClick={handleCopyPageId}
                          disabled={saving || isNew}
                        >
                          <CopyIcon />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Custom URL</Label>
                      <div className="flex gap-1">
                        <Input
                          spellCheck={false}
                          value={slug}
                          disabled={isNew}
                          onChange={(event) => setPaperDoc((prev) => ({ ...prev, slug: event.target.value }))}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={async () => {
                            const publicUrl = resolvePublicPaperUrl();
                            if (publicUrl) {
                              const ok = await copyToClipboard(publicUrl);
                              toast[ok ? "info" : "error"](ok ? "URL copied." : "Unable to copy URL.");
                            }
                          }}
                          disabled={isNew}
                        >
                          <CopyIcon size={14} />
                        </Button>
                      </div>
                      {isNew && (
                        <p className="text-xs text-muted-foreground">Save to auto-generate a URL from the title</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="secondary" className="flex-1" onClick={handleShare} disabled={isNew}>
                        <ForwardIcon /> Share
                      </Button>
                      <Button variant="secondary" className="flex-1" onClick={handleExport} disabled={isNew}>
                        <DownloadIcon /> Export
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label>Metadata</Label>
                      <div className="flex items-center gap-2 w-full">
                        {metadata ? (
                          <Button variant="secondary" type="button" className="w-full" onClick={handleOpenMetadataDialog}>
                            <CodeXmlIcon /> View
                          </Button>
                        ) : (
                          <Button className="w-full" type="button" onClick={generateMetadata} loading={metadataGenerating} disabled={isNew}>
                            Generate
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="relative h-[200px] space-y-4 overflow-hidden">
                      <Label>Distribute</Label>
                      <IntegrationsSection hideText />
                      <div className="absolute bottom-[-22px] left-0 right-0 h-full bg-gradient-to-t from-background to-transparent from-[10%] z-2" />
                      <Button className="w-full absolute z-3 bottom-0" onClick={() => setDistributionDialogOpen(true)} disabled={isNew}>
                        <RssIcon /> Distribute
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label>Preferences</Label>
                      <div className="p-3 space-y-6">
                        <div className="hidden md:flex justify-between">
                          <div className="flex gap-2 items-center">
                            {keyboardEffectEnabled ? <KeyboardIcon size={17} /> : <KeyboardOffIcon size={17} />}
                            <p>Enable keyboard effect</p>
                          </div>
                          <Switch checked={keyboardEffectEnabled} onCheckedChange={handleToggleKeyboardEffect} />
                        </div>
                        <div className="flex justify-between">
                          <div className="flex gap-2 items-center">
                            {typingSoundEnabled ? <Volume2Icon size={17} /> : <VolumeOffIcon size={17} />}
                            <p>Enable typing sound</p>
                          </div>
                          <Switch checked={typingSoundEnabled} onCheckedChange={handleToggleTypingSound} />
                        </div>
                        <div className="flex justify-between items-center">
                          <p>Theme</p>
                          <Button variant="secondary" size="icon">
                            <AnimatedThemeToggler size={18} />
                          </Button>
                        </div>
                        <div className="flex justify-between items-center mb-20">
                          <p>Delete</p>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="destructive" disabled={deleteLoading} size="icon"><Trash2Icon /></Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Delete Page</DialogTitle>
                              </DialogHeader>
                              <p>{title}</p>
                              {pageDetails.thumbnailUrl && (
                                <img src={pageDetails.thumbnailUrl} alt={title || "Thumbnail"} className="w-full h-[200px] rounded-md border object-cover" />
                              )}
                              <DialogFooter>
                                <DialogClose asChild>
                                  <Button variant="secondary">Cancel</Button>
                                </DialogClose>
                                <Button className="w-[100px]" variant="destructive" onClick={handleDelete} disabled={deleteLoading} loading={deleteLoading}>
                                  <Trash2Icon /> Delete
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>

            <Popover open={statusPopoverOpen} onOpenChange={setStatusPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  disabled={saving || isAssetUploading}
                >
                  {pageDetails.status === "public" ? <RssIcon /> : <LockIcon />}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-[3px] w-[120px] mx-[10px]" data-editor-overlay>
                <div className="flex flex-col gap-[5px]">
                  <Button
                    size="sm"
                    variant={pageDetails.status == "draft" ? "outline" : "ghost"}
                    onClick={() => handleSaveWithStatus("draft")}
                  >
                    <LockIcon className="mr-1" /> Draft
                  </Button>
                  <Button
                    size="sm"
                    variant={pageDetails.status == "public" ? "outline" : "ghost"}
                    onClick={() => handleSaveWithStatus("public")}>
                    <RssIcon className="mr-1" /> Public
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {pageDetails.status === "public" && !isNew && !hasSheetChanges ? (
              user?.username ? (
                <a href={`/${user.username}/${pageDetails.lastSavedSlug || slug}`} target="_blank">
                  <Button variant="default">
                    <ArrowUpRightFromSquare /> Open
                  </Button>
                </a>
              ) : (
                <Button variant="default" disabled>
                  <ArrowUpRightFromSquare /> Open
                </Button>
              )
            ) : (
              <Button
                variant="default"
                disabled={isAssetUploading || saving || !hasSheetChanges}
                loading={saving}
                onClick={() => { void handleSaveAction(); }}
              >
                {pageDetails.status === "public" ? <RssIcon className="mr-1" /> : <SaveIcon className="mr-1" />}
                {pageDetails.status === "public" ? "Publish" : "Save"}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 w-full">

        <div
          className="w-full mx-auto"
          style={{ maxWidth: `${MAX_CONTENT_PAPER_WIDTH}px` }}>

          <Popover open={thumbnailPopoverOpen} onOpenChange={setThumbnailPopoverOpen}>
            <PopoverTrigger asChild>
              <div
                className="w-full rounded-[10px] overflow-hidden flex items-center justify-center relative group shrink-0 cursor-pointer"
              >
                {tempUploadingThumbnail ? (
                  <img
                    src={tempUploadingThumbnail}
                    alt="Uploading thumbnail"
                    className="w-full h-full object-cover animate-pulse"
                  />
                ) : pageDetails.thumbnailUrl ? (
                  <>
                    <img src={pageDetails.thumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center duration-300">
                      <ImagePlusIcon size={25} className="text-white" />
                    </div>
                    <div className="absolute top-2 right-2">
                      <Button
                        size="icon"
                        variant="destructive"
                        className="z-2 md:opacity-0 group-hover:opacity-100"
                        onClick={(event) => {
                          event.stopPropagation();
                          setThumbnailPopoverOpen(false);
                          setPaperDoc((prev) => ({ ...prev, thumbnailUrl: "" }));
                        }}
                      >
                        <XIcon size={16} />
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 h-[250px] md:h-[350px] w-full relative overflow-hidden text-foreground group select-none cursor-pointer">
                    <img src={blueBgPattern.src} alt="" className="absolute h-full w-full object-cover z-[-1] group-hover:dark:opacity-[0.8] group-hover:opacity-[0.6] transition-all duration-250 opacity-[0.4]" />
                    <p />
                    <ImagePlusIcon size={32} className="" />
                    <p className="text-[12px] font-[500] ">Add Thumbnail</p>
                  </div>
                )}
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-1">
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  className="justify-center items-center w-[80px] h-[80px]"
                  disabled={defaultThumbnailsLoading}
                  onClick={async () => {
                    setDefaultThumbnailsLoading(true);
                    try {
                      const result = await getRandomDefaultThumbnailUrl();
                      await preloadImage(result.url);
                      setPaperDoc((prev) => ({ ...prev, thumbnailUrl: result.url }));
                      setThumbnailPopoverOpen(false);
                    } catch {
                      toast.error("Failed to get a random thumbnail.");
                    } finally {
                      setDefaultThumbnailsLoading(false);
                    }
                  }}
                >
                  {defaultThumbnailsLoading ? (
                    <LoaderCircle className="size-6 animate-spin" />
                  ) : (
                    <ShuffleIcon className="size-6" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  className="justify-center items-center w-[80px] h-[80px]"
                  onClick={() => {
                    setThumbnailPopoverOpen(false);
                    thumbnailInputRef.current?.click();
                  }}
                >
                  <ImagePlusIcon className="size-6" />
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <input
            type="file"
            ref={thumbnailInputRef}
            className="hidden"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void onThumbnailUpload(file);
                event.target.value = "";
              }
            }}
          />

          <div className="mt-3 flex flex-col gap-2 flex-1">
            <div
              className="w-full">
              <Textarea
                ref={titleRef}
                autoFocus={body.length === 0}
                value={title}
                onChange={(event) => {
                  const nextTitle = event.target.value;
                  if (nextTitle !== title) {
                    playTypingSound();
                  }
                  setPaperDoc((prev) => ({ ...prev, title: nextTitle }));
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    editorRef.current?.focus();
                    editorContainerRef.current?.scrollIntoView({
                      block: "end",
                      behavior: "smooth",
                    });
                  }
                }}
                placeholder="Enter page title..."
                className="bg-transparent dark:bg-transparent border-none focus:ring-0 outline-none text-[40px] md:text-[40px] font-[400] placeholder:opacity-20 resize-none border-none outline-none focus-visible:ring-0 focus:ring-0 px-0"
              />
            </div>

            {!isMobile && keyboardEffectEnabled &&
              <OnscreenKeyboard className="w-full fixed top-[50%] left-[50%] translate-y-[-50%] translate-x-[-50%] z-[2]" />
            }
          </div>

          <div ref={editorContainerRef}>
            <TextEditor
              ref={editorRef}
              initialContent={body}
              onChange={(nextBody) => {
                if (nextBody !== body) {
                  playTypingSound();
                }
                setPaperDoc((prev) => ({ ...prev, body: nextBody }));
              }}
              onImageUpload={onEditorImageUpload}
              preloadImage={preloadImage}
            />
          </div>
        </div>
      </div>



      <Dialog
        open={metadataDialogOpen}
        onOpenChange={(open) => {
          setMetadataDialogOpen(open);
        }}
      >
        <DialogContent className="md:max-w-[500px] h-[70vh] md:h-[80vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Paper metadata</DialogTitle>
          </DialogHeader>
          {metadata ? (
            <div className="flex flex-col gap-3 min-h-0 flex-1">
              <ScrollArea className="min-h-0 flex-1 pr-3">
                <div className="space-y-4">
                  {metadataFieldConfig.map((fieldConfig) => {
                    const key = fieldConfig.key;
                    const rawValue = metadata[key];
                    const currentPreview = tempMetadataImageMap[String(key)];
                    const isUploadingImage = Boolean(uploadingMetadataImageMap[String(key)]);

                    if (fieldConfig.type === "image") {
                      const imageValue = String(rawValue || "");
                      const displayImage = currentPreview || imageValue;
                      return (
                        <div key={key}>
                          <Label>{String(key)}</Label>
                          <div className="mt-2 relative rounded-md">
                            {Boolean(displayImage) && !isUploadingImage ? (
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="absolute top-2 right-2 z-10"
                                onClick={() => handleClearMetadataImage(key)}
                                disabled={isUploadingImage}
                              >
                                <XIcon size={16} />
                              </Button>
                            ) : null}
                            {displayImage ? (
                              <img
                                src={displayImage}
                                alt={String(key)}
                                className={`h-fit w-full rounded-[5px] object-cover ${isUploadingImage ? "animate-pulse" : ""}`}
                              />
                            ) : (
                              <p className="text-sm text-muted-foreground">No image</p>
                            )}
                            {!displayImage ? (
                              <div
                                role="button"
                                tabIndex={0}
                                className={`mt-2 flex h-[40px] w-full items-center justify-center rounded-md border border-dashed text-sm ${!isUploadingImage ? "cursor-pointer hover:bg-muted/40" : "cursor-not-allowed opacity-60"}`}
                                onClick={() => {
                                  if (isUploadingImage) return;
                                  const input = document.getElementById(`metadata-upload-${String(key)}`) as HTMLInputElement | null;
                                  input?.click();
                                }}
                                onKeyDown={(event) => {
                                  if (event.key !== "Enter" && event.key !== " ") return;
                                  event.preventDefault();
                                  if (isUploadingImage) return;
                                  const input = document.getElementById(`metadata-upload-${String(key)}`) as HTMLInputElement | null;
                                  input?.click();
                                }}
                              >
                                <ImagePlusIcon size={16} className="mr-2" />
                                Upload image
                              </div>
                            ) : null}
                            <input
                              id={`metadata-upload-${String(key)}`}
                              type="file"
                              accept="image/*"
                              disabled={isUploadingImage}
                              className="mt-2 hidden"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) {
                                  void handleMetadataImageUpload(key, file);
                                  event.target.value = "";
                                }
                              }}
                            />
                          </div>
                        </div>
                      );
                    }

                    const valueForInput =
                      fieldConfig.type === "list"
                        ? (Array.isArray(rawValue) ? rawValue.join(", ") : "")
                        : fieldConfig.type === "boolean"
                          ? String(Boolean(rawValue))
                          : String(rawValue ?? "");
                    const isDescriptionField =
                      key === "metaDescription" ||
                      key === "ogDescription" ||
                      key === "twitterDescription" ||
                      key === "abstract";

                    return (
                      <div key={key}>
                        <Label>{String(key)}</Label>
                        {isDescriptionField ? (
                          <Textarea
                            className="mt-2 min-h-[100px] resize-y break-words"
                            value={valueForInput}
                            onChange={(event) => {
                              handleMetadataValueChange(
                                key,
                                fieldConfig.type as "text" | "number" | "boolean" | "list",
                                event.target.value,
                              );
                            }}
                          />
                        ) : (
                          <Input
                            className="mt-2 break-words"
                            value={valueForInput}
                            onChange={(event) => {
                              handleMetadataValueChange(
                                key,
                                fieldConfig.type as "text" | "number" | "boolean" | "list",
                                event.target.value,
                              );
                            }}
                          />
                        )}
                      </div>
                    );
                  })}

                  {/* jsonLd editor */}
                  <div>
                    <Label>jsonLd</Label>
                    <Textarea
                      className="mt-2 min-h-[200px] resize-y font-mono text-xs break-all whitespace-pre-wrap"
                      value={metadata.jsonLd ? JSON.stringify(metadata.jsonLd, null, 2) : ""}
                      onChange={(event) => {
                        try {
                          const parsed = JSON.parse(event.target.value);
                          setPaperDoc((prev) => {
                            if (!prev.metadata) return prev;
                            return { ...prev, metadata: { ...prev.metadata, jsonLd: parsed } };
                          });
                        } catch {
                          // allow editing invalid JSON
                        }
                      }}
                    />
                  </div>
                </div>
              </ScrollArea>
              <DialogFooter>
                <Button
                  type="button"
                  disabled={metadataGenerating}
                  loading={metadataGenerating}
                  onClick={generateMetadata}
                >
                  <CodeXmlIcon /> Generate
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No metadata available.</p>
          )
          }
        </DialogContent >
      </Dialog >

      <DistributionDialog
        open={distributionDialogOpen}
        onOpenChange={setDistributionDialogOpen}
        user={user}
        paperDoc={paperDoc}
        status={pageDetails.status}
      />

      <img ref={hiddenImgRef} alt="" className="absolute opacity-0 pointer-events-none" style={{ width: 1, height: 1, top: 0, left: 0 }} />
    </div >
  );
}
