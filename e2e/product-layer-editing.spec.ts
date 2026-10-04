import type { Page } from "@playwright/test";
import { expect, test } from "./toolcraft-product-test";
import { createToolcraftBrowserProofSession } from "./browser-proof-session";
import { expectToolcraftProductObservableToChange } from "./product-observable-helpers";

const rows = (page: Page) => page.locator('[data-layer-list] > [data-layer-id]');
const selectedRows = (page: Page) => page.locator('[data-layer-list] > [data-selected="true"]');
const pixels = (page: Page) => page.locator('[data-merch-design-canvas]').evaluate(node => (node as HTMLCanvasElement).toDataURL());
async function prepare(page: Page) {
  await page.goto("/");
  await expect(page.locator('[data-merch-design-canvas]')).toBeVisible();
  // Clean the test browser's source defaults using ordinary layer commands.
  if (await rows(page).count()) {
    await rows(page).first().click();
    for (let index = 1; index < await rows(page).count(); index++) await rows(page).nth(index).click({ modifiers: ["Shift"] });
    await page.keyboard.press("Backspace");
    await expect(rows(page)).toHaveCount(0);
  }
  const add = page.getByRole("button", { name: "Add text", exact: true });
  if (!await add.isVisible()) await page.getByRole("button", { name: "Toggle Components section", exact: true }).click();
  await add.click();
  await page.getByRole("textbox").fill("ALPHA");
  await rows(page).first().click();
  await expect(page.getByRole("button", { name: "Select and move ALPHA", exact: true })).toBeVisible();
}
async function menu(page: Page, action: string) {
  await page.getByRole("menuitem", { name: action, exact: action !== "Copy" && action !== "Paste" && action !== "Delete" }).click();
}

test("browser: component clipboard shortcuts and context menus preserve native text editing", async ({ page }) => {
  await prepare(page);
  await rows(page).first().click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: /^Paste/ })).toBeDisabled();
  await page.keyboard.press("Escape");
  await rows(page).first().click();
  await page.keyboard.press("Control+c");
  const session = await createToolcraftBrowserProofSession(page);
  await expectToolcraftProductObservableToChange(session, session.action(async () => {
    await page.keyboard.press("Control+v");
    await expect(rows(page)).toHaveCount(2);
  }), { requirementId: "component.clipboard", selector: "[data-merch-design-canvas]" });
  await expect(selectedRows(page)).toHaveCount(1);
  await page.keyboard.press("Control+z");
  await expect(rows(page)).toHaveCount(1);
  await page.keyboard.press("Control+Shift+z");
  await expect(rows(page)).toHaveCount(2);
  await page.keyboard.press("Backspace");
  await expect(rows(page)).toHaveCount(1);
  await page.keyboard.press("Control+z");
  await expect(rows(page)).toHaveCount(2);

  // Native text copy/delete/paste must edit content without touching layers.
  const text = page.getByRole("textbox");
  await text.fill("NATIVE");
  await text.press("ControlOrMeta+a");
  await text.press("ControlOrMeta+c");
  await text.press("Backspace");
  await expect(text).toHaveValue("");
  await expect(rows(page)).toHaveCount(2);
  await text.press("ControlOrMeta+v");
  await expect(text).toHaveValue("NATIVE");
  await rows(page).first().click();
  await page.keyboard.press("Meta+c");
  await page.keyboard.press("Meta+v");
  await expect(rows(page)).toHaveCount(3);

  const body = page.getByRole("button", { name: "Select and move NATIVE", exact: true }).last();
  await body.click({ button: "right" });
  await menu(page, "Duplicate");
  await expect(rows(page)).toHaveCount(4);
  await rows(page).first().click({ button: "right" });
  await menu(page, "Copy");
  await rows(page).first().click({ button: "right" });
  await menu(page, "Paste");
  await expect(rows(page)).toHaveCount(5);
  await rows(page).first().click({ button: "right" });
  await menu(page, "Delete");
  await expect(rows(page)).toHaveCount(4);
});

test("browser: Shift selection groups and merges editable components through reload", async ({ page }) => {
  await prepare(page);
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  await page.getByRole("textbox").fill("BETA");
  await rows(page).first().click();
  await rows(page).nth(1).click({ modifiers: ["Shift"] });
  await expect(selectedRows(page)).toHaveCount(2);
  await expect(page.locator('[data-merch-multi-selection]')).toHaveCount(2);
  await rows(page).first().click({ button: "right" });
  await expect(selectedRows(page)).toHaveCount(2);
  await menu(page, "Group selected layers");
  await expect(rows(page)).toHaveCount(3);
  const groupId = await rows(page).first().getAttribute("data-layer-id");
  await expect(rows(page).nth(1)).toHaveAttribute("data-template-layer-parent", groupId!);
  await expect(rows(page).nth(2)).toHaveAttribute("data-template-layer-parent", groupId!);
  await page.keyboard.press("Control+z");
  await expect(rows(page)).toHaveCount(2);
  await expect(selectedRows(page)).toHaveCount(2);
  const before = await pixels(page);
  await rows(page).first().click({ button: "right" });
  await menu(page, "Merge selected layers");
  await expect(rows(page)).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Select and move Merged component", exact: true })).toBeVisible();
  // Same authored pieces paint identically before their merged transform changes.
  expect(await pixels(page)).toBe(before);
  const session = await createToolcraftBrowserProofSession(page);
  const merged = page.getByRole("button", { name: "Select and move Merged component", exact: true });
  await expectToolcraftProductObservableToChange(session, session.action(async () => {
    const box = (await merged.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 45, box.y + box.height / 2 + 25, { steps: 4 });
    await page.mouse.up();
  }), { requirementId: "component.merge", selector: "[data-merch-design-canvas]" });
  const moved = await pixels(page);
  await expect(page.locator('[data-slot="toolcraft-runtime-app"]')).toHaveAttribute("data-toolcraft-persistence-status", "success");
  await page.reload();
  await expect(merged).toBeVisible();
  await expect.poll(() => pixels(page)).toBe(moved);
  await merged.click({ button: "right" });
  await menu(page, "Separate components");
  await expect(rows(page)).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Select and move ALPHA", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Select and move BETA", exact: true })).toBeVisible();
  await rows(page).first().click();
  await page.getByRole("textbox").fill("STILL EDITABLE");
  await expect(page.getByRole("button", { name: "Select and move STILL EDITABLE", exact: true })).toBeVisible();
  // Shift canvas presses use the same selection as layer rows.
  await page.getByRole("button", { name: "Select and move ALPHA", exact: true }).click({ modifiers: ["Shift"], position: { x: 1, y: 1 } });
  await expect(selectedRows(page)).toHaveCount(2);
});
