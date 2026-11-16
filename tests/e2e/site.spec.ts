import { expect, test } from "@playwright/test";
import { addSite, signUp } from "./helpers";

// Share copies the report link.
test.use({ permissions: ["clipboard-read", "clipboard-write"] });

test("adding a page runs a first check and shows the full report", async ({ page }) => {
  await signUp(page);
  const { host } = await addSite(page);

  await expect(page.getByRole("heading", { level: 1, name: host })).toBeVisible();
  // Sidebar lists the new site with its score.
  await expect(page.getByRole("complementary").getByRole("link", { name: new RegExp(host) })).toBeVisible();

  // "Why it's slow": LCP element, issues with real files and a code fix.
  const diag = page.locator("section[aria-labelledby=diag-h]");
  await expect(diag.getByRole("heading", { name: "Largest Contentful Paint element" })).toBeVisible();
  await expect(diag.getByText(`https://${host}/images/hero-sofa.jpg`).first()).toBeVisible();
  const firstIssue = diag.locator("details").first();
  await expect(firstIssue).toHaveAttribute("open", "");
  await expect(firstIssue.getByText("Why it matters")).toBeVisible();
  await expect(firstIssue.locator("pre").first()).toContainText(host);

  // One run so far: the chart explains that the trend starts tomorrow.
  await expect(page.getByText("The trend starts with the next run")).toBeVisible();
});

test("adding the same page twice is refused, bad addresses are explained", async ({ page }) => {
  await signUp(page);
  const { host } = await addSite(page);
  await page.goto("/dashboard");
  await page.getByRole("main").getByRole("button", { name: "Add a page" }).click();
  await page.getByLabel("Page address").fill(host);
  await page.getByRole("button", { name: "Start watching" }).click();
  await expect(page.getByText("You're already watching this page.")).toBeVisible();
  await page.getByLabel("Page address").fill("localhost:3000");
  await page.getByRole("button", { name: "Start watching" }).click();
  await expect(page.getByText("This page isn't on the public internet, so Google can't test it.")).toBeVisible();
});

test("record a deploy by hand: it's tested and listed with its before/after", async ({ page }) => {
  await signUp(page);
  await addSite(page);
  const deploys = page.locator("section[aria-labelledby=deploys-h]");
  await expect(deploys.getByText(/No deploys yet/)).toBeVisible();

  await deploys.getByRole("button", { name: "Record a deploy" }).click();
  await page.getByLabel("What changed?").fill("New homepage banner");
  await page.getByRole("button", { name: "Record and test now" }).click();
  await expect(page.getByText(/Deploy recorded/)).toBeVisible({ timeout: 20_000 });
  await expect(deploys.getByText("New homepage banner")).toBeVisible();
});

test("share makes a read-only report anyone can open, and the PDF downloads", async ({ page, browser }) => {
  await signUp(page);
  const { id, host } = await addSite(page);

  await page.getByRole("button", { name: "Share" }).click();
  await page.getByRole("button", { name: "Make public and copy link" }).click();
  await expect(page.getByText("Report link copied")).toBeVisible();

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download PDF" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^vitalswatch-.+-mobile-\d{4}-\d{2}-\d{2}\.pdf$/);

  // A visitor with no account sees the report, but no owner actions.
  const visitor = await browser.newContext();
  const anon = await visitor.newPage();
  await anon.goto(`/r/${id}`);
  await expect(anon.getByRole("heading", { level: 1, name: host })).toBeVisible();
  await expect(anon.getByRole("button", { name: "Record a deploy" })).toHaveCount(0);
  await expect(anon.getByRole("button", { name: "Settings" })).toHaveCount(0);
  await visitor.close();
});

test("private reports and PDFs stay private", async ({ page, browser }) => {
  await signUp(page);
  const { id } = await addSite(page);
  const visitor = await browser.newContext();
  const anon = await visitor.newPage();
  await anon.goto(`/r/${id}`);
  await expect(anon.getByRole("heading", { name: "No signal on this page." })).toBeVisible();
  expect((await anon.request.get(`/api/reports/${id}/pdf`)).status()).toBe(404);
  await visitor.close();
});

test("settings explain alerts with the page's own score, and delete removes the site", async ({ page }) => {
  await signUp(page);
  const { host } = await addSite(page);
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Alerts" }).click();
  await expect(page.getByText(/Your mobile score is \d+ now\. With this setting you'd get one email if it falls to \d+ or lower\./)).toBeVisible();
  await page.getByRole("tab", { name: "General" }).click();
  await page.getByRole("button", { name: "Delete this site" }).click();
  await page.getByRole("button", { name: "Delete site" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("complementary").getByRole("link", { name: new RegExp(host) })).toHaveCount(0);
});
