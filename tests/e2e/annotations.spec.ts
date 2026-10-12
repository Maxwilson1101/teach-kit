import { readFileSync } from "node:fs";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { validateDirectives } from "../../src/markdown/directives";
import { parseMarkdown } from "../../src/markdown/parse";
import { openNavigationLesson } from "../helpers/navigation-page";

const boundarySource = readFileSync(new URL("../fixtures/annotations.md", import.meta.url), "utf8");
const browserErrors = new WeakMap<Page, string[]>();

test.beforeEach(({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
});

test.afterEach(({ page }) => {
  expect(browserErrors.get(page)).toEqual([]);
});

async function bounds(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("The annotation element has no layout box.");
  return box;
}

async function expectArticleTypography(body: Locator, article: Locator) {
  const typography = (element: Element) => {
    const style = getComputedStyle(element);
    return { family: style.fontFamily, size: style.fontSize, lineHeight: style.lineHeight };
  };
  expect(await body.evaluate(typography)).toEqual(await article.evaluate(typography));
}

async function expectNoPageOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

function relativeLuminance(color: string): number {
  const [red, green, blue] =
    color
      .match(/\d+(?:\.\d+)?/g)
      ?.slice(0, 3)
      .map(Number) ?? [];
  if (red === undefined || green === undefined || blue === undefined) {
    throw new Error(`Cannot parse the color ${color}.`);
  }
  const channel = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

/** Returns the WCAG contrast ratio between two `rgb()` colors. */
function contrastRatio(foreground: string, background: string): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

test("keeps callouts compact with visible decorative icons and article typography", async ({
  page,
}) => {
  await page.goto("/lessons/message-lifecycle");
  const article = page.getByRole("article");
  for (const kind of ["note", "tip", "warning"]) {
    const callout = article.locator(`[data-callout="${kind}"]`).first();
    const icon = callout.locator("svg").first();
    await expect(icon).toBeVisible();
    await expect(icon).toHaveAttribute("aria-hidden", "true");
    const iconBox = await bounds(icon);
    expect(iconBox.width).toBeGreaterThanOrEqual(16);
    expect(iconBox.width).toBeLessThanOrEqual(20);

    const heading = callout.locator(":scope > :first-child");
    const body = callout.locator(":scope > :last-child");
    const calloutBox = await bounds(callout);
    const headingBox = await bounds(heading);
    const bodyBox = await bounds(body);
    expect(headingBox.y - calloutBox.y).toBeGreaterThanOrEqual(10);
    expect(headingBox.y - calloutBox.y).toBeLessThanOrEqual(16);
    expect(bodyBox.y - (headingBox.y + headingBox.height)).toBeGreaterThanOrEqual(6);
    expect(bodyBox.y - (headingBox.y + headingBox.height)).toBeLessThanOrEqual(12);
    expect(calloutBox.y + calloutBox.height - (bodyBox.y + bodyBox.height)).toBeLessThanOrEqual(16);
    await expectArticleTypography(body.locator("p").first(), article);
    if (kind === "warning") {
      await expect(callout).not.toHaveCSS("background-color", "rgb(255, 255, 255)");
    } else {
      await expect(callout).toHaveCSS("background-color", "rgb(255, 255, 255)");
    }
  }
  await expectNoPageOverflow(page);
});

test("ties each callout title to its kind theme color with AA contrast and a 16px label size", async ({
  page,
}) => {
  await page.goto("/lessons/message-lifecycle");
  const article = page.getByRole("article");
  for (const kind of ["note", "tip", "warning"]) {
    const callout = article.locator(`[data-callout="${kind}"]`).first();
    const heading = callout.locator(":scope > :first-child");
    const iconColor = await heading.locator("svg").evaluate((el) => getComputedStyle(el).color);
    const headingStyle = await heading.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        color: style.color,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        fontWeight: style.fontWeight,
      };
    });
    expect(headingStyle.color).toBe(iconColor);
    expect(headingStyle.fontSize).toBe("16px");
    expect(Number.parseFloat(headingStyle.lineHeight)).toBe(24);
    expect(Number.parseInt(headingStyle.fontWeight, 10)).toBeGreaterThanOrEqual(600);
    const background = await callout.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(contrastRatio(headingStyle.color, background)).toBeGreaterThanOrEqual(4.5);
  }
});

test("matches the disclosure question to the sans article typography", async ({ page }) => {
  await page.goto("/lessons/message-lifecycle");
  const article = page.getByRole("article");
  const summary = article.locator("details > summary").first();
  const articleStyle = await article.evaluate((element) => {
    const style = getComputedStyle(element);
    return { family: style.fontFamily, size: style.fontSize, lineHeight: style.lineHeight };
  });
  const summaryStyle = await summary.evaluate((element) => {
    const style = getComputedStyle(element);
    return { family: style.fontFamily, size: style.fontSize, lineHeight: style.lineHeight };
  });
  expect(summaryStyle.family).toBe(articleStyle.family);
  expect(summaryStyle.size).toBe(articleStyle.size);
  expect(summaryStyle.lineHeight).toBe(articleStyle.lineHeight);
});

