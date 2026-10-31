/**
 * Only send people back into the workspace. Anything else, including an
 * absolute URL, would be an open redirect.
 */
export function safeWorkspacePath(value: string | null | undefined): string {
  if (!value) {
    return "/workspace";
  }

  if (!value.startsWith("/workspace") || value.startsWith("//") || value.includes("\\")) {
    return "/workspace";
  }

  if (value.includes("..") || value.includes("://")) {
    return "/workspace";
  }

  return value;
}
