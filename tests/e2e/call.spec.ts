import { chromium, expect, test } from "@playwright/test";

const liveRoom = "/workspace/learn/cmvtnmyyv000568vbz3l0l8kw/live";

test("two enrolled people connect a voice call", async ({ request, viewport }) => {
  test.setTimeout(240000);
  test.skip((viewport?.width ?? 0) < 900, "The voice call is checked on the desktop project.");
  const health = await request.get("http://127.0.0.1:3001/health").catch(() => null);
  test.skip(!health || health.status() !== 200, "The media server is not running.");

  const browser = await chromium.launch({
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  });
  const ada = await browser.newContext({ baseURL: "http://localhost:3000" });
  const samuel = await browser.newContext({ baseURL: "http://localhost:3000" });
  await ada.grantPermissions(["microphone", "camera"]);
  await samuel.grantPermissions(["microphone", "camera"]);
  const adaPage = await ada.newPage();
  const samuelPage = await samuel.newPage();
  const notes: string[] = [];
  watch(adaPage, "ada", notes);
  watch(samuelPage, "samuel", notes);

  try {
    await signIn(adaPage, "ada.mensah@riverside.edu");
    await signIn(samuelPage, "samuel.boateng@riverside.edu");
    await adaPage.goto(liveRoom);
    await samuelPage.goto(liveRoom);
    await expect(adaPage.getByRole("heading", { name: "Live room" })).toBeVisible({ timeout: 60000 });
    const hydrated = await adaPage
      .waitForFunction(() => document.querySelector("[aria-label='Call']")?.getAttribute("data-ready") === "true", undefined, { timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    if (!hydrated) {
      const probe = await adaPage.evaluate(() => {
        const el = document.querySelector("[aria-label='Call']");
        return {
          ready: el?.getAttribute("data-ready") ?? "missing",
          text: (el?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 240),
          scripts: performance.getEntriesByType("resource").filter((entry) => entry.name.includes("/_next/") && (entry as PerformanceResourceTiming).responseStatus >= 400).map((entry) => entry.name),
        };
      });
      throw new Error(`Call controls did not hydrate ${JSON.stringify(probe)} :: ${notes.join(" || ").slice(0, 2500)}`);
    }
    await samuelPage.waitForFunction(() => document.querySelector("[aria-label='Call']")?.getAttribute("data-ready") === "true", undefined, { timeout: 20000 });
    await adaPage.getByRole("button", { name: "Start voice" }).click();
    await samuelPage.getByRole("button", { name: "Start voice" }).click();
    await expect(adaPage.getByText("Samuel Boateng is in the call.")).toBeVisible({ timeout: 30000 });
    await expect(samuelPage.getByText("Ada Mensah is in the call.")).toBeVisible({ timeout: 30000 });
    await expect(adaPage.getByText(/^Connected/)).toBeVisible({ timeout: 30000 });
    await expect(samuelPage.getByText(/^Connected/)).toBeVisible({ timeout: 30000 });
  } finally {
    await browser.close();
  }
});

function watch(page: import("@playwright/test").Page, label: string, notes: string[]) {
  page.on("pageerror", (error) => notes.push(`${label} pageerror ${error.message}`));
  page.on("console", (message) => {
    const text = message.text();
    if (text.includes("/_next/hmr")) {
      return;
    }
    if (message.type() === "error" || text.includes("hydrat")) {
      notes.push(`${label} ${message.type()} ${text.slice(0, 500)}`);
    }
  });
  page.on("requestfailed", (request) => {
    notes.push(`${label} failed ${request.url()} ${request.failure()?.errorText ?? ""}`);
  });
}

async function signIn(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("Campus-seed-2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Hello,/ })).toBeVisible({ timeout: 90000 });
}
