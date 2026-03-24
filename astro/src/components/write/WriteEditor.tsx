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
  updatePaper,
} from "@/lib/api/papers";
import { uploadEmbeddedImage, uploadThumbnail } from "@/lib/api/uploads";
import { updateCurrentUser } from "@/lib/api/users";
import {
  MAX_EMBEDDED_HEIGHT,
  MAX_EMBEDDED_WIDTH,
  MAX_THUMBNAIL_HEIGHT,
  MAX_THUMBNAIL_WIDTH,
} from "@/lib/constants";
import type { PaperDoc, UserDoc } from "@/lib/types";
import { compressImage, copyToClipboard } from "@/lib/utils";
import click1Sound from "@/assets/sounds/click1.mp3";
import click2Sound from "@/assets/sounds/click2.mp3";
import click3Sound from "@/assets/sounds/click3.mp3";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import OnscreenKeyboard from "../keyboard";
import ScrollToTop from "../scrollToTop";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";

type WriteEditorProps = {
  initialPaper: PaperDoc;
  initialUser?: UserDoc | null;
};

type UiStatus = "draft" | "public";
const typingSoundSources = [click1Sound, click2Sound, click3Sound];

function toUiStatus(value: PaperDoc["status"]): UiStatus {
  return value === "published" ? "public" : "draft";
}

function toApiStatus(value: UiStatus): PaperDoc["status"] {
  return value === "public" ? "published" : "draft";
}

