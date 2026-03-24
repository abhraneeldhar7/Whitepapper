import { useMemo, useRef, useState } from "react";
import { ImagePlus, Save } from "lucide-react";
import { toast } from "sonner";

import { uploadProfileImage } from "@/lib/api/uploads";
import { updateCurrentUser } from "@/lib/api/users";
import { MAX_PROFILE_IMAGE_HEIGHT, MAX_PROFILE_IMAGE_WIDTH } from "@/lib/constants";
import type { UserDoc } from "@/lib/types";
import { compressImage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type SettingsPageProps = {
  initialUser: UserDoc;
};

type EditableUserFields = Pick<UserDoc, "displayName" | "username" | "description" | "avatarUrl">;

function editableSnapshot(user: UserDoc): EditableUserFields {
  return {
    displayName: user.displayName ?? "",
    username: user.username,
    description: user.description,
    avatarUrl: user.avatarUrl ?? "",
  };
}

export default function SettingsPage({ initialUser }: SettingsPageProps) {
  const [userDetails, setUserDetails] = useState<UserDoc>(initialUser);
  const [baseline, setBaseline] = useState<EditableUserFields>(editableSnapshot(initialUser));
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const currentEditable = useMemo(() => editableSnapshot(userDetails), [userDetails]);
  const hasChanges = useMemo(() => JSON.stringify(currentEditable) !== JSON.stringify(baseline), [baseline, currentEditable]);

  function updateField<K extends keyof UserDoc>(key: K, value: UserDoc[K]) {
    setUserDetails((prev) => ({ ...prev, [key]: value }));
  }

  async function onPickAvatar(file: File) {
    setUploadingAvatar(true);

    const uploadPromise = (async () => {
      const compressed = await compressImage({
        file,
        maxWidth: MAX_PROFILE_IMAGE_WIDTH,
        maxHeight: MAX_PROFILE_IMAGE_HEIGHT,
        crop: true,
      });
      const compressedBlob =
        compressed instanceof Blob
          ? compressed
          : new Blob([new Uint8Array(compressed as unknown as ArrayBuffer)], { type: "image/jpeg" });
      const uploadableFile =
        compressedBlob instanceof File
          ? compressedBlob
          : new File([compressedBlob], file.name || "profile.jpg", {
              type: "image/jpeg",
              lastModified: Date.now(),
            });

      return uploadProfileImage(uploadableFile);
    })();

    toast.promise(uploadPromise, {
      loading: "Uploading profile picture...",
      success: "Profile picture updated.",
      error: (error) => (error instanceof Error ? error.message : "Failed to upload profile picture."),
    });

    try {
      const { url } = await uploadPromise;
      updateField("avatarUrl", url);
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function onSave() {
    if (!hasChanges) {
      return;
    }

    setSaving(true);
    const savePromise = updateCurrentUser(userDetails);

    toast.promise(savePromise, {
      loading: "Saving settings...",
      success: "Settings saved.",
      error: (error) => (error instanceof Error ? error.message : "Failed to save settings."),
    });

    try {
      const updated = await savePromise;
      setUserDetails(updated);
      setBaseline(editableSnapshot(updated));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[600px] px-[15px] py-10 space-y-10">
      <div className="space-y-2">
        <h1 className="font-[Satoshi] text-[30px] leading-[1em]">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your profile details.</p>
      </div>

      <div className="space-y-4">
        <Label>Profile Picture</Label>
        <div className="flex items-center gap-4">
          <div className="h-[80px] w-[80px] overflow-hidden rounded-[14px] border-[4px] border-card shadow">
            {userDetails.avatarUrl ? (
              <img src={userDetails.avatarUrl} className="h-full w-full object-cover" alt="Profile" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-muted text-lg font-semibold">
                {(userDetails.displayName || userDetails.username || "U").trim().charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Button
              type="button"
              variant="secondary"
              loading={uploadingAvatar}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus /> Upload
            </Button>
            <p className="text-xs text-muted-foreground">Image is cropped and compressed to 1000x1000.</p>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void onPickAvatar(file);
            }
            event.currentTarget.value = "";
          }}
        />
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="displayName">Name</Label>
          <Input
            id="displayName"
            value={userDetails.displayName ?? ""}
            onChange={(event) => updateField("displayName", event.target.value)}
            placeholder="Your name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="username">Handle</Label>
          <Input
            id="username"
            value={userDetails.username}
            onChange={(event) => updateField("username", event.target.value)}
            placeholder="your-handle"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={userDetails.description}
            onChange={(event) => updateField("description", event.target.value)}
            placeholder="Tell people about yourself"
            className="min-h-[120px]"
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="button" onClick={onSave} disabled={!hasChanges || uploadingAvatar} loading={saving}>
          <Save /> Save
        </Button>
      </div>
    </div>
  );
}
