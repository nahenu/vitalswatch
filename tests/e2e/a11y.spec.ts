import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { addSite, signUp } from "./helpers";

// Scan settled pages: entrance animations would otherwise be measured mid-fade.
// (This also exercises the reduced-motion styles.)
test.use({ contextOptions: { reducedMotion: "reduce" } });

/** Fails on serious and critical WCAG 2.x A/AA issues; lists them so the failure explains itself. */
async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const serious = violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")})`);
  expect(serious, serious.join("\n")).toEqual([]);
}

test("landing page", async ({ page }) => {
  await page.goto("/");
  // Hero copy fades in (opacity only under reduced motion); scan once it has landed.
  await page.waitForTimeout(1200);
  await expectAccessible(page);
});

test("sign in", async ({ page }) => {
  await page.goto("/sign-in");
  await expectAccessible(page);
});

test("overview and site report", async ({ page }) => {
  await signUp(page);
  await expectAccessible(page);
  await addSite(page);
  await expectAccessible(page);
});
