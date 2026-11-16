import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

test("sign up lands on an empty overview, sign out and back in", async ({ page }) => {
  const { email, password } = await signUp(page, "Asha Rao");
  await expect(page.getByRole("heading", { name: "Nothing on the monitor yet" })).toBeVisible();

  await page.getByRole("button", { name: "Account menu" }).first().click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/sign-in");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("wrong password shows a clear error", async ({ page }) => {
  const { email } = await signUp(page);
  await page.context().clearCookies();
  await page.goto("/sign-in");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("That email and password don't match.")).toBeVisible();
});

test("the console requires an account", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fdashboard$/);
});
