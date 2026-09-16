import { expect, it } from "vitest";

import { NO_IMAGE_EFFECTS, type ImageEffectToggles } from "../design/tokens";
import { getEffectImage, recolorPixels } from "./image-effects";

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
