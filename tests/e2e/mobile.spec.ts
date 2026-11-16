import { expect, test, type Page } from "@playwright/test";
import { addSite, signUp } from "./helpers";

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test("landing page fits a phone, with the dock and both calls to action", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /Start free/ })).toBeVisible();
  await expectNoSidewaysScroll(page);
});

test("console works on a phone: top bar instead of the sidebar", async ({ page }) => {
  await signUp(page);
  await expect(page.getByRole("complementary")).toBeHidden();
  await addSite(page);
  await expectNoSidewaysScroll(page);
});
