/**
 * Profile images are checked from their bytes, not from the filename the
 * browser sends. A renamed text file must not be stored as a picture.
 */

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const MIME_EXTENSION = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type AvatarMime = keyof typeof MIME_EXTENSION;

export function sniffImageMime(bytes: Uint8Array): AvatarMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (bytes.length >= 12 && isAscii(bytes, 0, "RIFF") && isAscii(bytes, 8, "WEBP")) {
    return "image/webp";
  }

  return null;
}

export function extensionForMime(mime: AvatarMime): string {
  return MIME_EXTENSION[mime];
}

/**
 * Stored paths are relative, belong to one user, and use a generated filename.
 * This rejects traversal such as `avatars/user/../../.env`.
 */
export function isSafeAvatarPath(userId: string, storedPath: string): boolean {
  if (!userId || userId.includes("/") || userId.includes("\\") || userId.includes("..")) {
    return false;
  }

  if (storedPath.includes("..") || storedPath.includes("\\") || storedPath.startsWith("/")) {
    return false;
  }

  const prefix = `avatars/${userId}/`;
  if (!storedPath.startsWith(prefix)) {
    return false;
  }

  const filename = storedPath.slice(prefix.length);
  return /^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(filename);
}

export function avatarStoragePath(userId: string, fileId: string, mime: AvatarMime): string {
  return `avatars/${userId}/${fileId}.${extensionForMime(mime)}`;
}

export function isSafeUploadPath(storedPath: string): boolean {
  if (storedPath.includes("..") || storedPath.includes("\\") || storedPath.startsWith("/")) {
    return false;
  }

  return /^uploads\/[A-Za-z0-9_-]+\/[0-9a-f-]{36}\.(jpg|png|webp|pdf|webm|ogg)$/i.test(storedPath);
}

export function uploadStoragePath(
  userId: string,
  fileId: string,
  extension: "jpg" | "png" | "webp" | "pdf" | "webm" | "ogg",
): string {
  return `uploads/${userId}/${fileId}.${extension}`;
}

export function sniffUpload(bytes: Uint8Array): "jpg" | "png" | "webp" | "pdf" | "webm" | "ogg" | null {
  const image = sniffImageMime(bytes);
  if (image === "image/jpeg") {
    return "jpg";
  }
  if (image === "image/png") {
    return "png";
  }
  if (image === "image/webp") {
    return "webp";
  }
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return "pdf";
  }
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return "webm";
  }
  if (bytes.length >= 4 && bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
    return "ogg";
  }
  return null;
}

function isAscii(bytes: Uint8Array, offset: number, text: string): boolean {
  for (let index = 0; index < text.length; index += 1) {
    if (bytes[offset + index] !== text.charCodeAt(index)) {
      return false;
    }
  }

  return true;
}
