import { expect, test } from "@playwright/test";

for (const colorScheme of ["light", "dark"] as const) {
  test(`keeps the overview and lesson light under a ${colorScheme} system preference`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ colorScheme });
    for (const [path, name] of [
      ["/", "overview"],
      ["/lessons/message-lifecycle", "lesson"],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
      for (const selector of ["body", "header"]) {
        const lightness = await page
          .locator(selector)
          .first()
          .evaluate((element) => {
            const color = getComputedStyle(element).backgroundColor;
            const channels = color.match(/\d+/g)?.slice(0, 3).map(Number) ?? [];
            return channels.reduce((sum, channel) => sum + channel, 0) / 3;
          });
        expect(lightness).toBeGreaterThan(240);
      }
      await expect(page.getByRole("button", { name: /theme|dark mode|light mode/i })).toHaveCount(
        0,
      );
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (colorScheme === "light") {
        await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
      }
    }
  });
}

test("presents a continuous serif article in a centered reading column", async ({ page }) => {
  await page.goto("/lessons/message-lifecycle");
  const article = page.getByRole("article");
  await expect(article).toBeVisible();
  const paragraph = article.locator("p").first();
  const typography = await paragraph.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      family: style.fontFamily,
      size: Number.parseFloat(style.fontSize),
      lineHeight: Number.parseFloat(style.lineHeight),
    };
  });
  expect(typography.family).toContain("Georgia");
  expect(typography.size).toBeGreaterThanOrEqual(16);
  expect(typography.size).toBeLessThanOrEqual(18);
  expect(typography.lineHeight / typography.size).toBeLessThanOrEqual(1.7);
  const borderedWrappers = await paragraph.evaluate((element) => {
    let count = 0;
    for (
      let parent = element.parentElement;
      parent && parent.tagName !== "ARTICLE";
      parent = parent.parentElement
    ) {
      const style = getComputedStyle(parent);
      if (Number.parseFloat(style.borderTopWidth) > 0) count += 1;
    }
    return count;
  });
  expect(borderedWrappers).toBe(0);
  const bounds = await article.boundingBox();
  if (!bounds) throw new Error("The article has no layout box.");
  expect(bounds.width).toBeLessThanOrEqual(760);
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("The reading viewport is missing.");
  expect(Math.abs(bounds.x - (viewport.width - bounds.width) / 2)).toBeLessThan(2);
});

test("keeps lesson and course titles compact", async ({ page }) => {
  const fontSize = (element: Element) => Number.parseFloat(getComputedStyle(element).fontSize);
  await page.goto("/lessons/message-lifecycle");
  expect(await page.getByRole("heading", { level: 1 }).evaluate(fontSize)).toBeLessThanOrEqual(36);
  await page.goto("/");
  expect(await page.getByRole("heading", { level: 1 }).evaluate(fontSize)).toBeLessThanOrEqual(48);
});