export default function WriteEditor({ initialPaper, initialUser }: WriteEditorProps) {
  const [user, setUser] = useState<UserDoc | null>(initialUser ?? null);
  const paperId = initialPaper.paperId;
  const [title, setTitle] = useState(initialPaper.title);
  const [slug, setSlug] = useState(initialPaper.slug);
  const [body, setBody] = useState(initialPaper.body || "");
  const [pageDetails, setPageDetails] = useState(() => ({
    thumbnailUrl: initialPaper.thumbnailUrl || "",
    status: toUiStatus(initialPaper.status),
    lastSavedSlug: initialPaper.slug,
  }));
  const [saving, setSaving] = useState(false);
  const [slugChecking, setSlugChecking] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [uploadingEmbeddedCount, setUploadingEmbeddedCount] = useState(0);
  const [tempUploadingThumbnail, setTempUploadingThumbnail] = useState<string | null>(null);
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isTopBarHovered, setIsTopBarHovered] = useState(false);
  const [isTopBarPinned, setIsTopBarPinned] = useState(false);
  const [keyboardEffectEnabled, setKeyboardEffectEnabled] = useState(Boolean(user?.preferences?.showKeyboardEffect));
  const [typingSoundEnabled, setTypingSoundEnabled] = useState(Boolean(user?.preferences?.typingSoundEnabled));
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const topBarRef = useRef<HTMLDivElement>(null);


  const editorRef = useRef<TextEditorRef>(null);

  const thumbnailInputRef = useRef<HTMLInputElement>(null);

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
    };
  }, [tempUploadingThumbnail]);

  const isAssetUploading = uploadingThumb || uploadingEmbeddedCount > 0;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (isAssetUploading) {
          return;
        }
        const savePromise = onSave();
        toast.promise(savePromise, {
          loading: pageDetails.status === "public" ? "Publishing..." : "Saving draft...",
          success: pageDetails.status === "public" ? "Published successfully." : "Draft saved.",
          error: (error) => (error instanceof Error ? error.message : "Failed to save page."),
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pageDetails.status, title, slug, body, pageDetails.thumbnailUrl, isAssetUploading]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)");
    const handleMediaChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    setIsMobile(media.matches);
    media.addEventListener("change", handleMediaChange);
    return () => media.removeEventListener("change", handleMediaChange);
  }, []);

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

  useEffect(() => {
    if (!typingSoundEnabled) {
      return;
    }

    const handleTypingSound = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const isTypingKey =
        event.key.length === 1 ||
        event.key === "Enter" ||
        event.key === "Backspace" ||
        event.key === "Tab" ||
        event.key === " ";
      if (!isTypingKey) {
        return;
      }

      const randomSource = typingSoundSources[Math.floor(Math.random() * typingSoundSources.length)];
      const audio = new Audio(randomSource);
      audio.volume = 0.35;
      void audio.play().catch(() => {
        // Ignore autoplay errors; sound will work after first user interaction.
      });
    };

    window.addEventListener("keydown", handleTypingSound);
    return () => window.removeEventListener("keydown", handleTypingSound);
  }, [typingSoundEnabled]);

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
      ...user,
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
      const updated = await updatePaper(paperId, {
        title,
        slug,
        body,
        thumbnailUrl: pageDetails.thumbnailUrl || null,
        status: toApiStatus(appliedStatus),
      });
      setTitle(updated.title);
      setSlug(updated.slug);
      setBody(updated.body || "");
      setPageDetails((prev) => ({
        ...prev,
        thumbnailUrl: updated.thumbnailUrl || "",
        status: toUiStatus(updated.status),
        lastSavedSlug: updated.slug,
      }));
      return updated;
    } catch (error) {
      throw error;
    } finally {
      setSaving(false);
    }
  }

  async function onThumbnailUpload(file: File) {
    setUploadingThumb(true);
    let localPreview: string | null = null;
    const uploadPromise = (async () => {
      const compressed = await compressImage({
        file,
        maxWidth: MAX_THUMBNAIL_WIDTH,
        maxHeight: MAX_THUMBNAIL_HEIGHT,
        crop: false,
      });
      const compressedBlob =
        compressed instanceof Blob
          ? compressed
          : new Blob([new Uint8Array(compressed as unknown as ArrayBuffer)], { type: "image/jpeg" });
      const uploadableFile =
        compressedBlob instanceof File
          ? compressedBlob
          : new File([compressedBlob], file.name || "thumbnail.jpg", {
            type: "image/jpeg",
            lastModified: Date.now(),
          });

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
      setPageDetails((prev) => ({ ...prev, thumbnailUrl: uploaded.url }));
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
    setUploadingEmbeddedCount((prev) => prev + 1);
    const uploadPromise = (async () => {
      const compressed = await compressImage({
        file,
        maxWidth: MAX_EMBEDDED_WIDTH,
        maxHeight: MAX_EMBEDDED_HEIGHT,
        crop: false,
      });
      const compressedBlob =
        compressed instanceof Blob
          ? compressed
          : new Blob([new Uint8Array(compressed as unknown as ArrayBuffer)], { type: "image/jpeg" });
      const uploadableFile =
        compressedBlob instanceof File
          ? compressedBlob
          : new File([compressedBlob], file.name || "embedded.jpg", {
            type: "image/jpeg",
            lastModified: Date.now(),
          });
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
  const isSlugDirty = slugValue !== pageDetails.lastSavedSlug;

  const handleSaveWithStatus = (nextStatus: UiStatus) => {
    if (isAssetUploading) {
      return;
    }
    const savePromise = onSave(nextStatus);
    toast.promise(savePromise, {
      loading: nextStatus === "public" ? "Publishing..." : "Saving draft...",
      success: nextStatus === "public" ? "Published successfully." : "Draft saved.",
      error: (error) => (error instanceof Error ? error.message : "Failed to save page."),
    });
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
      const savePromise = onSave();
      toast.promise(savePromise, {
        loading: pageDetails.status === "public" ? "Publishing..." : "Saving draft...",
        success: pageDetails.status === "public" ? "Published successfully." : "Draft saved.",
        error: (error) => (error instanceof Error ? error.message : "Failed to save page."),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to check slug.");
    } finally {
      setSlugChecking(false);
    }
  };

  const handleShare = async () => {
    const baseUrl = import.meta.env.PUBLIC_SITE_URL;
    if (!baseUrl) {
      toast.error("PUBLIC_SITE_URL is not configured.");
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
    const fileName = `${slugValue || "page"}.md`;
    const blob = new Blob([body], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setExportLoading(false);
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
                className="p-0 pb-10"
                data-editor-overlay
              >
                <SheetHeader className="p-4 pb-2">
                  <SheetTitle>Page settings</SheetTitle>
                </SheetHeader>
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
                            loading={saving}
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
                          <a href={`/${user.username}/${slug}`} className="flex-1 flex" target="_blank">
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
                        onChange={(event) => setSlug(event.target.value)}
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
                    <Label>Preferences</Label>
                    <div className="p-3 space-y-6">
                      <div className="flex justify-between">
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
                      <div className="flex justify-between items-center">
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
                                <Button variant="secondary" type="button">
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

            <Button
              className="w-[80px]"
              disabled={isAssetUploading}
              loading={saving}
              onClick={() => {
                if (isAssetUploading) {
                  return;
                }
                const savePromise = onSave();
                toast.promise(savePromise, {
                  loading: pageDetails.status === "public" ? "Publishing..." : "Saving draft...",
                  success: pageDetails.status === "public" ? "Published successfully." : "Draft saved.",
                  error: (error) => (error instanceof Error ? error.message : "Failed to save page."),
                });
              }}
            >
              <SaveIcon className="mr-1" /> Save
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
                type="button"
                size="lg"
                variant="destructive"
                className="z-2 md:opacity-0 group-hover:opacity-100"
                onClick={(event) => {
                  event.stopPropagation();
                  setPageDetails((prev) => ({ ...prev, thumbnailUrl: "" }));
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
        <input
          autoFocus={body.length === 0}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
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
          className="bg-transparent border-none focus:ring-0 outline-none text-[40px] font-[400] placeholder:opacity-20"
        />

        {!isMobile && keyboardEffectEnabled &&
          <OnscreenKeyboard className="w-full fixed top-[50%] left-[50%] translate-y-[-50%] translate-x-[-50%] z-[2]" />
        }

        <div ref={editorContainerRef}>
          <TextEditor ref={editorRef} initialContent={body} onChange={setBody} onImageUpload={onEditorImageUpload} />
        </div>


      </div>

    </div>
  );
}
