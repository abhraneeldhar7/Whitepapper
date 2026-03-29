import { apiClient, type ApiClient } from "@/lib/api/client";
import { isImageFile } from "@/lib/utils";

function assertImageFile(file: File): void {
  if (!isImageFile(file)) {
    throw new Error("Only image files are allowed.");
  }
}

function createUploadBody(file: File): FormData {
  assertImageFile(file);
  const formData = new FormData();
  formData.append("file", file);
  return formData;
}

export async function uploadThumbnail(
  paperId: string,
  file: File,
  client: ApiClient = apiClient,
): Promise<{ url: string }> {
  return client.post<{ url: string }>(`/papers/${paperId}/thumbnail`, {
    body: createUploadBody(file),
  });
}

export async function uploadEmbeddedImage(
  paperId: string,
  file: File,
  client: ApiClient = apiClient,
): Promise<{ url: string }> {
  return client.post<{ url: string }>(`/papers/${paperId}/embedded-image`, {
    body: createUploadBody(file),
  });
}

export async function uploadProfileImage(
  file: File,
  client: ApiClient = apiClient,
): Promise<{ url: string }> {
  return client.post<{ url: string }>("/users/me/profile-image", {
    body: createUploadBody(file),
  });
}

export async function uploadProjectLogo(
  projectId: string,
  file: File,
  client: ApiClient = apiClient,
): Promise<{ url: string }> {
  return client.post<{ url: string }>(`/projects/${projectId}/logo`, {
    body: createUploadBody(file),
  });
}

export async function uploadProjectEmbeddedImage(
  projectId: string,
  file: File,
  client: ApiClient = apiClient,
): Promise<{ url: string }> {
  return client.post<{ url: string }>(`/projects/${projectId}/embedded-image`, {
    body: createUploadBody(file),
  });
}