test("uses the shared sans stack for annotation headings and the page body", async ({ page }) => {
  await page.goto("/lessons/message-lifecycle");
  const bodyFamily = await page
    .locator("body")
    .evaluate((element) => getComputedStyle(element).fontFamily);
  const heading = page.getByRole("article").locator("[data-callout] .callout-heading").first();
  const headingFamily = await heading.evaluate((element) => getComputedStyle(element).fontFamily);
  expect(headingFamily).toBe(bodyFamily);
});

test("reveals explanations by pointer, touch, and keyboard without enclosing borders", async ({
  page,
  isMobile,
}) => {
  await page.goto("/lessons/message-lifecycle");
  const article = page.getByRole("article");
  const disclosures = article.locator("details");
  const disclosure = disclosures.first();
  const summary = disclosure.locator("summary");
  await expect(disclosure).not.toHaveAttribute("open");
  await expect(disclosure).toHaveCSS("border-top-width", "0px");
  await expect(disclosure).toHaveCSS("border-bottom-width", "0px");
  expect((await bounds(summary)).height).toBeGreaterThanOrEqual(44);
  const arrow = summary.locator("svg");
  await expect(arrow).toBeVisible();
  await expect(arrow).toHaveAttribute("aria-hidden", "true");
  const closedTransform = await arrow.evaluate((element) => getComputedStyle(element).transform);
  if (isMobile) await summary.tap();
  else await summary.click();
  await expect(disclosure).toHaveAttribute("open", "");
  await expect
    .poll(() => arrow.evaluate((element) => getComputedStyle(element).transform))
    .not.toBe(closedTransform);
  const body = disclosure.locator(":scope > :last-child");
  await expect(body).toBeVisible();
  await expect(body).toHaveCSS("border-left-width", "1px");
  await expectArticleTypography(body.locator("p").first(), article);
  await summary.press("Space");
  await expect(disclosure).not.toHaveAttribute("open");
  await summary.press("Enter");
  await expect(disclosure).toHaveAttribute("open", "");
  await disclosures.nth(1).locator("summary").click();
  await expect(disclosure).toHaveAttribute("open", "");
  await expect(disclosures.nth(1)).toHaveAttribute("open", "");
});

test("separates tab selection from keyboard focus and keeps the panel in the article", async ({
  page,
}) => {
  await page.goto("/lessons/message-lifecycle");
  const article = page.getByRole("article");
  const group = article.locator("[data-tabs]").first();
  const list = group.getByRole("tablist");
  await expect(list).toHaveCSS("border-bottom-width", "0px");
  const tabs = group.getByRole("tab");
  const second = tabs.nth(1);
  await second.click();
  await expect(second).toHaveAttribute("aria-selected", "true");
  await expect(second).toHaveCSS("outline-style", "none");
  await expect(second).toHaveCSS("border-bottom-width", "0px");
  const underline = await second.evaluate((element) => {
    const style = getComputedStyle(element, "::after");
    return { width: Number.parseFloat(style.width), color: style.backgroundColor };
  });
  expect(underline.width).toBeGreaterThanOrEqual(20);
  expect(underline.width).toBeLessThanOrEqual(32);
  expect(underline.color).not.toBe("rgba(0, 0, 0, 0)");
  await expectArticleTypography(group.getByRole("tabpanel").locator("p").first(), article);
  await second.press("ArrowLeft");
  await expect(tabs.first()).toBeFocused();
  await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
  await expect(tabs.first()).toHaveCSS("outline-style", "solid");
  await tabs.first().press("Tab");
  const panel = group.getByRole("tabpanel");
  await expect(panel).toBeFocused();
  await expect(panel).toHaveCSS("outline-style", "none");
  const marker = await panel.evaluate((element) => {
    const style = getComputedStyle(element, "::before");
    return {
      height: Number.parseFloat(style.height),
      width: Number.parseFloat(style.width),
      color: style.backgroundColor,
    };
  });
  expect(marker.height).toBeGreaterThanOrEqual(20);
  expect(marker.width).toBeGreaterThanOrEqual(2);
  expect(marker.color).not.toBe("rgba(0, 0, 0, 0)");
});

