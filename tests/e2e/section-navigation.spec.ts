import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { openNavigationLesson } from "../helpers/navigation-page";

const titles = [
  "传输不等于验证",
  "跟随一条消息",
  "两个不同的问题",
  "真实性不等于授权",
  "检查理解",
  "延伸阅读",
] as const;

test("animates nearby tick lengths around the hovered or focused section", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chromium", "The rail needs a desktop gutter.");
  await page.goto("/lessons/message-lifecycle#跟随一条消息");
  const navigation = page.getByRole("navigation", { name: "章节导航", exact: true });
  const links = navigation.getByRole("link");
  await expect(navigation.locator('[aria-current="location"]')).toHaveAccessibleName(titles[1]);
  const ticks = navigation.locator(".section-tick");
  const bounds = await ticks.evaluateAll((elements) =>
    elements.map((element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    }),
  );
  expect(bounds).toHaveLength(titles.length);
  for (const [index, tick] of bounds.entries()) {
    expect(tick.width).toBe(8);
    expect(tick.height).toBe(2);
    if (index > 0) expect(tick.y - (bounds[index - 1]?.y ?? 0)).toBe(13);
  }
  const railBounds = await navigation.boundingBox();
  await page.screenshot({ path: testInfo.outputPath("compact-section-rail.png") });
  await links.nth(3).hover();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await expect.poll(async () => (await ticks.nth(3).boundingBox())?.width).toBeGreaterThan(24);
  await expect.poll(async () => (await ticks.nth(2).boundingBox())?.width).toBeGreaterThan(18);
  await expect.poll(async () => (await ticks.nth(1).boundingBox())?.width).toBeGreaterThan(8);
  expect(await navigation.boundingBox()).toEqual(railBounds);
  await page.screenshot({ path: testInfo.outputPath("compact-section-hover.png") });
  await page.keyboard.press("Escape");
  await page.mouse.move(900, 100);
  await links.nth(4).focus();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await expect.poll(async () => (await ticks.nth(4).boundingBox())?.width).toBeGreaterThan(24);
  await expect.poll(async () => (await ticks.nth(3).boundingBox())?.width).toBeGreaterThan(18);
  expect(await navigation.boundingBox()).toEqual(railBounds);
  await page.keyboard.press("Enter");
  await expect(page.locator("#检查理解")).toBeFocused();
});

test("offers ordered desktop anchor links and focuses headings on pointer and keyboard jumps", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chromium", "The rail needs a desktop gutter.");
  await page.goto("/lessons/message-lifecycle");
  const navigation = page.getByRole("navigation", { name: "章节导航", exact: true });
  await expect(navigation).toBeVisible();
  const links = navigation.getByRole("link");
  await expect(links).toHaveCount(titles.length);
  for (const [index, title] of titles.entries()) {
    await expect(links.nth(index)).toHaveAccessibleName(title);
  }
  await links.nth(1).click();
  await expect(page).toHaveURL(/#%E8%B7%9F%E9%9A%8F%E4%B8%80%E6%9D%A1%E6%B6%88%E6%81%AF$/);
  await expect(page.locator("#跟随一条消息")).toBeFocused();
  await links.nth(3).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(
    /#%E7%9C%9F%E5%AE%9E%E6%80%A7%E4%B8%8D%E7%AD%89%E4%BA%8E%E6%8E%88%E6%9D%83$/,
  );
  await expect(page.locator("#真实性不等于授权")).toBeFocused();
  await links.first().focus();
  await page.keyboard.press("Tab");
  await expect(links.nth(1)).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath("section-rail.png"), fullPage: true });
});

test("omits navigation without sections and labels a single empty heading", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chromium", "The rail needs a desktop gutter.");
  await openNavigationLesson(page, "An introduction without any headings.");
  await expect(page.getByRole("article")).toContainText("An introduction");
  await expect(page.getByRole("navigation", { name: "章节导航", exact: true })).toHaveCount(0);
  await page.unroute("**/api/lessons/message-lifecycle");
  await openNavigationLesson(page, "##\n\nBody.");
  const navigation = page.getByRole("navigation", { name: "章节导航", exact: true });
  await expect(navigation.getByRole("link")).toHaveCount(1);
  await expect(navigation.getByRole("link")).toHaveAccessibleName("Section 1");
  await navigation.getByRole("link").click();
  await expect(page).toHaveURL(/#section$/);
  await expect(page.locator("#section")).toBeFocused();
});

