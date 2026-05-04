import { toast } from "sonner";
import { compressImage, isImageFile } from "./utils";

type CompressOptions = {
  maxWidth: number;
  maxHeight: number;
  crop?: boolean;
};

type ToastMessages = {
  loading: string;
  success: string;
  error: (error: unknown) => string;
};

export async function uploadImage<T>(
  file: File,
  options: {
    compress: CompressOptions;
    upload: (file: File) => Promise<T>;
    onStart: () => void;
    onFinish: () => void;
    toastMessages: ToastMessages;
    onSuccess?: (result: T) => void;
    onPrepare?: (uploadableFile: File) => void;
  },
): Promise<T | undefined> {
  options.onStart();

  const uploadPromise = (async () => {
    if (!isImageFile(file)) throw new Error("Only image files are allowed.");
    const compressed = await compressImage({ file, ...options.compress });
    const uploadableFile = compressed instanceof File ? compressed : file;
    options.onPrepare?.(uploadableFile);
    return options.upload(uploadableFile);
  })();

  toast.promise(uploadPromise, options.toastMessages);

  try {
    const result = await uploadPromise;
    await options.onSuccess?.(result);
    return result;
  } catch {
    return undefined;
  } finally {
    options.onFinish();
  }
}
