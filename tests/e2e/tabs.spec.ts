import { expect, type Page, test } from "@playwright/test";

const browserErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("http://127.0.0.1:4323");
  await expect(page.getByRole("tab", { name: "Transport", exact: true })).toBeVisible();
});

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page)).toEqual([]);
});

test("switches panels by pointer or touch while keeping inactive content mounted and hidden", async ({
  page,
  isMobile,
}) => {
  const group = page.locator("[data-tabs]").first();
  const verification = group.getByRole("tab", { name: "Verification", exact: true });
  if (isMobile) await verification.tap();
  else await verification.click();

  await expect(verification).toHaveAttribute("aria-selected", "true");
  await expect(group.getByText("Security modules verify them.")).toBeVisible();
  await expect(group.getByText("Relayers move messages.")).toBeHidden();
  await expect(group.locator('[role="tabpanel"]')).toHaveCount(3);
  await expect(group.locator('[role="tabpanel"]:not([hidden])')).toHaveCount(1);
  await expect(group.locator("details")).toHaveCount(1);
  await expect(group.locator("details")).toBeHidden();
});

test("uses automatic keyboard activation, wraparound, and a focusable selected panel", async ({
  page,
}) => {
  const group = page.locator("[data-tabs]").first();
  const transport = group.getByRole("tab", { name: "Transport", exact: true });
  const verification = group.getByRole("tab", { name: "Verification", exact: true });
  const execution = group.getByRole("tab", { name: "Execution", exact: true });
  await transport.focus();
  await transport.press("ArrowRight");
  await expect(verification).toBeFocused();
  await expect(verification).toHaveAttribute("aria-selected", "true");
  await expect(verification).toHaveAttribute("tabindex", "0");
  await expect(transport).toHaveAttribute("tabindex", "-1");
  await verification.press("End");
  await expect(execution).toBeFocused();
  await expect(execution).toHaveAttribute("aria-selected", "true");
  await execution.press("Home");
  await expect(transport).toBeFocused();
  await transport.press("ArrowLeft");
  await expect(execution).toBeFocused();
  await execution.press("ArrowRight");
  await expect(transport).toBeFocused();
  await transport.press("ArrowDown");
  await expect(transport).toBeFocused();
  await expect(transport).toHaveAttribute("aria-selected", "true");
  await transport.press("Tab");
  await expect(group.getByRole("tabpanel")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(transport).toBeFocused();
});

test("preserves disclosure state across tab switches and supports Enter and Space", async ({
  page,
}) => {
  const group = page.locator("[data-tabs]").first();
  const disclosure = group.locator("details");
  const summary = disclosure.locator("summary");
  await summary.focus();
  await summary.press("Enter");
  await expect(disclosure).toHaveAttribute("open", "");
  await expect(group.getByText("Transport does not imply verification.")).toBeVisible();
  await summary.press("Space");
  await expect(disclosure).not.toHaveAttribute("open");
  await summary.click();
  await expect(disclosure).toHaveAttribute("open", "");
  await group.getByRole("tab", { name: "Verification", exact: true }).click();
  await expect(disclosure).toBeHidden();
  await group.getByRole("tab", { name: "Transport", exact: true }).click();
  await expect(disclosure).toHaveAttribute("open", "");
  await expect(group.getByText("Transport does not imply verification.")).toBeVisible();
});

test("keeps groups independent and gives every tab a unique matching panel", async ({ page }) => {
  const groups = page.locator("[data-tabs]");
  await expect(groups).toHaveCount(2);
  await groups.nth(1).getByRole("tab", { name: "Example B" }).click();
  await expect(groups.nth(1).getByText("Second example.")).toBeVisible();
  await expect(groups.first().getByRole("tab", { name: "Transport", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const links = await page.locator('[role="tab"]').evaluateAll((tabs) =>
    tabs.map((tab) => {
      const panel = document.getElementById(tab.getAttribute("aria-controls") ?? "");
      return { id: tab.id, matches: panel?.getAttribute("aria-labelledby") === tab.id };
    }),
  );
  expect(new Set(links.map((link) => link.id)).size).toBe(links.length);
  expect(links.every((link) => link.matches)).toBe(true);
});