test("keeps hover previews open across the pointer gap and dismisses without reopening", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chromium", "Hover previews are desktop-only.");
  await openNavigationLesson(
    page,
    "## First\n\nA **plain** summary.\n\n## Second\n\nAnother summary.",
  );
  const links = page.getByRole("navigation", { name: "章节导航", exact: true }).getByRole("link");
  const preview = page.getByRole("tooltip");
  await links.first().hover();
  await expect(preview).toContainText("First");
  await expect(preview).toContainText("A plain summary.");
  await preview.hover();
  await expect(preview).toBeVisible();
  await page.mouse.move(900, 100);
  await expect(preview).toHaveCount(0);
  await links.first().hover();
  await expect(preview).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(preview).toHaveCount(0);
  await expect(links.first()).not.toBeFocused();
  await page.mouse.move(900, 100);
  await links.nth(1).focus();
  await expect(preview).toContainText("Another summary.");
  await expect(links.nth(1)).toBeFocused();
  await links.nth(1).hover();
  await page.mouse.move(900, 100);
  await expect(preview).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(preview).toHaveCount(0);
  await expect(links.nth(1)).toBeFocused();
  await links.first().focus();
  await expect(preview).toContainText("A plain summary.");
  await links.nth(1).hover();
  await expect(preview).toHaveCount(1);
  await expect(preview).toContainText("Another summary.");
  await page.screenshot({ path: testInfo.outputPath("section-preview.png") });
  await page.setViewportSize({ width: 900, height: 700 });
  await expect(preview).toHaveCount(0);
});

test("bounds long previews and keeps first and last links reachable in a short viewport", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chromium", "Hover previews are desktop-only.");
  await page.setViewportSize({ width: 1000, height: 360 });
  const title = "LongUnbrokenHeading".repeat(12);
  const summary = "A long readable summary. ".repeat(100);
  const source = [
    `## ${title}\n\n${summary}`,
    ...Array.from({ length: 40 }, (_, index) => `## Section ${index + 1}`),
  ].join("\n\n");
  await openNavigationLesson(page, source);
  const links = page.getByRole("navigation", { name: "章节导航", exact: true }).getByRole("link");
  await links.first().focus();
  const preview = page.getByRole("tooltip");
  await expect(preview).toBeVisible();
  await expect(preview).toContainText(title);
  await expect(preview).toContainText(summary.trim());
  const assertBounds = async () => {
    const bounds = await preview.boundingBox();
    expect(bounds).not.toBeNull();
    if (!bounds) throw new Error("Preview bounds are missing.");
    expect(bounds.x).toBeGreaterThanOrEqual(8);
    expect(bounds.y).toBeGreaterThanOrEqual(8);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(992);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(352);
  };
  await assertBounds();
  await page.screenshot({ path: testInfo.outputPath("long-section-preview.png") });
  await links.last().focus();
  await expect(links.last()).toBeInViewport();
  await expect(preview).toHaveText("Section 40");
  await assertBounds();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("tracks scrolling, introduction and a short last section without writing URL history", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chromium", "The rail needs a desktop gutter.");
  await page.goto("/lessons/message-lifecycle");
  const navigation = page.getByRole("navigation", { name: "章节导航", exact: true });
  const current = navigation.locator('[aria-current="location"]');
  await expect(navigation).toBeVisible();
  await expect(current).toHaveCount(0);
  const historyLength = await page.evaluate(() => history.length);
  await page.locator("#真实性不等于授权").evaluate((heading) => heading.scrollIntoView());
  await expect(current).toHaveAccessibleName(titles[3] ?? "");
  await navigation.getByRole("link", { name: titles[1], exact: true }).hover();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await expect(current).toHaveAccessibleName(titles[3] ?? "");
  await page.locator("#跟随一条消息").evaluate((heading) => heading.scrollIntoView());
  await expect(current).toHaveAccessibleName(titles[1] ?? "");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(current).toHaveAccessibleName(titles[5] ?? "");
  await expect(page).toHaveURL(/\/lessons\/message-lifecycle$/);
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(current).toHaveCount(0);
});

