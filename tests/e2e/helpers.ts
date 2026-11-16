import { expect, type Page } from "@playwright/test";

export const PASSWORD = "e2e-password-123";

export function uniqueEmail(prefix = "user") {
  return `${prefix}+${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

/** Creates a fresh account and lands on the (empty) overview. */
export async function signUp(page: Page, name = "Test User") {
  const email = uniqueEmail(name.split(" ")[0].toLowerCase());
  await page.goto("/sign-up");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return { email, password: PASSWORD };
}

/**
 * Adds a page from the overview and waits for its first run. The test server
 * replaces PageSpeed Insights with a deterministic fake (PSI_MOCK), so runs
 * finish instantly and never call Google.
 */
export async function addSite(page: Page, host = `shop-${Math.random().toString(36).slice(2, 7)}.example.com`) {
  await page.getByRole("main").getByRole("button", { name: "Add a page" }).click();
  await page.getByLabel("Page address").fill(host);
  await page.getByRole("button", { name: "Start watching" }).click();
  await expect(page).toHaveURL(/\/sites\/[A-Za-z0-9]+/);
  await expect(page.getByText(/Done: mobile \d+, desktop \d+/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Run history" })).toBeVisible();
  const id = new URL(page.url()).pathname.split("/").pop()!;
  return { id, host };
}
