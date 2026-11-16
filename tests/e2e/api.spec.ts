import { expect, test } from "@playwright/test";
import { addSite, signUp } from "./helpers";

test("deploy webhook: needs a valid token, records the deploy and tests the page", async ({ page, request }) => {
  await signUp(page);
  const { id } = await addSite(page);

  expect((await request.post("/api/deploys", { data: { ref: "abc123" } })).status()).toBe(401);
  expect((await request.post("/api/deploys", { headers: { Authorization: "Bearer vw_wrong" }, data: { ref: "abc123" } })).status()).toBe(401);

  // Read the real token from Settings → Deploys.
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Deploys" }).click();
  const token = (await page.getByRole("dialog").locator("code").first().innerText()).trim();
  expect(token).toMatch(/^vw_/);

  const ok = await request.post("/api/deploys", { headers: { Authorization: `Bearer ${token}` }, data: { ref: "a1b2c3d", message: "Ship new hero" } });
  expect(ok.status()).toBe(202);
  expect(await ok.json()).toMatchObject({ ok: true, site: id, checking: true });

  await page.keyboard.press("Escape");
  await expect(async () => {
    await page.reload();
    await expect(page.locator("section[aria-labelledby=deploys-h]").getByText("Ship new hero")).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
});

test("daily cron only runs with the secret", async ({ request }) => {
  expect((await request.get("/api/cron/checks")).status()).toBe(401);
  const res = await request.get("/api/cron/checks", { headers: { Authorization: "Bearer e2e-cron-secret" } });
  expect(res.status()).toBe(200);
  expect(await res.json()).toHaveProperty("checked");
});
