import { expect, test } from "./toolcraft-product-test";
import { createToolcraftBrowserProofSession } from "./browser-proof-session";
import { expectToolcraftProductObservableToChange } from "./product-observable-helpers";

test("browser: garment flips between retained faces and tilts on hover", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Enter");
  const flip = page.getByRole("button", { name: "Show back", exact: true });
  const surface = page.locator("[data-merch-design-surface]");
  const plane = page.locator("[data-merch-plane]");
  const tilt = page.locator("[data-merch-tilt]");
  await expect(page.locator("[data-merch-face]")).toHaveCount(2);
  await expect.poll(() => page.locator("[data-merch-face]").evaluateAll((nodes) =>
    nodes.every((node) => {
      const c = node as HTMLCanvasElement;
      return c.getContext("2d")!.getImageData(c.width / 2, c.height / 2, 1, 1).data[3] > 0;
    }),
  )).toBe(true);
  await expect(flip).toBeVisible();
  const identity = "matrix(1, 0, 0, 1, 0, 0)";
  await expect.poll(() => plane.evaluate((node) => getComputedStyle(node).transform)).toBe(identity);
  const session = await createToolcraftBrowserProofSession(page);
  await expectToolcraftProductObservableToChange(session,
    session.controlAction("garment.view", async () => {
      await flip.click();
      await expect.poll(() => plane.evaluate((node) => {
        const m = new DOMMatrix(getComputedStyle(node).transform);
        return m.m11 < 0.98 && m.m11 > -0.98;
      })).toBe(true);
      await expect.poll(() => plane.evaluate((node) => new DOMMatrix(getComputedStyle(node).transform).m11)).toBe(-1);
    }), { requirementId: "garment.view", selector: "[data-merch-design-surface]" });

  // Reverse while still turning: the transition retains the same two canvases.
  const retainedFront = await page.locator('[data-merch-face="front"]').elementHandle();
  const showFront = page.getByRole("button", { name: "Show front", exact: true });
  await showFront.click();
  await page.getByRole("button", { name: "Show back", exact: true }).click();
  await page.getByRole("button", { name: "Show front", exact: true }).click();
  await expect.poll(() => plane.evaluate((node) => getComputedStyle(node).transform)).toBe(identity);
  expect(await retainedFront!.evaluate((node) => node === document.querySelector('[data-merch-face="front"]'))).toBe(true);

  const bounds = (await surface.boundingBox())!;
  const flat = await surface.screenshot();
  await page.mouse.move(bounds.x + bounds.width * 0.7, bounds.y + bounds.height * 0.3);
  await expect.poll(() => tilt.evaluate((node) => new DOMMatrix(getComputedStyle(node).transform).m13)).toBeLessThan(-0.01);
  await expect.poll(() => tilt.evaluate((node) => new DOMMatrix(getComputedStyle(node).transform).m23)).toBeGreaterThan(0.01);
  expect((await surface.screenshot()).equals(flat)).toBe(false);
  await page.mouse.move(0, 0);
  await expect.poll(() => tilt.evaluate((node) => getComputedStyle(node).transform)).toBe(identity);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Show back", exact: true }).click();
  await expect(plane).toHaveCSS("transition-duration", "0s");
  await page.mouse.move(bounds.x + bounds.width * 0.7, bounds.y + bounds.height * 0.3);
  await expect(tilt).toHaveCSS("transform", identity);
  await expect.poll(() => plane.evaluate((node) => new DOMMatrix(getComputedStyle(node).transform).m11)).toBe(-1);

  // Different records on each side must never paint or expose handles together.
  const facePixels = (side: string) => page.locator(`[data-merch-face="${side}"]`)
    .evaluate((node) => (node as HTMLCanvasElement).toDataURL());
  await page.getByRole("button", { name: "Show front", exact: true }).click();
  const addText = page.getByRole("button", { name: "Add text", exact: true });
  if (!await addText.isVisible()) {
    await page.getByRole("button", { name: "Toggle Components section", exact: true }).click();
  }
  await addText.click();
  await page.getByRole("textbox").fill("FRONT ONLY");
  await expect(page.getByRole("button", { name: "Select and move FRONT ONLY", exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Show back", exact: true }).click();
  await expect(page.getByRole("button", { name: "Select and move FRONT ONLY", exact: true })).toHaveCount(0);
  const frontPixels = await facePixels("front");
  const emptyBack = await facePixels("back");
  await addText.click();
  await page.getByRole("textbox").fill("BACK ONLY");
  await expect.poll(() => facePixels("back")).not.toBe(emptyBack);
  expect(await facePixels("front")).toBe(frontPixels);
  await page.getByRole("button", { name: "Show front", exact: true }).click();
  await expect(page.getByRole("button", { name: "Select and move BACK ONLY", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Select and move FRONT ONLY", exact: true })).toHaveCount(1);
});
