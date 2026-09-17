import { expect, test } from "@playwright/test";

test("saved versions restore both faces and uploaded artwork after reload", async ({ page }) => {
  await page.goto("/");
  const openSection = async (name: string) => {
    const toggle = page.getByRole("button", { name: `Toggle ${name} section`, exact: true });
    if (await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
  };
  await openSection("Garment");
  await openSection("Components");
  const showFront = () => page.getByRole("button", { name: "Show front", exact: true });
  const showBack = () => page.getByRole("button", { name: "Show back", exact: true });
  if (await showBack().isVisible()) await showBack().click();
  await showFront().click();
  await page.getByRole("button", { name: "Add text", exact: true }).click();
  await page.getByRole("textbox").fill("FRONT SAVED");
  await showBack().click();
  await page.getByRole("button", { name: "Add text", exact: true }).click();
  await page.getByRole("textbox").fill("BACK SAVED");
  // Real browser upload with distinctive opaque artwork.
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Click to upload an image or drag it onto the canvas", exact: true }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: "version-proof.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="#e02020"/></svg>') });
  await expect(page.getByRole("button", { name: "Select and move Artwork", exact: true })).toBeVisible();
  await page.keyboard.press("Enter");
  const pixels = () => page.locator('[data-merch-face="back"]').evaluate(node => (node as HTMLCanvasElement).toDataURL());
  // Wait for the uploaded image to actually paint, not merely appear as a layer.
  await expect.poll(() => page.locator('[data-merch-face="back"]').evaluate(node => {
    const canvas = node as HTMLCanvasElement;
    const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 0; i < data.length; i += 4) if (data[i] > 100 && data[i] > data[i + 1] * 2 && data[i + 3] > 0) return true;
    return false;
  })).toBe(true);
  const original = await pixels();
  await page.getByRole("button", { name: "Save State", exact: true }).click();
  await expect(page.getByRole("button", { name: "Restore Version 1", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delete version-proof", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect.poll(pixels).not.toBe(original);
  await page.getByRole("button", { name: "Save State", exact: true }).click();
  await expect(page.getByRole("button", { name: "Restore Version 2", exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Restore Version 1", exact: true }).click();
  await expect(page.getByRole("button", { name: "Select and move BACK SAVED", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Select and move Artwork", exact: true })).toBeVisible();
  await expect.poll(pixels).toBe(original);
  await showFront().click();
  await expect(page.getByRole("button", { name: "Select and move FRONT SAVED", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Select and move BACK SAVED", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Restore Before restore", exact: true })).toBeVisible();
});

test("versions can be deleted and the bottom-left panel drags and collapses upward", async ({ page }) => {
  await page.goto("/");
  const panel = page.locator('[data-toolcraft-versions-panel]');
  const initial = await panel.boundingBox();
  const workspace = await page.locator("[data-toolcraft-workspace]").boundingBox();
  expect(initial!.x).toBeCloseTo(workspace!.x + 10, 0);
  expect(initial!.y + initial!.height).toBeCloseTo(workspace!.y + workspace!.height - 10, 0);
  await page.getByRole("button", { name: "Save State", exact: true }).click();
  await expect(page.getByRole("button", { name: "Restore Version 1", exact: true })).toBeVisible();
  const expanded = await panel.boundingBox();
  await page.getByRole("button", { name: "Collapse Versions", exact: true }).click();
  const collapsed = await panel.boundingBox();
  expect(collapsed!.y).toBeCloseTo(expanded!.y, 0);
  expect(collapsed!.height).toBeLessThan(expanded!.height);
  const header = page.locator('[data-panel-id="versions"] [data-panel-drag-handle]');
  const box = await header.boundingBox();
  await page.mouse.move(box!.x + 45, box!.y + 18);
  await page.mouse.down();
  await page.mouse.move(box!.x + 205, box!.y - 102, { steps: 15 });
  await page.mouse.up();
  await expect.poll(async () => (await panel.boundingBox())!.x).toBeGreaterThan(collapsed!.x + 100);
  await page.getByRole("button", { name: "Expand Versions", exact: true }).click();
  await page.getByRole("button", { name: "Delete Version 1", exact: true }).click();
  await expect(page.getByRole("button", { name: "Restore Version 1", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Restore Version 1", exact: true })).toHaveCount(0);
  await expect(page.getByText("Save a state to start your history.")).toBeVisible();
});
