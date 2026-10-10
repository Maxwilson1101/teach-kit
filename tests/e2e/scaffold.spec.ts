import { expect, test } from "@playwright/test";

test("renders the scaffold without browser errors or horizontal overflow", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");

  await expect(page).toHaveTitle("Teach Kit");
  await expect(page.getByRole("heading", { name: "Teach Kit" })).toBeVisible();
  await expect(page.getByText("Course loading and Markdown rendering are not implemented yet.", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
