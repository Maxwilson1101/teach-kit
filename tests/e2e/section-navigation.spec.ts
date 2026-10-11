import { expect, test } from "@playwright/test";
import { openNavigationLesson } from "../helpers/navigation-page";

const titles = [
  "Transport is not verification",
  "Follow one message",
  "Two different questions",
  "Authenticity is not authorization",
  "Check your understanding",
  "Further reading",
];

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
