import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { openNavigationLesson } from "../helpers/navigation-page";

const titles = [
  "Transport is not verification",
  "Follow one message",
  "Two different questions",
  "Authenticity is not authorization",
  "Check your understanding",
  "Further reading",
] as const;

test("offers ordered desktop anchor links and focuses headings on pointer and keyboard jumps", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chromium", "The rail needs a desktop gutter.");
  await page.goto("/lessons/message-lifecycle");
  const navigation = page.getByRole("navigation", { name: "Section navigation", exact: true });
  await expect(navigation).toBeVisible();
  const links = navigation.getByRole("link");
  await expect(links).toHaveCount(titles.length);
  for (const [index, title] of titles.entries()) {
    await expect(links.nth(index)).toHaveAccessibleName(title);
  }
  await links.nth(1).click();
  await expect(page).toHaveURL(/#follow-one-message$/);
  await expect(page.locator("#follow-one-message")).toBeFocused();
  await links.nth(3).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#authenticity-is-not-authorization$/);
  await expect(page.locator("#authenticity-is-not-authorization")).toBeFocused();
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
  await expect(
    page.getByRole("navigation", { name: "Section navigation", exact: true }),
  ).toHaveCount(0);
  await page.unroute("**/api/lessons/message-lifecycle");
  await openNavigationLesson(page, "##\n\nBody.");
  const navigation = page.getByRole("navigation", { name: "Section navigation", exact: true });
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
  const links = page
    .getByRole("navigation", { name: "Section navigation", exact: true })
    .getByRole("link");
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
  const links = page
    .getByRole("navigation", { name: "Section navigation", exact: true })
    .getByRole("link");
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
  const navigation = page.getByRole("navigation", { name: "Section navigation", exact: true });
  const current = navigation.locator('[aria-current="location"]');
  await expect(navigation).toBeVisible();
  await expect(current).toHaveCount(0);
  const historyLength = await page.evaluate(() => history.length);
  await page
    .locator("#authenticity-is-not-authorization")
    .evaluate((heading) => heading.scrollIntoView());
  await expect(current).toHaveAccessibleName(titles[3] ?? "");
  await navigation.getByRole("link", { name: titles[1], exact: true }).hover();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await expect(current).toHaveAccessibleName(titles[3] ?? "");
  await page.locator("#follow-one-message").evaluate((heading) => heading.scrollIntoView());
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
  await page.goto("/lessons/message-lifecycle#follow-one-message");
  const navigation = page.getByRole("navigation", { name: "Section navigation", exact: true });
  const current = navigation.locator('[aria-current="location"]');
  await expect(current).toHaveAccessibleName(titles[1] ?? "");
  await navigation.getByRole("link", { name: titles[3], exact: true }).click();
  await expect(current).toHaveAccessibleName(titles[3] ?? "");
  await page.goBack();
  await expect(page).toHaveURL(/#follow-one-message$/);
  await expect(current).toHaveAccessibleName(titles[1] ?? "");
  await page.goForward();
  await expect(page).toHaveURL(/#authenticity-is-not-authorization$/);
  await expect(current).toHaveAccessibleName(titles[3] ?? "");
  await page.goto("/");
  await page.goto("/lessons/message-lifecycle#missing-heading");
  await expect(navigation).toBeVisible();
  await expect(current).toHaveCount(0);
  await page.goto("/");
  await page.goto("/lessons/message-lifecycle#%zz");
  await expect(navigation).toBeVisible();
  await expect(current).toHaveCount(0);
  await page.getByRole("link", { name: "Course overview", exact: true }).click();
  await expect(navigation).toHaveCount(0);
  await page.getByRole("link", { name: /Protocol model and message lifecycle/ }).click();
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
  const navigation = page.getByRole("navigation", { name: "Section navigation", exact: true });
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
  const navigation = page.getByRole("navigation", { name: "Section navigation", exact: true });
  const button = navigation.getByRole("button", { name: "On this page" });
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
  await expect(page).toHaveURL(/#follow-one-message$/);
  await expect(page.locator("#follow-one-message")).toBeFocused();
  await expect(page.locator("#follow-one-message")).toBeInViewport();
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
  const navigation = page.getByRole("navigation", { name: "Section navigation", exact: true });
  const button = navigation.getByRole("button", { name: "On this page" });
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
  await expect(page.getByRole("button", { name: "On this page" })).toHaveCount(0);
});

test("switches at the gutter breakpoint without retaining previews or expanded outline state", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1000, height: 720 });
  await page.goto("/lessons/message-lifecycle");
  const navigation = page.getByRole("navigation", { name: "Section navigation", exact: true });
  await navigation.getByRole("link").first().focus();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await page.setViewportSize({ width: 999, height: 720 });
  const button = navigation.getByRole("button", { name: "On this page" });
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
  await page.getByRole("link", { name: /Next lesson.*Mailbox/ }).click();
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await button.click();
  await expect(navigation.getByRole("link")).toHaveCount(3);
});

test("tracks narrow reading state and restores deep links without expanding the outline", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 851 });
  await page.goto("/lessons/message-lifecycle#follow-one-message");
  const navigation = page.getByRole("navigation", { name: "Section navigation", exact: true });
  const button = navigation.getByRole("button", { name: "On this page" });
  const current = navigation.locator('[aria-current="location"]');
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(current).toHaveAttribute("href", "#follow-one-message");
  const historyLength = await page.evaluate(() => history.length);
  await page
    .locator("#authenticity-is-not-authorization")
    .evaluate((heading) => heading.scrollIntoView());
  await expect(current).toHaveAttribute("href", "#authenticity-is-not-authorization");
  await expect(page).toHaveURL(/#follow-one-message$/);
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  await button.click();
  await navigation.getByRole("link", { name: titles[3], exact: true }).click();
  await expect(page.locator("#authenticity-is-not-authorization")).toBeFocused();
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await page.goBack();
  await expect(page).toHaveURL(/#follow-one-message$/);
  await expect(current).toHaveAttribute("href", "#follow-one-message");
  await page.goForward();
  await expect(current).toHaveAttribute("href", "#authenticity-is-not-authorization");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(current).toHaveAttribute("href", "#further-reading");
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(current).toHaveCount(0);
});
