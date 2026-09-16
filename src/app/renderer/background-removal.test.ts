import { expect, it } from "vitest";

import { removeEdgeConnectedBackgroundPixels } from "./background-removal";

function opaquePixels(rows: readonly (readonly string[])[]): Uint8ClampedArray {
  const values: number[] = [];

  for (const row of rows) {
    for (const color of row) {
      const value = color === "white" ? 255 : 0;
      values.push(value, value, value, 255);
    }
  }

  return new Uint8ClampedArray(values);
}

it("clears only background-colored pixels connected to an image edge", () => {
  const pixels = opaquePixels([
    ["white", "white", "white", "white", "white"],
    ["white", "black", "black", "black", "white"],
    ["white", "black", "white", "black", "white"],
    ["white", "black", "black", "black", "white"],
    ["white", "white", "white", "white", "white"],
  ]);

  removeEdgeConnectedBackgroundPixels(pixels, 5, 5);

  expect(pixels[3]).toBe(0);
  expect(pixels[(2 * 5 + 2) * 4 + 3]).toBe(255);
  expect(pixels[(1 * 5 + 1) * 4 + 3]).toBe(255);
});

it("leaves an already transparent border unchanged", () => {
  const pixels = new Uint8ClampedArray([
    0, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0,
    255, 0, 0, 255,
    0, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0,
  ]);

  removeEdgeConnectedBackgroundPixels(pixels, 3, 3);

  expect([...pixels]).toEqual([
    0, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0,
    255, 0, 0, 255,
    0, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0,
  ]);
});

it("feathers edge blends and takes the backdrop color back out", () => {
  // White border around one pixel that is 50/50 white and pure red.
  const blend = [255, 128, 128, 255];
  const white = [255, 255, 255, 255];
  const red = [255, 0, 0, 255];
  const pixels = new Uint8ClampedArray([
    ...white, ...white, ...white, ...white,
    ...white, ...blend, ...red, ...white,
    ...white, ...white, ...white, ...white,
  ]);

  removeEdgeConnectedBackgroundPixels(pixels, 4, 3);

  // The pure white is cleared, the red survives untouched.
  expect(pixels[3]).toBe(0);
  expect([...pixels.slice(24, 28)]).toEqual(red);

  // The blend (distance ~180) is outside the fill, so it stays opaque; a
  // near-white blend inside the fill turns partially transparent instead.
  expect(pixels[23]).toBe(255);

  const faint = new Uint8ClampedArray([
    ...white, ...white, ...white,
    ...white, 255, 220, 220, 255, ...white,
    ...white, ...white, ...white,
  ]);

  removeEdgeConnectedBackgroundPixels(faint, 3, 3);

  const alpha = faint[19]!;
  expect(alpha).toBeGreaterThan(0);
  expect(alpha).toBeLessThan(255);
  // De-blended toward red rather than left as a pale fringe.
  expect(faint[17]!).toBeLessThan(220);
});
