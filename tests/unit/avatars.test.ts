import { describe, expect, it } from "vitest";
import {
  avatarStoragePath,
  isSafeAvatarPath,
  sniffImageMime,
} from "@/server/media/images";

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]);
const webp = Uint8Array.from([
  ..."RIFF".split("").map((character) => character.charCodeAt(0)),
  0, 0, 0, 0,
  ..."WEBP".split("").map((character) => character.charCodeAt(0)),
]);

describe("avatar files", () => {
  it("recognises jpeg, png, and webp signatures", () => {
    expect(sniffImageMime(jpeg)).toBe("image/jpeg");
    expect(sniffImageMime(png)).toBe("image/png");
    expect(sniffImageMime(webp)).toBe("image/webp");
    expect(sniffImageMime(Uint8Array.from([0x3c, 0x73, 0x63]))).toBeNull();
  });

  it("builds a user-scoped path and rejects traversal", () => {
    const path = avatarStoragePath("user_1", "11111111-1111-4111-8111-111111111111", "image/png");
    expect(isSafeAvatarPath("user_1", path)).toBe(true);
    expect(isSafeAvatarPath("user_1", "avatars/user_1/../../.env")).toBe(false);
    expect(isSafeAvatarPath("user_2", path)).toBe(false);
    expect(isSafeAvatarPath("user_1", "/avatars/user_1/file.png")).toBe(false);
  });
});
