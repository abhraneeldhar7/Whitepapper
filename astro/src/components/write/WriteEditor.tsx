import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRightFromSquare,
  CopyIcon,
  DownloadIcon,
  ForwardIcon,
  ImagePlusIcon,
  KeyboardIcon,
  KeyboardOffIcon,
  LockIcon,
  RssIcon,
  SaveIcon,
  SettingsIcon,
  Trash2Icon,
  Volume2Icon,
  VolumeOffIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import TextEditor from "@/components/pre_made_components/editor/textEditor";
import type { TextEditorRef } from "@/components/pre_made_components/editor/textEditor";
import { Button } from "@/components/ui/button";
import cloudsimageUrl from "@/assets/clouds.jpg?url";
import {
  Dialog,
  DialogDescription,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  checkPaperSlugAvailable,
  deletePaper,
  generatePaperMetadata,
  updatePaper,
} from "@/lib/api/papers";
import { uploadEmbeddedImage, uploadPaperMetadataImage, uploadThumbnail } from "@/lib/api/uploads";
import { countImagesInContent, MAX_IMAGES_PER_PAPER, MAX_PAPER_BODY_LENGTH } from "@/lib/limits";
import { updateCurrentUser } from "@/lib/api/users";
import {
  MAX_EMBEDDED_HEIGHT,
  MAX_EMBEDDED_WIDTH,
  MAX_THUMBNAIL_HEIGHT,
  MAX_THUMBNAIL_WIDTH,
} from "@/lib/constants";
import type { PaperDoc, PaperMetadata, UserDoc } from "@/lib/types";
import { compressImage, copyToClipboard, deepEqual, downloadMarkdownFile, isImageFile } from "@/lib/utils";
import { resolveIntegrationBaseUrl } from "@/lib/integrationBaseUrl";
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

type WriteEditorProps = {
  initialPaper: PaperDoc;
  initialUser?: UserDoc | null;
  integrationBaseUrl?: string;
  isMobileUA: boolean;
};

type UiStatus = "draft" | "public";
const typingSoundSources = [click1Sound, click2Sound, click3Sound];

function toUiStatus(value: PaperDoc["status"]): UiStatus {
  return value === "published" ? "public" : "draft";
}

