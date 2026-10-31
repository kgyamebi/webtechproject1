import { expect, test } from "@playwright/test";

test.describe("signed-in product", () => {
  test.describe.configure({ timeout: 90000 });

  test.beforeEach(async ({ request, viewport }) => {
    test.skip((viewport?.width ?? 0) < 900, "The signed-in tour uses the desktop navigation.");
    const health = await request.get("/api/health");
    test.skip(health.status() !== 200, "PostgreSQL is not running, so signed-in flows cannot be checked.");
  });

  test("an adult student can open the workspace areas", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("ada.mensah@riverside.edu");
    await page.getByLabel("Password").fill("Campus-seed-2026");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Hello, Ada Mensah" })).toBeVisible({ timeout: 20000 });

    const nav = page.getByRole("navigation", { name: "Workspace" });
    await nav.getByRole("link", { name: "Learn", exact: true }).click();
    await expect(page).toHaveURL(/\/workspace\/learn$/, { timeout: 30000 });
    await expect(page.getByRole("heading", { name: "Learn", level: 1 })).toBeVisible();
    await expect(page.getByText("Web Technologies").first()).toBeVisible();
    await page.getByRole("link", { name: "Open course" }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: /Web Technologies/ })).toBeVisible();
    await page.getByRole("link", { name: "Open" }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Build a personal page" })).toBeVisible();
    await page.getByRole("link", { name: "Back to course" }).click();
    await page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "HTML check" }) })
      .getByRole("link", { name: "Open" })
      .click();
    await expect(page.getByRole("heading", { level: 1, name: "HTML check" })).toBeVisible();

    await nav.getByRole("link", { name: "People", exact: true }).click();
    await expect(page.getByRole("heading", { name: "People", level: 1 })).toBeVisible();

    await nav.getByRole("link", { name: "Friends", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Friends", level: 1 })).toBeVisible();
    await expect(page.getByText("Ama Darko").first()).toBeVisible();

    await nav.getByRole("link", { name: "Quiet Connect", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Quiet Connect", level: 1 })).toBeVisible();

    await nav.getByRole("link", { name: "Messages", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Messages", level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Message Ama Darko" })).toBeVisible();

    await nav.getByRole("link", { name: "Feed", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Feed", level: 1 })).toBeVisible();

    await nav.getByRole("link", { name: "LMS", exact: true }).click();
    await expect(page.getByText("does not connect to a live Canvas")).toBeVisible();
  });

  test("an adult can use the academic, social, and account paths", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/login");
    await page.getByLabel("Email").fill("ada.mensah@riverside.edu");
    await page.getByLabel("Password").fill("Campus-seed-2026");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Hello, Ada Mensah" })).toBeVisible({ timeout: 20000 });

    const nav = page.getByRole("navigation", { name: "Workspace" });
    await nav.getByRole("link", { name: "Calendar", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Calendar", level: 1 })).toBeVisible();
    await page.getByRole("link", { name: "Build a personal page" }).click();
    await page.getByLabel("Answer").fill("A page with a heading and a paragraph.");
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByRole("heading", { name: "Submitted" })).toBeVisible({ timeout: 20000 });

    await nav.getByRole("link", { name: "Calendar", exact: true }).click();
    await page.getByRole("link", { name: "HTML check" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "HTML check" })).toBeVisible();
    const start = page.getByRole("button", { name: "Start attempt" });
    if (await start.isVisible()) {
      await start.click();
      await page.getByRole("radio", { name: "p" }).check();
      await page.getByRole("button", { name: "Submit attempt" }).click();
    }
    await expect(page.getByRole("heading", { name: "Your submitted attempt" })).toBeVisible({ timeout: 20000 });

    await nav.getByRole("link", { name: "Feed", exact: true }).click();
    const note = `Study note ${Date.now()}`;
    await page.getByLabel("Post").fill(note);
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText(note)).toBeVisible({ timeout: 20000 });

    await nav.getByRole("link", { name: "Quiet Connect", exact: true }).click();
    await page.getByRole("checkbox", { name: "I want to be introduced to another adult" }).check();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: "Quiet Connect", level: 1 })).toBeVisible();

    await nav.getByRole("link", { name: "Communities", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Web Technologies circle" })).toBeVisible();

    await nav.getByRole("link", { name: "Campus Life", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Campus Life", level: 1 })).toBeVisible();

    await nav.getByRole("link", { name: "Opportunities", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Opportunities", level: 1 })).toBeVisible();

    await nav.getByRole("link", { name: "Stories", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Stories", level: 1 })).toBeVisible();

    await nav.getByRole("link", { name: "Profile", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Photo" })).toBeVisible();

    await nav.getByRole("link", { name: "Settings", exact: true }).click();
    await page.getByRole("tab", { name: "Account" }).click();
    await expect(page.getByRole("link", { name: "Download JSON" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete account" })).toBeVisible();

    await nav.getByRole("link", { name: "Notifications", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Notifications", level: 1 })).toBeVisible();
  });
});
