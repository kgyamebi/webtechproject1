import { readFileSync } from "node:fs";
import { Client } from "pg";
import { expect, test } from "@playwright/test";

async function clearSeedConnectSessions() {
  const env = readFileSync(".env", "utf8");
  const match = env.match(/^DATABASE_URL=(.*)$/m);
  if (!match) {
    return;
  }
  const client = new Client({ connectionString: match[1].trim().replace(/^"|"$/g, ""), connectionTimeoutMillis: 2000 });
  await client.connect();
  await client.query(
    `DELETE FROM "ConnectSession" WHERE id IN (
      SELECT p."sessionId" FROM "ConnectParticipant" p
      JOIN "user" u ON u.id = p."userId"
      WHERE u.email IN ('ada.mensah@riverside.edu', 'ama.darko@gmail.com')
    )`,
  );
  await client.query(
    `DELETE FROM "ConnectQueueEntry" WHERE "userId" IN (
      SELECT id FROM "user" WHERE email IN ('ada.mensah@riverside.edu', 'ama.darko@gmail.com')
    )`,
  );
  await client.end();
}

test.describe("Random Connect", () => {
  test.describe.configure({ timeout: 90000 });

  test.beforeEach(async ({ request }) => {
    const health = await request.get("/api/health");
    test.skip(health.status() !== 200, "PostgreSQL is not running, so Random Connect cannot be checked.");
  });

  test("an adult sees Connect and a minor does not", async ({ page, viewport }) => {
    const narrow = (viewport?.width ?? 0) < 900;
    await page.goto("/login");
    await page.getByLabel("Email").fill("ada.mensah@riverside.edu");
    await page.getByLabel("Password").fill("Campus-seed-2026");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Hello, Ada Mensah" })).toBeVisible({ timeout: 20000 });

    if (narrow) {
      await page.getByText("Menu", { exact: true }).click();
    }
    await page.getByRole("link", { name: "Connect", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Connect" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Safety and privacy" })).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL("/");

    await page.goto("/login");
    await page.getByLabel("Email").fill("leila.osei@riverside.edu");
    await page.getByLabel("Password").fill("Campus-seed-2026");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: /Hello, Leila/ })).toBeVisible({ timeout: 20000 });
    await page.goto("/workspace/connect");
    await expect(page.getByText("Closed for under-18 accounts")).toBeVisible();
  });
});

test.describe("Random Connect match", () => {
  test.describe.configure({ timeout: 120000 });

  test.beforeAll(async () => {
    await clearSeedConnectSessions();
  });

  test("two adults exchange a message and end the chat", async ({ browser, request, viewport }) => {
    test.skip((viewport?.width ?? 0) < 900, "The two-person match is checked on the desktop project.");
    const health = await request.get("/api/health");
    test.skip(health.status() !== 200, "PostgreSQL is not running, so Random Connect cannot be checked.");

    const ada = await browser.newContext();
    const ama = await browser.newContext();
    const adaPage = await ada.newPage();
    const amaPage = await ama.newPage();

    await signIn(adaPage, "ada.mensah@riverside.edu");
    await signIn(amaPage, "ama.darko@gmail.com");
    await adaPage.goto("/workspace/connect");
    await amaPage.goto("/workspace/connect");

    await adaPage.getByRole("button", { name: "Meet someone new" }).click();
    await amaPage.getByRole("button", { name: "Meet someone new" }).click();

    await expect(adaPage).toHaveURL(/\/workspace\/connect\/session\//, { timeout: 30000 });
    await expect(amaPage).toHaveURL(/\/workspace\/connect\/session\//, { timeout: 30000 });
    await expect(
      adaPage.getByText("Voice and video are not available").or(adaPage.getByRole("button", { name: "Start voice" })),
    ).toBeVisible();

    await adaPage.getByLabel("Message").fill("Hello from the test");
    await adaPage.getByRole("button", { name: "Send" }).click();
    await expect(amaPage.getByText("Hello from the test")).toBeVisible({ timeout: 20000 });

    await adaPage.getByRole("button", { name: "End conversation" }).click();
    await adaPage.getByRole("button", { name: "End for both" }).click();
    await expect(adaPage.getByRole("heading", { name: "Connection history" })).toBeVisible({ timeout: 20000 });

    await ada.close();
    await ama.close();
  });
});

async function signIn(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("Campus-seed-2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Hello,/ })).toBeVisible({ timeout: 20000 });
}
