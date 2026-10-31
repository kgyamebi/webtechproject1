import "server-only";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/server/db/client";
import {
  MAX_AVATAR_BYTES,
  avatarStoragePath,
  isSafeAvatarPath,
  isSafeUploadPath,
  sniffImageMime,
  sniffUpload,
  uploadStoragePath,
  type AvatarMime,
} from "@/server/media/images";

const storageRoot = path.join(process.cwd(), "storage");

export async function saveAvatar(userId: string, bytes: Uint8Array): Promise<string> {
  if (bytes.byteLength === 0) {
    throw new Error("Choose an image to upload.");
  }

  if (bytes.byteLength > MAX_AVATAR_BYTES) {
    throw new Error("Use an image smaller than 2 MB.");
  }

  const mime = sniffImageMime(bytes);
  if (!mime) {
    throw new Error("Use a JPEG, PNG, or WebP image.");
  }

  const relativePath = avatarStoragePath(userId, crypto.randomUUID(), mime);
  const absolutePath = absoluteStoragePath(relativePath);
  if (!absolutePath) {
    throw new Error("The image could not be stored.");
  }

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, bytes);

  const previous = await prisma.profile.findUnique({
    where: { userId },
    select: { avatarPath: true },
  });

  await prisma.profile.update({
    where: { userId },
    data: { avatarPath: relativePath },
  });

  if (previous?.avatarPath && previous.avatarPath !== relativePath) {
    await deleteStoredFile(previous.avatarPath);
  }

  return relativePath;
}

export async function readAvatar(userId: string): Promise<{ bytes: Buffer; mime: AvatarMime } | null> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { avatarPath: true },
  });

  if (!profile?.avatarPath || !isSafeAvatarPath(userId, profile.avatarPath)) {
    return null;
  }

  const absolutePath = absoluteStoragePath(profile.avatarPath);
  if (!absolutePath) {
    return null;
  }

  try {
    const bytes = await readFile(absolutePath);
    const mime = sniffImageMime(bytes);
    if (!mime) {
      return null;
    }
    return { bytes, mime };
  } catch {
    return null;
  }
}

export async function saveUpload(userId: string, bytes: Uint8Array, imagesOnly = false): Promise<string> {
  if (bytes.byteLength === 0) {
    throw new Error("Choose a file to upload.");
  }

  if (bytes.byteLength > MAX_AVATAR_BYTES) {
    throw new Error("Use a file smaller than 2 MB.");
  }

  const extension = sniffUpload(bytes);
  const image = extension === "jpg" || extension === "png" || extension === "webp";
  if (!extension || (imagesOnly && !image)) {
    throw new Error(imagesOnly ? "Use a JPEG, PNG, or WebP image." : "Use an image, a PDF, or a short voice note.");
  }

  const relativePath = uploadStoragePath(userId, crypto.randomUUID(), extension);
  const absolutePath = absoluteStoragePath(relativePath);
  if (!absolutePath) {
    throw new Error("The file could not be stored.");
  }

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, bytes);
  return relativePath;
}

export async function readUpload(relativePath: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  if (!isSafeUploadPath(relativePath)) {
    return null;
  }

  const absolutePath = absoluteStoragePath(relativePath);
  if (!absolutePath) {
    return null;
  }

  try {
    const bytes = await readFile(absolutePath);
    const extension = sniffUpload(bytes);
    if (!extension) {
      return null;
    }
    const contentType =
      extension === "pdf"
        ? "application/pdf"
        : extension === "png"
          ? "image/png"
          : extension === "webp"
            ? "image/webp"
            : extension === "webm"
              ? "audio/webm"
              : extension === "ogg"
                ? "audio/ogg"
                : "image/jpeg";
    return { bytes, contentType };
  } catch {
    return null;
  }
}

function absoluteStoragePath(relativePath: string): string | null {
  const resolved = path.resolve(storageRoot, relativePath);
  const prefix = storageRoot.endsWith(path.sep) ? storageRoot : `${storageRoot}${path.sep}`;
  if (!resolved.startsWith(prefix)) {
    return null;
  }
  return resolved;
}

async function deleteStoredFile(relativePath: string) {
  const absolutePath = absoluteStoragePath(relativePath);
  if (!absolutePath) {
    return;
  }

  await rm(absolutePath, { force: true });
}
