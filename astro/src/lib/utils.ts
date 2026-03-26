import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

type FirestoreDateInput =
  | Date
  | string
  | number
  | { toDate: () => Date }
  | { seconds: number; nanoseconds?: number }
  | null
  | undefined;

function toDate(value: FirestoreDateInput): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === "object") {
    if ("toDate" in value && typeof value.toDate === "function") {
      const parsed = value.toDate();
      return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
    }

    if ("seconds" in value && typeof value.seconds === "number") {
      const parsed = new Date(value.seconds * 1000);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }

  return null;
}

export function formatFirestoreDate(value: FirestoreDateInput, now = new Date()): string {
  const date = toDate(value);
  if (!date) return "";

  const showYear = date.getFullYear() !== now.getFullYear();

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    ...(showYear ? { year: "numeric" } : {}),
  });
}

export async function copyToClipboard(value: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export async function copyToClipboardWithToast(
  value: string,
  successMessage: string = "Copied",
  errorMessage: string = "Unable to copy",
): Promise<boolean> {
  const { toast } = await import("sonner");
  const ok = await copyToClipboard(value);
  if (ok) {
    toast.success(successMessage);
  } else {
    toast.error(errorMessage);
  }
  return ok;
}



export async function compressImage(
  { file,
    maxWidth,
    maxHeight,
    crop = false
  }: {
    file: File | Blob,
    maxWidth?: number,
    maxHeight?: number,
    crop?: boolean
  }
): Promise<File | Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file as Blob);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const { width, height } = img;
        const aspectRatio = width / height;

        let targetWidth = width;
        let targetHeight = height;

        if (maxWidth && maxHeight) {
          if (crop) {
            targetWidth = maxWidth;
            targetHeight = maxHeight;
          } else {
            if (width / height > maxWidth / maxHeight) {
              if (width > maxWidth) {
                targetWidth = maxWidth;
                targetHeight = targetWidth / aspectRatio;
              }
            } else {
              if (height > maxHeight) {
                targetHeight = maxHeight;
                targetWidth = targetHeight * aspectRatio;
              }
            }
          }
        } else if (maxWidth) {
          if (width > maxWidth) {
            targetWidth = maxWidth;
            targetHeight = targetWidth / aspectRatio;
          }
        } else if (maxHeight) {
          if (height > maxHeight) {
            targetHeight = maxHeight;
            targetWidth = targetHeight * aspectRatio;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          if (crop && maxWidth && maxHeight) {
            const sourceAspectRatio = width / height;
            const targetAspectRatio = maxWidth / maxHeight;
            let sourceX = 0, sourceY = 0, sourceWidth = width, sourceHeight = height;

            if (sourceAspectRatio > targetAspectRatio) {
              sourceWidth = height * targetAspectRatio;
              sourceX = (width - sourceWidth) / 2;
            } else {
              sourceHeight = width / targetAspectRatio;
              sourceY = (height - sourceHeight) / 2;
            }
            ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, targetWidth, targetHeight);
          } else {
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
          }

          canvas.toBlob((blob) => {
            if (blob) {
              const fileName = (file as File).name || 'optimized_image.jpg';
              const optimizedFile = new File([blob], fileName, { type: 'image/jpeg', lastModified: Date.now() });
              resolve(optimizedFile);
            } else {
              reject(new Error("Canvas to Blob failed"));
            }
          }, 'image/jpeg', 0.85);
        }
      };
    };
    reader.onerror = reject;
  });
}