test("restores active deep links through history and tolerates missing fragments", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chromium", "The rail needs a desktop gutter.");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/lessons/message-lifecycle#跟随一条消息");
  const navigation = page.getByRole("navigation", { name: "章节导航", exact: true });
  const current = navigation.locator('[aria-current="location"]');
  await expect(current).toHaveAccessibleName(titles[1] ?? "");
  await navigation.getByRole("link", { name: titles[3], exact: true }).click();
  await expect(current).toHaveAccessibleName(titles[3] ?? "");
  await page.goBack();
  await expect(page).toHaveURL(/#%E8%B7%9F%E9%9A%8F%E4%B8%80%E6%9D%A1%E6%B6%88%E6%81%AF$/);
  await expect(current).toHaveAccessibleName(titles[1] ?? "");
  await page.goForward();
  await expect(page).toHaveURL(
    /#%E7%9C%9F%E5%AE%9E%E6%80%A7%E4%B8%8D%E7%AD%89%E4%BA%8E%E6%8E%88%E6%9D%83$/,
  );
  await expect(current).toHaveAccessibleName(titles[3] ?? "");
  await page.goto("/");
  await page.goto("/lessons/message-lifecycle#missing-heading");
  await expect(navigation).toBeVisible();
  await expect(current).toHaveCount(0);
  await page.goto("/");
  await page.goto("/lessons/message-lifecycle#%zz");
  await expect(navigation).toBeVisible();
  await expect(current).toHaveCount(0);
  await page.getByRole("link", { name: "课程概览", exact: true }).click();
  await expect(navigation).toHaveCount(0);
  await page.getByRole("link", { name: /协议模型与消息生命周期/ }).click();
  await expect(navigation).toBeVisible();
  await expect(current).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("recalculates the active section after disclosure layout changes without scrolling", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chromium", "The rail needs a desktop gutter.");
  const source = await readFile(new URL("../fixtures/navigation.md", import.meta.url), "utf8");
  await page.setViewportSize({ width: 1280, height: 360 });
  await openNavigationLesson(page, source);
  // Isolate position changes from the browser's automatic scroll anchoring.
  await page.addStyleTag({ content: "html { overflow-anchor: none; }" });
  const navigation = page.getByRole("navigation", { name: "章节导航", exact: true });
  const current = navigation.locator('[aria-current="location"]');
  await page.locator("#second").evaluate((heading) => heading.scrollIntoView());
  await expect(current).toHaveAccessibleName("Second");
  const scrollY = await page.evaluate(() => window.scrollY);
  await page.locator("details").evaluate((details: HTMLDetailsElement) => {
    details.open = true;
  });
  await expect(current).toHaveAccessibleName("First");
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
});

test("uses a non-modal narrow outline by touch and keyboard, then focuses the selected heading", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 393, height: 851 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/lessons/message-lifecycle");
  const navigation = page.getByRole("navigation", { name: "章节导航", exact: true });
  const button = navigation.getByRole("button", { name: "本页内容" });
  await expect(button).toHaveAttribute("aria-expanded", "false");
  const outlineId = await button.getAttribute("aria-controls");
  expect(outlineId).toBeTruthy();
  if (testInfo.project.name === "mobile-chromium") await button.tap();
  else await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(navigation.getByRole("link")).toHaveCount(titles.length);
  expect(await navigation.locator("ol").getAttribute("id")).toBe(outlineId);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("narrow-outline.png") });
  const target = navigation.getByRole("link", { name: titles[1], exact: true });
  if (testInfo.project.name === "mobile-chromium") await target.tap();
  else await target.click();
  await expect(page).toHaveURL(/#%E8%B7%9F%E9%9A%8F%E4%B8%80%E6%9D%A1%E6%B6%88%E6%81%AF$/);
  await expect(page.locator("#跟随一条消息")).toBeFocused();
  await expect(page.locator("#跟随一条消息")).toBeInViewport();
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Tab");
  await expect(navigation.getByRole("link").first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(button).toBeFocused();
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Space");
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await navigation.getByRole("link").last().focus();
  await page.keyboard.press("Tab");
  expect(await navigation.evaluate((element) => element.contains(document.activeElement))).toBe(
    false,
  );
  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "false");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("keeps long outlines usable at 320px and renders no toggle without sections", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 720 });
  const longTitle = "AnUnbrokenSectionTitle".repeat(10);
  await openNavigationLesson(
    page,
    [
      `## ${longTitle}`,
      ...Array.from({ length: 40 }, (_, index) => `## Section ${index + 1}`),
    ].join("\n\n"),
  );
  const navigation = page.getByRole("navigation", { name: "章节导航", exact: true });
  const button = navigation.getByRole("button", { name: "本页内容" });
  await button.click();
  await expect(navigation.getByRole("link").first()).toHaveText(longTitle);
  await navigation.getByRole("link").last().focus();
  await expect(navigation.getByRole("link").last()).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("long-narrow-outline.png") });
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#section-40$/);
  await expect(page.locator("#section-40")).toBeFocused();
  await expect(page.locator("#section-40")).toBeInViewport();
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await page.unroute("**/api/lessons/message-lifecycle");
  await openNavigationLesson(page, "No sections here.");
  await expect(page.getByRole("article")).toContainText("No sections here.");
  await expect(navigation).toHaveCount(0);
  await expect(page.getByRole("button", { name: "本页内容" })).toHaveCount(0);
});

