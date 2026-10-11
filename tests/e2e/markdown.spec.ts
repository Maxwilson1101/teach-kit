import { expect, test } from "@playwright/test";
import { openNavigationLesson } from "../helpers/navigation-page";

test("renders Markdown and nested teaching components without errors or overflow", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("http://127.0.0.1:4323");

  await expect(page.getByRole("heading", { name: "Renderer fixture" })).toBeVisible();
  await expect(page.locator("li").first().locator("p")).toHaveText([
    "First paragraph.",
    "Second paragraph.",
  ]);
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.locator("pre code")).toHaveText("const shared = true;");
  await expect(page.getByText("Shared pipeline", { exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Transport" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByText("Relayers move messages.")).toBeVisible();
  await expect(page.getByText("Security modules verify them.")).toBeHidden();
  await expect(page.getByText("Left comparison.")).toBeVisible();
  await expect(page.getByText("Right comparison.")).toBeVisible();

  const left = await page.getByText("Left comparison.").boundingBox();
  const right = await page.getByText("Right comparison.").boundingBox();
  expect(left).not.toBeNull();
  expect(right).not.toBeNull();
  if (!left || !right) throw new Error("Comparison paragraphs have no layout boxes.");
  expect(right.y).toBeGreaterThan(left.y + left.height);
  expect(Math.abs(right.x - left.x)).toBeLessThan(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("markdown.png"), fullPage: true });
});

test("renders inline and display math with KaTeX without overflow", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await openNavigationLesson(
    page,
    [
      "## Formula",
      "",
      "Inline math $E = mc^2$ stays in the line.",
      "",
      "$$",
      "\\int_0^1 x^2\\,dx = \\frac{1}{3}",
      "$$",
    ].join("\n"),
  );

  await expect(page.locator(".katex").first()).toBeVisible();
  await expect(page.locator(".katex-display")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("math.png"), fullPage: true });
});

test("highlights fenced code with the lesson token colors", async ({ page }, testInfo) => {
  await openNavigationLesson(
    page,
    ["## Snippet", "", "```ts", "const answer: number = 42;", "```"].join("\n"),
  );

  const keyword = page.locator(".lesson-prose .hljs-keyword").first();
  await expect(keyword).toHaveText("const");
  await expect(keyword).toHaveCSS("color", "rgb(24, 115, 60)");
  await page.screenshot({ path: testInfo.outputPath("code.png"), fullPage: true });
});

test("renders a Mermaid diagram as inline SVG without remote requests", async ({
  page,
}, testInfo) => {
  const external: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).hostname !== "127.0.0.1") external.push(request.url());
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/lessons/message-lifecycle");

  await expect(page.locator(".mermaid-figure svg")).toBeVisible();
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
  await page.locator(".mermaid-figure").screenshot({ path: testInfo.outputPath("mermaid.png") });
});