test("keeps long annotations and nested content readable at 320px", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const parsed = parseMarkdown("annotations.md", boundarySource);
  expect(parsed.diagnostics).toEqual([]);
  expect(validateDirectives(parsed.tree, parsed.path)).toEqual([]);
  await openNavigationLesson(page, boundarySource);
  const article = page.getByRole("article");
  const callout = article.locator('[data-callout="note"]');
  const paragraphs = callout.locator(":scope > :last-child > p");
  await expect(paragraphs).toHaveCount(2);
  const first = await bounds(paragraphs.first());
  const second = await bounds(paragraphs.nth(1));
  expect(second.y - (first.y + first.height)).toBeGreaterThanOrEqual(10);
  expect(second.y - (first.y + first.height)).toBeLessThanOrEqual(16);
  const nested = callout.locator("details");
  await nested.locator("summary").click();
  await expect(nested.getByText("Nested explanation.")).toBeVisible();
  const longDisclosure = article.locator(":scope > details").first();
  const summary = longDisclosure.locator("summary");
  await summary.click();
  await expect(longDisclosure.getByText("Second answer paragraph.")).toBeVisible();
  const summaryBox = await bounds(summary);
  await expect(summary.locator("svg")).toBeVisible();
  const arrowBox = await bounds(summary.locator("svg"));
  expect(arrowBox.y - summaryBox.y).toBeLessThan(20);
  expect(arrowBox.width).toBeGreaterThanOrEqual(16);
  await expectArticleTypography(longDisclosure.locator("p").first(), article);
  await expectNoPageOverflow(page);
  await article.screenshot({ path: testInfo.outputPath("annotations-320.png") });
});

test("scrolls long tab labels locally and brings keyboard selections into view", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await openNavigationLesson(page, boundarySource);
  const group = page.locator("[data-tabs]");
  const list = group.getByRole("tablist");
  const tabs = group.getByRole("tab");
  await expect(tabs).toHaveCount(5);
  const rows = await tabs.evaluateAll((elements) =>
    elements.map((element) => element.getBoundingClientRect().top),
  );
  expect(new Set(rows).size).toBe(1);
  const scroll = await list.evaluate((element) => ({
    width: element.clientWidth,
    content: element.scrollWidth,
  }));
  expect(scroll.content).toBeGreaterThan(scroll.width);
  await tabs.first().focus();
  await tabs.first().press("End");
  const last = tabs.last();
  await expect(last).toBeFocused();
  await expect(last).toHaveAttribute("aria-selected", "true");
  await expect(group.getByText("The boundary account.")).toBeVisible();
  const listBox = await bounds(list);
  const lastBox = await bounds(last);
  expect(lastBox.x).toBeGreaterThanOrEqual(listBox.x - 1);
  expect(lastBox.x + lastBox.width).toBeLessThanOrEqual(listBox.x + listBox.width + 1);
  await last.press("Home");
  await expect(tabs.first()).toBeFocused();
  await expect(group.getByText("A tip inside the selected panel.")).toBeVisible();
  await expectNoPageOverflow(page);
  await group.screenshot({ path: testInfo.outputPath("tabs-320.png") });
});

test("captures the same lesson in collapsed, expanded, and selected states for branch comparison", async ({
  page,
}, testInfo) => {
  await page.goto("/lessons/message-lifecycle");
  const article = page.getByRole("article");
  await expect(article.locator("[data-callout]")).toHaveCount(3);
  await page.screenshot({ path: testInfo.outputPath("lesson-collapsed.png"), fullPage: true });
  for (const summary of await article.locator("details > summary").all()) await summary.click();
  await expect(article.locator("details[open]")).toHaveCount(3);
  await page.screenshot({ path: testInfo.outputPath("lesson-expanded.png"), fullPage: true });
  const group = article.locator("[data-tabs]");
  await group.getByRole("tab").last().click();
  await expect(group.getByRole("tab").last()).toHaveAttribute("aria-selected", "true");
  await group.screenshot({ path: testInfo.outputPath("tabs-selected.png") });
  await group.getByRole("tab").last().press("Tab");
  await expect(group.getByRole("tabpanel")).toBeFocused();
  await group.screenshot({ path: testInfo.outputPath("tabs-keyboard-focus.png") });
  await expectNoPageOverflow(page);
});

test("keeps comparison concepts in sequential full-width article prose", async ({ page }) => {
  await page.goto("/lessons/message-lifecycle");
  const article = page.getByRole("article");
  await expect(article).toBeVisible();
  await expect(article.locator("[data-columns], [data-column]")).toHaveCount(0);
  const headings = article.locator(":scope > h3");
  await expect(headings).toHaveCount(2);
  const paragraphs = article.locator(":scope > h3 + p");
  await expect(paragraphs).toHaveCount(2);
  const first = await bounds(paragraphs.first());
  const second = await bounds(paragraphs.nth(1));
  const articleBox = await bounds(article);
  expect(second.y).toBeGreaterThan(first.y + first.height);
  expect(Math.abs(second.x - first.x)).toBeLessThan(1);
  expect(first.width).toBeGreaterThanOrEqual(articleBox.width * 0.95);
  expect(second.width).toBeGreaterThanOrEqual(articleBox.width * 0.95);
  await expectNoPageOverflow(page);
});
