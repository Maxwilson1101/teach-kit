import { expect, test } from "@playwright/test";

test("shows the ordered course plan and opens a lesson using the keyboard", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page).toHaveTitle("Hyperlane Protocol Study · Teach Kit");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hyperlane Protocol Study");
  const items = page.locator("main ol > li");
  await expect(items).toHaveCount(4);
  await expect(items.nth(0)).toContainText("Protocol model and message lifecycle");
  await expect(items.nth(2)).toContainText("Planned");
  await expect(items.nth(2).getByRole("link")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("course.png"), fullPage: true });
  const link = page.getByRole("link", { name: /Protocol model and message lifecycle/ });
  await link.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/lessons\/message-lifecycle$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Protocol model and message lifecycle",
  );
  await expect(
    page.getByRole("heading", { name: "Transport is not verification", exact: true }),
  ).toBeVisible();
  await page.locator(".skip-link").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/lessons\/message-lifecycle#main-content$/);
  await expect(page.locator("main")).toBeFocused();
  await expect(page.locator("pre, code")).toHaveCount(0);
  const table = page.getByRole("table");
  expect(await table.evaluate((element) => element.scrollWidth)).toBeGreaterThanOrEqual(560);
  const tableContainer = table.locator("..");
  expect(await tableContainer.evaluate((element) => element.clientWidth)).toBeLessThanOrEqual(
    testInfo.project.name === "mobile-chromium" ? 393 : 1280,
  );
  expect(
    await page.locator(".skip-link").evaluate((element) => element.getBoundingClientRect().width),
  ).toBeLessThanOrEqual(1);
  await expect(page.getByRole("img", { name: "Message delivery roles" })).toBeVisible();
  expect(
    await page.getByRole("img").evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBeGreaterThan(0);
  const summary = page.locator("summary").first();
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("The sending application, not the user's wallet.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Verification", exact: true }).click();
  await expect(
    page.getByText("The receiving application chooses the acceptance rules.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Next lesson.*Mailbox/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath("lesson.png"), fullPage: true });
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("link", { name: /Next lesson.*Mailbox/ }).click();
  await expect(page.getByText("Next lesson", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Next lesson/ })).toHaveCount(0);
  await page.getByRole("link", { name: /Previous lesson/ }).click();
  await page.getByRole("link", { name: "Course overview", exact: true }).click();
  await expect(page).toHaveURL("/");
  expect(errors).toEqual([]);
});

test("direct lesson URLs work and unknown or planned URLs return 404", async ({ page }) => {
  await page.goto("/lessons/mailbox");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mailbox and message identity");
  for (const path of ["/lessons/security", "/lessons/unknown", "/unknown"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.getByText("Page not found", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Course overview" }).click();
    await expect(page).toHaveURL("/");
  }
});

test("keeps long course metadata readable at a 320px viewport and renders an empty plan", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  const title = "UnbrokenCourseTitle".repeat(12);
  await page.route("**/api/course", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ title, description: "LongDescription".repeat(20), lessons: [] }),
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(page.getByText("No lessons have been planned yet.")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("restores a deep heading anchor after loading and tolerates malformed fragments", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/lessons/message-lifecycle#check-your-understanding");
  const heading = page.getByRole("heading", { name: "Check your understanding", exact: true });
  await expect(heading).toBeInViewport();
  await page.goto("/lessons/message-lifecycle#%zz");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(errors).toEqual([]);
});

test("shows a readable error instead of an empty lesson when loading fails", async ({ page }) => {
  await page.route("**/api/course", (route) =>
    route.fulfill({
      status: 422,
      contentType: "application/json",
      body: JSON.stringify({ message: "lessons/example.md:1:1: Raw HTML is not supported." }),
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Raw HTML is not supported.");
});