function toApiStatus(value: UiStatus): PaperDoc["status"] {
  return value === "public" ? "published" : "draft";
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

export default function WriteEditor({ initialPaper, initialUser, integrationBaseUrl, isMobileUA }: WriteEditorProps) {
  const [user, setUser] = useState<UserDoc | null>(initialUser ?? null);
  const paperId = initialPaper.paperId;
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
  const [slugChecking, setSlugChecking] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [distributionDialogOpen, setDistributionDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [uploadingEmbeddedCount, setUploadingEmbeddedCount] = useState(0);
  const [tempUploadingThumbnail, setTempUploadingThumbnail] = useState<string | null>(null);
  const [metadataDialogOpen, setMetadataDialogOpen] = useState(false);
  const [metadataGenerateConfirmOpen, setMetadataGenerateConfirmOpen] = useState(false);
  const [metadataEditMode, setMetadataEditMode] = useState(false);
  const [metadataDraft, setMetadataDraft] = useState<PaperMetadata | null>(paperDoc.metadata ?? null);
  const [metadataGenerating, setMetadataGenerating] = useState(false);
  const [uploadingMetadataImageMap, setUploadingMetadataImageMap] = useState<Record<string, boolean>>({});
  const [tempMetadataImageMap, setTempMetadataImageMap] = useState<Record<string, string>>({});
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isTopBarHovered, setIsTopBarHovered] = useState(false);
  const [isTopBarPinned, setIsTopBarPinned] = useState(false);
  const [keyboardEffectEnabled, setKeyboardEffectEnabled] = useState(Boolean(user?.preferences?.showKeyboardEffect));
  const [typingSoundEnabled, setTypingSoundEnabled] = useState(Boolean(user?.preferences?.typingSoundEnabled));
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const topBarRef = useRef<HTMLDivElement>(null);


  const editorRef = useRef<TextEditorRef>(null);

  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const previousTempMetadataImageMapRef = useRef<Record<string, string>>({});
  const title = paperDoc.title;
  const slug = paperDoc.slug;
  const body = paperDoc.body || "";
  const metadata = paperDoc.metadata ?? null;
  const pageDetails = {
    thumbnailUrl: paperDoc.thumbnailUrl || "",
    status: toUiStatus(paperDoc.status),
    lastSavedSlug: savedPaperDoc.slug,
  };
  const isMobile = isMobileUA;

  useEffect(() => {
    setKeyboardEffectEnabled(Boolean(user?.preferences?.showKeyboardEffect));
    setTypingSoundEnabled(Boolean(user?.preferences?.typingSoundEnabled));
  }, [user?.preferences?.showKeyboardEffect, user?.preferences?.typingSoundEnabled]);

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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (isAssetUploading) {
          return;
        }
        void handleSaveAction();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pageDetails.status, title, slug, body, pageDetails.thumbnailUrl, isAssetUploading, metadata, user?.username]);

  useEffect(() => {
    if (sheetOpen || statusPopoverOpen) {
      setIsTopBarPinned(true);
    }
  }, [sheetOpen, statusPopoverOpen]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const clickedTopBar = Boolean(target.closest("[data-editor-topbar]"));
      const clickedOverlay = Boolean(target.closest("[data-editor-overlay]"));
      if (clickedTopBar || clickedOverlay) {
        return;
      }

      setIsTopBarPinned(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
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

  function updateUserPreferences(
    patch: { showKeyboardEffect?: boolean; typingSoundEnabled?: boolean },
  ) {
    if (!user) {
      return;
    }

    const nextPreferences = {
      ...(user.preferences || {}),
      showKeyboardEffect: keyboardEffectEnabled,
      typingSoundEnabled,
      ...patch,
    };

    setUser((current) =>
      current
        ? {
          ...current,
          preferences: nextPreferences,
        }
        : current,
    );

    void updateCurrentUser({
      preferences: nextPreferences,
    })
      .then((updatedUser) => {
        setUser(updatedUser);
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Failed to save preference.");
      });
  }

  function handleToggleKeyboardEffect(checked: boolean) {
    setKeyboardEffectEnabled(checked);
    updateUserPreferences({ showKeyboardEffect: checked });
  }

  function handleToggleTypingSound(checked: boolean) {
    setTypingSoundEnabled(checked);
    updateUserPreferences({ typingSoundEnabled: checked });
  }

  async function onSave(nextStatus?: UiStatus) {
    const appliedStatus = nextStatus ?? pageDetails.status;
    setSaving(true);
    try {
      const updatePayload: Parameters<typeof updatePaper>[1] = {
        title,
        slug,
        body,
        thumbnailUrl: pageDetails.thumbnailUrl || null,
        status: toApiStatus(appliedStatus),
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
    } catch (error) {
      throw error;
    } finally {
      setSaving(false);
    }
  }

  function resolvePublicPaperUrl(nextSlug?: string): string | null {
    if (!user?.username) {
      return null;
    }
    return `/${user.username}/${nextSlug || slug}`;
  }

  async function handleSaveAction(nextStatus?: UiStatus) {
    if (isAssetUploading) {
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

    try {
      const updated = await onSave(nextStatus);
      const resolvedStatus = toUiStatus(updated.status);
      if (resolvedStatus === "public") {
        const publicUrl = resolvePublicPaperUrl(updated.slug);
        if (publicUrl) {
          const visitPublishedPage = () => {
            window.open(publicUrl, "_blank", "noopener,noreferrer");
          };
          toast.success("Published", {
            action: {
              label: "Visit",
              onClick: visitPublishedPage,
            },
          });
        } else {
          toast.success("Published");
        }
        return;
      }
      toast.success("Paper saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save page.");
    }
  }

  async function onThumbnailUpload(file: File) {
    setUploadingThumb(true);
    let localPreview: string | null = null;
    const uploadPromise = (async () => {
      if (!isImageFile(file)) throw new Error('Only image files are allowed.');
      const compressed = await compressImage({
        file,
        maxWidth: MAX_THUMBNAIL_WIDTH,
        maxHeight: MAX_THUMBNAIL_HEIGHT,
        crop: false,
      });
      const uploadableFile = compressed instanceof File ? compressed : file;
      localPreview = URL.createObjectURL(uploadableFile);
      setTempUploadingThumbnail(localPreview);
      return uploadThumbnail(paperId, uploadableFile);
    })();

    toast.promise(uploadPromise, {
      loading: "Uploading thumbnail...",
      success: "Thumbnail uploaded.",
      error: (error) => (error instanceof Error ? error.message : "Thumbnail upload failed."),
    });

    try {
      const uploaded = await uploadPromise;
      setPaperDoc((prev) => ({ ...prev, thumbnailUrl: uploaded.url }));
    } catch {
      // toast.promise handles failure UI.
    } finally {
      if (localPreview) {
        URL.revokeObjectURL(localPreview);
      }
      setTempUploadingThumbnail(null);
      setUploadingThumb(false);
    }
  }

  async function onEditorImageUpload(file: File): Promise<{ success: boolean; url?: string; message?: string }> {
    const imageCount = countImagesInContent(body);
    if (imageCount >= MAX_IMAGES_PER_PAPER) {
      return {
        success: false,
        message: `Paper image limit reached (${MAX_IMAGES_PER_PAPER}). Remove some images before uploading a new one.`,
      };
    }

    setUploadingEmbeddedCount((prev) => prev + 1);
    const uploadPromise = (async () => {
      if (!isImageFile(file)) throw new Error('Only image files are allowed.');
      const compressed = await compressImage({
        file,
        maxWidth: MAX_EMBEDDED_WIDTH,
        maxHeight: MAX_EMBEDDED_HEIGHT,
        crop: false,
      });
      const uploadableFile = compressed instanceof File ? compressed : file;
      return uploadEmbeddedImage(paperId, uploadableFile);
    })();

    toast.promise(uploadPromise, {
      loading: "Uploading embedded image...",
      success: "Embedded image uploaded.",
      error: (error) => (error instanceof Error ? error.message : "Embedded image upload failed."),
    });

    try {
      const uploaded = await uploadPromise;
      return { success: true, url: uploaded.url };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "Upload failed." };
    } finally {
      setUploadingEmbeddedCount((prev) => Math.max(0, prev - 1));
    }
  }

  const hasThumbPreview = Boolean(tempUploadingThumbnail || pageDetails.thumbnailUrl);
  const slugValue = slug.trim();
  const isSlugValid = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slugValue);
  const isSlugDirty = slugValue !== savedPaperDoc.slug;
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

  const handleSaveWithStatus = (nextStatus: UiStatus) => {
    setPaperDoc((prev) => ({ ...prev, status: toApiStatus(nextStatus) }));
    setStatusPopoverOpen(false);
  };

  const handleCopyPageId = async () => {
    const ok = await copyToClipboard(paperId);
    if (ok) {
      toast.info("Page ID copied.");
    } else {
      toast.error("Unable to copy Page ID.");
    }
  };

  const handleCheckSlug = async () => {
    if (isAssetUploading) {
      return;
    }
    if (!slugValue) {
      toast.error("Slug cannot be empty.");
      return;
    }
    if (!isSlugValid) {
      toast.error("Use only lowercase letters, numbers, and hyphens.");
      return;
    }
    if (!isSlugDirty) {
      toast.info("Slug is already in use for this page.");
      return;
    }
    setSlugChecking(true);
    try {
      const available = await checkPaperSlugAvailable(slugValue, paperId);
      if (!available) {
        toast.error("Slug is already taken.");
        return;
      }
      await handleSaveAction();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to check slug.");
    } finally {
      setSlugChecking(false);
    }
  };

  const handleShare = async () => {
    const baseUrl = resolveIntegrationBaseUrl(integrationBaseUrl);
    if (!baseUrl) {
      toast.error("PUBLIC_SITE_URL/PRODUCTION_BASE_URL is not configured.");
      return;
    }
    if (!slugValue) {
      toast.error("Save a slug before sharing.");
      return;
    }
    if (!user?.username) {
      toast.error("User handle is missing. Reload the page and try again.");
      return;
    }
    setShareLoading(true);
    const ok = await copyToClipboard(`${baseUrl}/${user.username}/${slugValue}`);
    if (ok) {
      toast.info("Public URL copied.");
    } else {
      toast.error("Unable to copy public URL.");
    }
    setShareLoading(false);
  };

  const handleExport = () => {
    if (!body) {
      toast.info("Nothing to export yet.");
      return;
    }
    setExportLoading(true);
    downloadMarkdownFile(body, slugValue || "page");
    setExportLoading(false);
  };

  const handleOpenMetadataDialog = () => {
    if (!metadata) {
      return;
    }
    setMetadataDraft(structuredClone(metadata));
    setMetadataEditMode(false);
    setMetadataDialogOpen(true);
  };

  const generateMetadata = async (showSuccessToast: boolean) => {
    setMetadataGenerating(true);
    try {
      const generated = await generatePaperMetadata(paperId, {
        title,
        slug,
        body,
        status: toApiStatus(pageDetails.status),
        thumbnailUrl: pageDetails.thumbnailUrl || null,
      });
      setPaperDoc((prev) => ({ ...prev, metadata: generated }));
      setMetadataDraft(structuredClone(generated));
      if (showSuccessToast) {
        toast.success("Metadata generated");
      }
    } catch (error) {
      if (showSuccessToast) {
        toast.error(error instanceof Error ? error.message : "Failed to generate metadata.");
      } else {
        console.error(error);
      }
    } finally {
      setMetadataGenerating(false);
    }
  };

  const handleGenerateMetadataFromSheet = async () => {
    await generateMetadata(true);
  };

  const handleGenerateMetadataFromDialog = async () => {
    await generateMetadata(false);
  };

  const handleMetadataValueChange = (
    key: keyof PaperMetadata,
    type: "text" | "number" | "boolean" | "list",
    value: string,
  ) => {
    setMetadataDraft((prev) => {
      if (!prev) {
        return prev;
      }

      const next = { ...prev };
      if (type === "number") {
        const parsed = Number(value);
        (next as any)[key] = Number.isFinite(parsed) ? parsed : 0;
      } else if (type === "boolean") {
        (next as any)[key] = value.toLowerCase() === "true";
      } else if (type === "list") {
        (next as any)[key] = value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
      } else {
        (next as any)[key] = value;
      }
      return next;
    });
  };

  const handleClearMetadataImage = (field: keyof PaperMetadata) => {
    setMetadataDraft((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        [field]: "",
      };
    });
  };

  const handleMetadataImageUpload = async (field: keyof PaperMetadata, file: File) => {
    if (!metadataDraft || !metadataEditMode) {
      return;
    }

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
      setMetadataDraft((prev) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          [field]: uploaded.url,
        };
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

  const handleSaveMetadataDraftLocally = () => {
    if (!metadataDraft) {
      return;
    }
    setPaperDoc((prev) => ({ ...prev, metadata: structuredClone(metadataDraft) }));
    setMetadataEditMode(false);
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await deletePaper(paperId);
      window.location.href = "/dashboard";
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete page.");
      setDeleteLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col max-w-[700px] mx-auto px-[15px] pb-8 pt-14 relative">
      <ScrollToTop />
      <div
        className="fixed top-0 left-0 w-full z-[10] md:pb-8 md:bg-[unset] bg-background/20 md:backdrop-blur-[0px] backdrop-blur-[30px]"
        data-editor-topbar
        ref={topBarRef}
        onPointerDownCapture={() => setIsTopBarPinned(true)}
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
                        {pageDetails.status == "public" ? (
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
                          disabled={saving}
                        >
                          <CopyIcon />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Custom URL</Label>
                      <form onSubmit={(e) => {
                        e.preventDefault()
                        handleCheckSlug()
                      }} className="flex gap-2 items-center">
                        <Input
                          className="flex-1"
                          spellCheck={false}
                          value={slug}
                          onChange={(event) => setPaperDoc((prev) => ({ ...prev, slug: event.target.value }))}
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          type="submit"
                          disabled={!slugValue || !isSlugValid || !isSlugDirty || slugChecking || isAssetUploading}
                          loading={slugChecking}
                        >
                          Check
                        </Button>
                      </form>
                    </div>


                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="secondary"
                        className="flex-1"
                        onClick={handleShare}
                        disabled={shareLoading}
                        loading={shareLoading}
                      >
                        <ForwardIcon /> Share
                      </Button>
                      <Button
                        variant="secondary"
                        className="flex-1"
                        onClick={handleExport}
                        disabled={exportLoading}
                        loading={exportLoading}
                      >
                        <DownloadIcon /> Export
                      </Button>
                    </div>


                    <div className="space-y-2">
                      <Label>Metadata</Label>
                      <div className="flex items-center justify-between gap-2">
                        <p className="bg-card px-2 py-1 rounded-[4px] border text-[12px]">{metadata ? "Generated" : "Empty"}</p>
                        {metadata ? (
                          <Button type="button" variant="secondary" onClick={handleOpenMetadataDialog}>
                            Details
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={handleGenerateMetadataFromSheet}
                            loading={metadataGenerating}
                          >
                            Generate
                          </Button>
                        )}
                      </div>
                    </div>



                    <div className="relative mt-5">
                      <IntegrationsSection hideText />
                      <div className="absolute bottom-[-2px] left-0 right-0 h-full bg-gradient-to-t from-background to-transparent from-[10%] z-2" />


                      <Button
                        className="w-full absolute z-3 bottom-2"
                        onClick={() => setDistributionDialogOpen(true)}
                      >
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
                                <img
                                  src={pageDetails.thumbnailUrl}
                                  alt={title || "Thumbnail"}
                                  className="w-full h-[200px] rounded-md border object-cover"
                                />
                              )}
                              <DialogFooter>
                                <DialogClose asChild>
                                  <Button variant="secondary" >
                                    Cancel
                                  </Button>
                                </DialogClose>
                                <Button
                                  className="w-[100px]"
                                  variant="destructive"
                                  onClick={handleDelete}
                                  disabled={deleteLoading}
                                  loading={deleteLoading}
                                >
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
                {hasSheetChanges ? (
                  <SheetFooter className="p-2 z-2 absolute left-0 bottom-0 w-full border-t bg-background">
                    <div className="flex justify-end">
                      <Button
                        disabled={isAssetUploading}
                        loading={saving}
                        onClick={() => { void handleSaveAction(); }}
                      >
                        <SaveIcon className="mr-1" />
                        Save
                      </Button>
                    </div>
                  </SheetFooter>
                ) : null}
              </SheetContent>
            </Sheet>

            {pageDetails.status === "public" ? (
              user?.username ? (
                <a href={`/${user.username}/${pageDetails.lastSavedSlug || slug}`} target="_blank">
                  <Button variant="secondary">
                    <ArrowUpRightFromSquare /> Open
                  </Button>
                </a>
              ) : (
                <Button variant="secondary" disabled>
                  <ArrowUpRightFromSquare /> Open
                </Button>
              )
            ) : null}

            {pageDetails.status === "draft" &&
              <Popover open={statusPopoverOpen} onOpenChange={setStatusPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    disabled={saving || isAssetUploading}
                  >
                    <LockIcon />
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
                      variant="ghost"
                      onClick={() => handleSaveWithStatus("public")}>
                      <RssIcon className="mr-1" /> Public
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            }

            <Button
              className={`${pageDetails.status === "public" ? "w-[100px]" : "w-[80px]"} transition-all duration-300`}
              disabled={isAssetUploading}
              loading={saving}
              onClick={() => { void handleSaveAction(); }}
            >
              {pageDetails.status === "public" ? <RssIcon className="mr-1" /> : <SaveIcon className="mr-1" />}
              {pageDetails.status === "public" ? "Publish" : "Save"}
            </Button>
          </div>
        </div>
      </div>

      <div
        className={`rounded-lg overflow-hidden flex items-center justify-center relative group shrink-0 cursor-pointer ${hasThumbPreview ? "aspect-[16/9]" : "h-[300px]"
          }`}
        onClick={() => thumbnailInputRef.current?.click()}
      >
        {tempUploadingThumbnail ? (
          <img
            src={tempUploadingThumbnail}
            alt="Uploading thumbnail"
            className="w-full h-full object-contain animate-pulse"
          />
        ) : pageDetails.thumbnailUrl ? (
          <div>
            <img src={pageDetails.thumbnailUrl} alt="Thumbnail" className="w-full h-full object-contain" />
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
                  setPaperDoc((prev) => ({ ...prev, thumbnailUrl: "" }));
                }}
              >
                <XIcon size={16} />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 h-full w-full relative overflow-hidden text-[black] group select-none cursor-pointer">
            <img src={cloudsimageUrl} alt="" className="absolute h-full w-full object-cover z-[-1] group-hover:dark:opacity-[0.8] group-hover:opacity-[0.9] transition-all duration-300 opacity-[0.6] dark:opacity-[1]" />
            <p />
            <ImagePlusIcon size={34} className="opacity-[0.5]" />
            <p className="text-[14px] font-[500] opacity-[0.5]">Add Thumbnail</p>
          </div>
        )}

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
      </div>

      <div className="mt-6 flex flex-col gap-2 flex-1">
        <Textarea
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
          className="bg-transparent border-none focus:ring-0 outline-none text-[40px] md:text-[40px] font-[400] placeholder:opacity-20 resize-none border-none outline-none focus-visible:ring-0 focus:ring-0"
        />

        {!isMobile && keyboardEffectEnabled &&
          <OnscreenKeyboard className="w-full fixed top-[50%] left-[50%] translate-y-[-50%] translate-x-[-50%] z-[2]" />
        }

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
          />
        </div>


      </div>

      <Dialog
        open={metadataDialogOpen}
        onOpenChange={(open) => {
          setMetadataDialogOpen(open);
          if (!open) {
            setMetadataEditMode(false);
            setMetadataGenerateConfirmOpen(false);
          }
        }}
      >
        <DialogContent className="md:max-w-[700px] h-[70vh] md:h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Paper metadata</DialogTitle>
          </DialogHeader>
          {metadataDraft ? (
            <div className="flex flex-col gap-3 min-h-0 flex-1">
              <ScrollArea className="min-h-0 flex-1 pr-3">
                <div className="space-y-4">
                  {metadataFieldConfig.map((fieldConfig) => {
                    const key = fieldConfig.key;
                    const rawValue = metadataDraft[key];
                    const currentPreview = tempMetadataImageMap[String(key)];
                    const isUploadingImage = Boolean(uploadingMetadataImageMap[String(key)]);

                    if (fieldConfig.type === "image") {
                      const imageValue = String(rawValue || "");
                      const displayImage = currentPreview || imageValue;
                      return (
                        <div key={key}>
                          <Label>{String(key)}</Label>
                          <div className="mt-2 relative rounded-md">
                            {metadataEditMode && Boolean(displayImage) && !isUploadingImage ? (
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
                                className={`mt-2 flex h-[40px] w-full items-center justify-center rounded-md border border-dashed text-sm ${metadataEditMode && !isUploadingImage ? "cursor-pointer hover:bg-muted/40" : "cursor-not-allowed opacity-60"}`}
                                onClick={() => {
                                  if (!metadataEditMode || isUploadingImage) return;
                                  const input = document.getElementById(`metadata-upload-${String(key)}`) as HTMLInputElement | null;
                                  input?.click();
                                }}
                                onKeyDown={(event) => {
                                  if (event.key !== "Enter" && event.key !== " ") return;
                                  event.preventDefault();
                                  if (!metadataEditMode || isUploadingImage) return;
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
                              disabled={!metadataEditMode || isUploadingImage}
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
                            className="mt-2 min-h-[100px] resize-y"
                            value={valueForInput}
                            disabled={!metadataEditMode}
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
                            className="mt-2"
                            value={valueForInput}
                            disabled={!metadataEditMode}
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
                </div>
              </ScrollArea>
              <DialogFooter >
                <div className="flex justify-between w-full">

                  {!metadataEditMode && <Dialog open={metadataGenerateConfirmOpen} onOpenChange={setMetadataGenerateConfirmOpen}>
                    <DialogTrigger asChild>
                      <Button type="button" disabled={metadataGenerating}>
                        Generate
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Regenerate metadata?</DialogTitle>
                        <DialogDescription>This will reset the current metadata.</DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button type="button" variant="secondary" disabled={metadataGenerating}>
                            Cancel
                          </Button>
                        </DialogClose>
                        <Button
                          type="button"
                          loading={metadataGenerating}
                          onClick={async () => {
                            await handleGenerateMetadataFromDialog();
                            setMetadataGenerateConfirmOpen(false);
                          }}
                        >
                          Confirm
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>}

                  <div></div>

                  <div className="flex gap-2">
                    <Button type="button" variant="secondary" onClick={() => setMetadataEditMode((prev) => !prev)}>
                      {metadataEditMode ? "Cancel" : "Edit"}
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSaveMetadataDraftLocally}
                      disabled={!metadataEditMode}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              </DialogFooter>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No metadata available.</p>
          )}
        </DialogContent>
      </Dialog>

      <DistributionDialog
        open={distributionDialogOpen}
        onOpenChange={setDistributionDialogOpen}
        user={user}
        paperId={paperId}
        title={title}
        slug={slug}
        body={body}
        status={pageDetails.status}
        integrationBaseUrl={integrationBaseUrl}
        thumbnailUrl={paperDoc.thumbnailUrl || null}
        metadata={metadata}
      />

    </div>
  );
}
