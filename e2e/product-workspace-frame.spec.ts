import { expect, test } from "@playwright/test";

test("workspace frame contains panels and branding adapts to the theme", async ({ page }) => {
  await page.goto("/");
  const header = page.getByRole("banner", { name: "Merch Studio" });
  await expect(header).toBeVisible();
  expect((await header.boundingBox())!.height).toBe(48);
  const workspace = await page.locator('[data-toolcraft-workspace]').boundingBox();
  expect(workspace!.x).toBe(8);
  expect(workspace!.y).toBe(48);
  expect(workspace!.width).toBe(page.viewportSize()!.width - 16);
  expect(workspace!.y + workspace!.height).toBe(page.viewportSize()!.height - 8);
  const logo = page.getByRole("img", { name: "Infisical", exact: true });
  await expect(logo).toHaveCSS("mask-image", /full_logo_black.svg/);
  await expect(header.getByText("Merch Studio", { exact: true })).toHaveCSS("font-family", /Alliance No.2/);
  const lightToggle = page.getByRole("button", { name: "Light theme", exact: true });
  if (await lightToggle.count()) await lightToggle.click();
  await expect(logo).toHaveCSS("background-color", "rgb(0, 0, 0)");
  await page.getByRole("button", { name: "Dark theme", exact: true }).click();
  await expect(logo).toHaveCSS("background-color", "rgb(228, 228, 231)");
  const controls = page.locator('[data-panel-id="controls"]');
  const rect = await controls.boundingBox();
  expect(rect!.y).toBeGreaterThanOrEqual(workspace!.y + 10);
  expect(rect!.y + rect!.height).toBeLessThanOrEqual(workspace!.y + workspace!.height - 9);
  await expect(page.getByRole("button", { name: "Export PNG", exact: true })).toBeInViewport();
});
