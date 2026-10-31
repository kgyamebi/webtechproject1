import { expect, test } from "@playwright/test";

test("landing page explains what is ready and what is not", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Learn together");
  await expect(page.getByText("Simulated").first()).toBeVisible();

  const link = page.getByRole("main").getByRole("link", { name: "Create account" });
  await expect(link).toHaveAttribute("href", "/register");
  await link.click();
  // The dev server compiles the destination on the first visit, so this is slower than a warm navigation.
  await expect(page).toHaveURL(/\/register$/, { timeout: 20000 });
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
});
