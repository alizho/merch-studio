import { expect, it } from "vitest";

import { isSvgType, resolveSvgRaster } from "./svg-raster";

it("recognizes SVG mime types", () => {
  expect(isSvgType("image/svg+xml")).toBe(true);
  expect(isSvgType("image/svg+xml;charset=utf-8")).toBe(true);
  expect(isSvgType("image/png")).toBe(false);
  expect(isSvgType(undefined)).toBe(false);
});

it("uses explicit width and height, adding a viewBox so content scales", () => {
  expect(
    resolveSvgRaster({ height: "200", width: "400px" }, 1000),
  ).toEqual({ height: 500, viewBox: "0 0 400 200", width: 1000 });
});

it("keeps an authored viewBox and takes its ratio when size is missing", () => {
  expect(
    resolveSvgRaster({ viewBox: "0 0 120 360" }, 900),
  ).toEqual({ height: 900, width: 300 });
});

it("ignores relative lengths in favor of the viewBox", () => {
  expect(
    resolveSvgRaster({ height: "100%", viewBox: "0,0,50,25", width: "100%" }, 100),
  ).toEqual({ height: 50, width: 100 });
});

it("falls back to the 2:1 default for unsized SVG", () => {
  expect(resolveSvgRaster({}, 300)).toEqual({ height: 150, width: 300 });
});
