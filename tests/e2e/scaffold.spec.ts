import { expect, test } from "@playwright/test";

test("shows the ordered course plan and opens a lesson using the keyboard", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page).toHaveTitle("Hyperlane 协议学习 · Teach Kit");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hyperlane 协议学习");
  const items = page.locator("main ol > li");
  await expect(items).toHaveCount(4);
  await expect(items.nth(0)).toContainText("协议模型与消息生命周期");
  await expect(items.nth(2)).toContainText("计划中");
  await expect(items.nth(2).getByRole("link")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("course.png"), fullPage: true });
  const link = page.getByRole("link", { name: /协议模型与消息生命周期/ });
  await link.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/lessons\/message-lifecycle$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("协议模型与消息生命周期");
  await expect(page.getByRole("heading", { name: "传输不等于验证", exact: true })).toBeVisible();
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
  const diagramImage = page.getByRole("img", { name: "消息交付角色" });
  await expect(diagramImage).toBeVisible();
  expect(await diagramImage.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(
    0,
  );
  const summary = page.locator("summary").first();
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("发送应用，而不是用户的钱包。", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "验证", exact: true }).click();
  await expect(page.getByText("接收应用选择消息的接受规则。", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /下一课.*Mailbox/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath("lesson.png"), fullPage: true });
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("link", { name: /下一课.*Mailbox/ }).click();
  await expect(page.getByText("下一课", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /下一课/ })).toHaveCount(0);
  await page.getByRole("link", { name: /上一课/ }).click();
  await page.getByRole("link", { name: "课程概览", exact: true }).click();
  await expect(page).toHaveURL("/");
  expect(errors).toEqual([]);
});

test("direct lesson URLs work and unknown or planned URLs return 404", async ({ page }) => {
  await page.goto("/lessons/mailbox");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mailbox 与消息身份");
  for (const path of ["/lessons/security", "/lessons/unknown", "/unknown"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.getByText("页面不存在", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "课程概览" }).click();
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
  await expect(page.getByText("还没有规划课程。")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("restores a deep heading anchor after loading and tolerates malformed fragments", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/lessons/message-lifecycle#检查理解");
  const heading = page.getByRole("heading", { name: "检查理解", exact: true });
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
