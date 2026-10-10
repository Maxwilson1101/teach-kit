import { expect, test } from "@playwright/test";

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
  if (!left || !right) throw new Error("Comparison columns have no layout boxes.");
  if (testInfo.project.name === "mobile-chromium") {
    expect(right.y).toBeGreaterThan(left.y);
  } else {
    expect(right.x).toBeGreaterThan(left.x);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("markdown.png"), fullPage: true });
});