test("switches at the gutter breakpoint without retaining previews or expanded outline state", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1000, height: 720 });
  await page.goto("/lessons/message-lifecycle");
  const navigation = page.getByRole("navigation", { name: "章节导航", exact: true });
  await navigation.getByRole("link").first().focus();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await page.setViewportSize({ width: 999, height: 720 });
  const button = navigation.getByRole("button", { name: "本页内容" });
  await expect(button).toBeVisible();
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await page.setViewportSize({ width: 1000, height: 720 });
  await expect(button).toHaveCount(0);
  await expect(navigation.getByRole("link")).toHaveCount(titles.length);
  await page.screenshot({ path: testInfo.outputPath("gutter-breakpoint.png") });
  await page.setViewportSize({ width: 999, height: 720 });
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("link", { name: /下一课.*Mailbox/ }).click();
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await button.click();
  await expect(navigation.getByRole("link")).toHaveCount(3);
});

test("keeps heading navigation distinct from the skip-to-content target", async ({
  page,
}, testInfo) => {
  await openNavigationLesson(page, "## Main content\n\nBody.");
  const navigation = page.getByRole("navigation", { name: "章节导航", exact: true });
  if (testInfo.project.name === "mobile-chromium") {
    await navigation.getByRole("button", { name: "本页内容" }).click();
  }
  await navigation.getByRole("link", { name: "Main content", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Main content", exact: true })).toBeFocused();
  await expect(page).toHaveURL(/#main-content-1$/);
  await page.locator(".skip-link").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main-content$/);
  await expect(page.locator("main")).toBeFocused();
});

test("tracks narrow reading state and restores deep links without expanding the outline", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 851 });
  await page.goto("/lessons/message-lifecycle#跟随一条消息");
  const navigation = page.getByRole("navigation", { name: "章节导航", exact: true });
  const button = navigation.getByRole("button", { name: "本页内容" });
  const current = navigation.locator('[aria-current="location"]');
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(current).toHaveAttribute("href", "#跟随一条消息");
  const historyLength = await page.evaluate(() => history.length);
  await page.locator("#真实性不等于授权").evaluate((heading) => heading.scrollIntoView());
  await expect(current).toHaveAttribute("href", "#真实性不等于授权");
  await expect(page).toHaveURL(/#%E8%B7%9F%E9%9A%8F%E4%B8%80%E6%9D%A1%E6%B6%88%E6%81%AF$/);
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  await button.click();
  await navigation.getByRole("link", { name: titles[3], exact: true }).click();
  await expect(page.locator("#真实性不等于授权")).toBeFocused();
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await page.goBack();
  await expect(page).toHaveURL(/#%E8%B7%9F%E9%9A%8F%E4%B8%80%E6%9D%A1%E6%B6%88%E6%81%AF$/);
  await expect(current).toHaveAttribute("href", "#跟随一条消息");
  await page.goForward();
  await expect(current).toHaveAttribute("href", "#真实性不等于授权");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(current).toHaveAttribute("href", "#延伸阅读");
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(current).toHaveCount(0);
});
