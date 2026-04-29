import { useMemo, useRef, useState } from "react";
import { ImagePlus, Save, XIcon } from "lucide-react";
import { toast } from "sonner";

import { uploadProfileImage } from "@/lib/api/uploads";
import { updateCurrentUser } from "@/lib/api/users";
import { MAX_PROFILE_IMAGE_HEIGHT, MAX_PROFILE_IMAGE_WIDTH } from "@/lib/constants";
import type { UserDoc } from "@/lib/entities";
import { Button } from "@/components/ui/button";
import { uploadImage } from "@/lib/useImageUpload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DevtoCard } from "../integrations/devto";
import { HashnodeCard } from "../integrations/hashnode";

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
    await uploadImage<{ url: string }>(file, {
      compress: { maxWidth: MAX_PROFILE_IMAGE_WIDTH, maxHeight: MAX_PROFILE_IMAGE_HEIGHT, crop: true },
      upload: uploadProfileImage,
      onStart: () => setUploadingAvatar(true),
      onFinish: () => setUploadingAvatar(false),
      toastMessages: {
        loading: "Uploading profile picture...",
        success: "Profile picture updated.",
        error: (error) => (error instanceof Error ? error.message : "Failed to upload profile picture."),
      },
      onSuccess: ({ url }) => updateField("avatarUrl", url),
    });
  }

  async function onSave() {
    if (!hasChanges) {
      return;
    }

    setSaving(true);
    const savePromise = updateCurrentUser({
      displayName: currentEditable.displayName,
      username: currentEditable.username,
      description: currentEditable.description,
      avatarUrl: currentEditable.avatarUrl,
    });

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
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-[15px] pt-15 pb-25">
      <div>
        <p className="text-sm text-muted-foreground">
          <a href={`/${userDetails.username}`} className="transition-all duration-300 hover:text-foreground">User</a> / Settings
        </p>
      </div>

      <div className="flex gap-20 md:flex-row flex-col ">

        <div className="md:flex-1 md:w-[350px]">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="h-[80px] w-[80px] overflow-hidden rounded-[14px] border-[4px] border-card shadow" onClick={() => fileInputRef.current?.click()}>
                {userDetails.avatarUrl ? (
                  <img src={userDetails.avatarUrl} className="h-full w-full object-cover" alt="Profile" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted text-lg font-semibold">
                    {(userDetails.displayName || userDetails.username || "U").trim().charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <div className={`overflow-hidden flex gap-2 transition-all duration-300 ${hasChanges ? "opacity-100 h-full" : "opacity-0 h-0"}`} >
                <Button variant="secondary" onClick={() => { setUserDetails(initialUser) }}><XIcon /></Button>
                <Button  onClick={onSave} disabled={!hasChanges || uploadingAvatar} loading={saving}>
                  <Save /> Save
                </Button>
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
              <Label htmlFor="description">About</Label>
              <Textarea
                id="about"
                value={userDetails.description}
                onChange={(event) => updateField("description", event.target.value)}
                placeholder="Tell people about yourself"
                className="min-h-[120px] max-h-[160px]"
              />
            </div>
          </div>
        </div>


        <div className="md:flex-1">
          <h2>Integrations</h2>

          <div className="mt-5 flex flex-col w-full gap-4">
            <HashnodeCard
              user={userDetails}
              onUserUpdated={(updatedUser) => {
                setUserDetails((current) => ({
                  ...current,
                  preferences: updatedUser.preferences,
                }));
              }}
            />
            <DevtoCard
              user={userDetails}
              onUserUpdated={(updatedUser) => {
                setUserDetails((current) => ({
                  ...current,
                  preferences: updatedUser.preferences,
                }));
              }}
            />
          </div>
        </div>



      </div>

    </div>
  );
}

