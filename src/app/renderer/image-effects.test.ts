import { expect, it } from "vitest";

import { NO_IMAGE_EFFECTS, type ImageEffectToggles } from "../design/tokens";
import { ditherPixels, getEffectImage, recolorPixels, asciiRampIndex } from "./image-effects";

it("recolors a dark, opaque pixel to near-opaque ink", () => {
  const data = new Uint8ClampedArray([0, 0, 0, 255]);

  recolorPixels(data, "#00ff00");

  expect([...data]).toEqual([0, 255, 0, 255]);
});

it("recolors a light, opaque pixel to near-transparent ink", () => {
  const data = new Uint8ClampedArray([255, 255, 255, 255]);

  recolorPixels(data, "#00ff00");

  expect(data[0]).toBe(0);
  expect(data[1]).toBe(255);
  expect(data[2]).toBe(0);
  expect(data[3]).toBe(0);
});

it("scales alpha for a mid-gray pixel and leaves already-transparent pixels alone", () => {
  const midGray = new Uint8ClampedArray([128, 128, 128, 200]);

  recolorPixels(midGray, "#ff0000");

  expect(midGray[3]).toBeGreaterThan(0);
  expect(midGray[3]).toBeLessThan(200);

  const transparent = new Uint8ClampedArray([10, 20, 30, 0]);

  recolorPixels(transparent, "#ff0000");

  expect([...transparent]).toEqual([10, 20, 30, 0]);
});

it("passes the source through unchanged when no effect is on", () => {
  const source = { height: 20, image: {} as CanvasImageSource, width: 20 };

  expect(getEffectImage(source, NO_IMAGE_EFFECTS, 12, "#ff0000", "")).toBe(
    source,
  );
});

it("still passes the source through when every toggle is explicitly false", () => {
  const source = { height: 20, image: {} as CanvasImageSource, width: 20 };
  const toggles: ImageEffectToggles = {
    ascii: false,
    pixelate: false,
    recolor: false,
  };

  expect(getEffectImage(source, toggles, 12, "#ff0000", "")).toBe(source);
});

function fillGray(width: number, height: number, value: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let index = 0; index < data.length; index += 4) {
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
    data[index + 3] = 255;
  }

  return data;
}

function assertBinaryInk(data: Uint8ClampedArray, ink: readonly [number, number, number]) {
  let on = 0;
  let off = 0;

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3]!;

    expect(alpha === 0 || alpha === 255).toBe(true);

    if (alpha === 0) {
      off += 1;
      continue;
    }

    on += 1;
    expect(data[index]).toBe(ink[0]);
    expect(data[index + 1]).toBe(ink[1]);
    expect(data[index + 2]).toBe(ink[2]);
  }

  expect(on).toBeGreaterThan(0);
  expect(off).toBeGreaterThan(0);
}

it("dithers selected artwork to ink or empty cells", () => {
  const ink = [0, 255, 0] as const;

  for (const mode of ["bayer", "floyd", "random"] as const) {
    const data = fillGray(8, 8, 128);

    ditherPixels(data, 8, 8, mode, "#00ff00");
    assertBinaryInk(data, ink);
  }

  const first = fillGray(6, 4, 128);
  const second = fillGray(6, 4, 128);

  ditherPixels(first, 6, 4, "random", "#00ff00");
  ditherPixels(second, 6, 4, "random", "#00ff00");
  expect([...first]).toEqual([...second]);
});

it("spreads ASCII coverage across the full glyph ramp for contrast", () => {
  const rampLength = 10;

  expect(asciiRampIndex(0, rampLength)).toBe(-1);
  expect(asciiRampIndex(0.02, rampLength)).toBe(-1);
  expect(asciiRampIndex(0.25, rampLength)).toBe(2);
  expect(asciiRampIndex(0.5, rampLength)).toBe(5);
  expect(asciiRampIndex(0.95, rampLength)).toBe(9);
  expect(asciiRampIndex(1, rampLength)).toBe(9);
});
