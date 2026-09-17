/**
 * Recolor, Pixelate, and ASCII effects for imported images.
 *
 * Each effect bakes its result into a bitmap the same way the cutout does
 * (see `background-removal.ts`): it runs once per source image and settings
 * combination, then is cached, so dragging, resizing, or recoloring the
 * garment never repeats the work.
 *
 * Pixelate is a 1-bit dither: every cell is either fully the effect ink or
 * fully empty. Recolor and ASCII both draw in the effect's own ink, already
 * resolved to a final color, so the print treatment's `preserveColor` path
 * can draw them unchanged. Embroidery always re-tints everything to one
 * thread color regardless, so it is unaffected either way.
 */

import { hexToRgb } from "./raster";
import {
  DEFAULT_ASCII_CHARSET,
  DEFAULT_DITHER_MODE,
  DEFAULT_EFFECT_BLACK_POINT,
  DEFAULT_EFFECT_BLUR,
  DEFAULT_EFFECT_GAMMA,
  DEFAULT_EFFECT_WHITE_POINT,
  resolveDitherMode,
  type DitherMode,
  type ImageEffectToggles,
} from "../design/tokens";
import type { SizedImage } from "./background-removal";

const ASCII_MIN_CELL = 4;
/** Soft edge / near-empty cells below this stay blank. */
const ASCII_MIN_COVERAGE = 0.04;
const MIN_OPAQUE_ALPHA = 8;

/** Standard 8×8 Bayer matrix, 0–63. */
const BAYER8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
] as const;

/**
 * Levels + gamma as one 256-entry lookup table, applied identically to R/G/B
 * so hue is untouched. Black/white point stretch the tonal range first (the
 * photo-editing "Levels" step), then gamma re-curves what that leaves.
 */
function buildToneCurve(
  blackPoint: number,
  whitePoint: number,
  gamma: number,
): Uint8ClampedArray | null {
  if (blackPoint <= 0 && whitePoint >= 255 && gamma === 1) return null;

  const span = Math.max(1, whitePoint - blackPoint);
  const exponent = 1 / gamma;
  const table = new Uint8ClampedArray(256);

  for (let value = 0; value < 256; value += 1) {
    const leveled = Math.max(0, Math.min(255, ((value - blackPoint) / span) * 255));

    table[value] = 255 * (leveled / 255) ** exponent;
  }

  return table;
}

function applyToneCurve(data: Uint8ClampedArray, table: Uint8ClampedArray): void {
  for (let index = 0; index < data.length; index += 4) {
    data[index] = table[data[index]!]!;
    data[index + 1] = table[data[index + 1]!]!;
    data[index + 2] = table[data[index + 2]!]!;
  }
}

/**
 * Alpha-weighted horizontal + vertical box blur. Weighting by alpha keeps a
 * cutout's cleared background from bleeding dark fringes into soft edges.
 */
function boxBlur(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
): void {
  const passRadius = Math.max(1, Math.round(radius));

  boxBlurPass(data, width, height, passRadius, true);
  boxBlurPass(data, width, height, passRadius, false);
}

function boxBlurPass(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
  horizontal: boolean,
): void {
  const outer = horizontal ? height : width;
  const inner = horizontal ? width : height;
  const source = Uint8ClampedArray.from(data);
  const stride = horizontal ? 4 : width * 4;

  for (let o = 0; o < outer; o += 1) {
    const rowStart = horizontal ? o * width * 4 : o * 4;

    for (let i = 0; i < inner; i += 1) {
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;
      let weight = 0;

      for (let d = -radius; d <= radius; d += 1) {
        const sampleIndex = i + d;

        if (sampleIndex < 0 || sampleIndex >= inner) continue;

        const offset = rowStart + sampleIndex * stride;
        const sampleAlpha = source[offset + 3]!;
        const alphaWeight = sampleAlpha / 255;

        red += source[offset]! * alphaWeight;
        green += source[offset + 1]! * alphaWeight;
        blue += source[offset + 2]! * alphaWeight;
        alpha += sampleAlpha;
        weight += alphaWeight;
      }

      const offset = rowStart + i * stride;
      const sampleCount = Math.min(inner, i + radius + 1) - Math.max(0, i - radius);

      data[offset] = weight > 0 ? red / weight : 0;
      data[offset + 1] = weight > 0 ? green / weight : 0;
      data[offset + 2] = weight > 0 ? blue / weight : 0;
      data[offset + 3] = sampleCount > 0 ? alpha / sampleCount : 0;
    }
  }
}

/**
 * Blur, then black/white point, then gamma — run once on the full-resolution
 * source before Pixelate or ASCII samples it down, so the threshold reads a
 * cleaned-up image rather than raw noise.
 *
 * Blur grows the canvas by its radius on every side first, so the soft edge
 * has empty margin to spread into instead of being clamped against the
 * source's own bounds. Callers diff the returned size against `source` to
 * learn how much extra room the blur needs downstream.
 */
function preprocessImage(
  source: SizedImage,
  blur: number,
  gamma: number,
  blackPoint: number,
  whitePoint: number,
): SizedImage {
  const toneCurve = buildToneCurve(blackPoint, whitePoint, gamma);

  if (blur <= 0 && !toneCurve) return source;

  const margin = blur > 0 ? Math.max(1, Math.round(blur)) : 0;
  const width = source.width + margin * 2;
  const height = source.height + margin * 2;
  const ctx = createContext(width, height);

  ctx.drawImage(source.image, margin, margin, source.width, source.height);

  const frame = ctx.getImageData(0, 0, width, height);

  if (blur > 0) {
    boxBlur(frame.data, width, height, blur);
  }

  if (toneCurve) {
    applyToneCurve(frame.data, toneCurve);
  }

  ctx.putImageData(frame, 0, 0);

  return { height, image: ctx.canvas, width };
}

function createContext(
  width: number,
  height: number,
): OffscreenCanvasRenderingContext2D {
  const canvas = new OffscreenCanvas(Math.max(1, width), Math.max(1, height));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  if (!ctx) {
    throw new Error("Merch Studio could not acquire an offscreen 2D context.");
  }

  return ctx;
}

/** Perceptual luminance of one 0-255 RGB triple, normalized to 0-1. */
function luminance(red: number, green: number, blue: number): number {
  return (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
}

/**
 * Print density: dark, opaque pixels want ink. Light or empty pixels want
 * the garment showing through.
 */
function coverage(
  red: number,
  green: number,
  blue: number,
  alpha: number,
): number {
  if (alpha < MIN_OPAQUE_ALPHA) return 0;

  return (alpha / 255) * (1 - luminance(red, green, blue));
}

/** Deterministic 0–1 noise from integer pixel coordinates. */
function unitRandom(x: number, y: number): number {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263);

  n = Math.imul(n ^ (n >>> 13), 1274126177);

  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function bayerThreshold(x: number, y: number): number {
  return (BAYER8[y & 7]![x & 7]! + 0.5) / 64;
}

function writeBit(
  data: Uint8ClampedArray,
  offset: number,
  on: boolean,
  red: number,
  green: number,
  blue: number,
): void {
  if (on) {
    data[offset] = red;
    data[offset + 1] = green;
    data[offset + 2] = blue;
    data[offset + 3] = 255;
    return;
  }

  data[offset] = 0;
  data[offset + 1] = 0;
  data[offset + 2] = 0;
  data[offset + 3] = 0;
}

function addError(
  buffer: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  amount: number,
): void {
  if (x < 0 || y < 0 || x >= width || y >= height) return;

  const index = y * width + x;

  buffer[index] = (buffer[index] ?? 0) + amount;
}

function floydSteinberg(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  red: number,
  green: number,
  blue: number,
): void {
  const buffer = new Float32Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;

      buffer[y * width + x] = coverage(
        data[offset]!,
        data[offset + 1]!,
        data[offset + 2]!,
        data[offset + 3]!,
      );
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const old = buffer[index] ?? 0;
      const on = old >= 0.5;
      const quantized = on ? 1 : 0;
      const quantError = old - quantized;

      addError(buffer, width, height, x + 1, y, (quantError * 7) / 16);
      addError(buffer, width, height, x - 1, y + 1, (quantError * 3) / 16);
      addError(buffer, width, height, x, y + 1, (quantError * 5) / 16);
      addError(buffer, width, height, x + 1, y + 1, (quantError * 1) / 16);
      writeBit(data, index * 4, on, red, green, blue);
    }
  }
}

/**
 * Snaps every pixel to fully the effect ink or fully empty. Pulled out of
 * the canvas path so Bayer / F-S / random kernels are testable on raw RGBA.
 */
export function ditherPixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  mode: DitherMode,
  inkHex: string,
): void {
  const { red, green, blue } = hexToRgb(inkHex);
  const resolved = resolveDitherMode(mode);

  if (resolved === "floyd") {
    floydSteinberg(data, width, height, red, green, blue);
    return;
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const amount = coverage(
        data[offset]!,
        data[offset + 1]!,
        data[offset + 2]!,
        data[offset + 3]!,
      );
      const threshold =
        resolved === "random" ? unitRandom(x, y) : bayerThreshold(x, y);

      writeBit(data, offset, amount > threshold, red, green, blue);
    }
  }
}

/**
 * Duotone in place: dark pixels become fully opaque ink, light pixels fade
 * toward transparent (so the garment shows through), and the source's own
 * alpha shape is kept throughout. This is what makes "Recolor" read as a
 * color choice rather than flattening a photo into a single colored
 * rectangle. Pulled out of `recolorImage` so the pixel math is testable
 * without a canvas.
 */
export function recolorPixels(data: Uint8ClampedArray, inkHex: string): void {
  const { red, green, blue } = hexToRgb(inkHex);

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3]!;

    if (alpha === 0) continue;

    const lum = luminance(data[index]!, data[index + 1]!, data[index + 2]!);

    data[index] = red;
    data[index + 1] = green;
    data[index + 2] = blue;
    data[index + 3] = Math.round(alpha * (1 - lum));
  }
}

function recolorImage(source: SizedImage, inkHex: string): SizedImage {
  const ctx = createContext(source.width, source.height);

  ctx.drawImage(source.image, 0, 0, source.width, source.height);

  const frame = ctx.getImageData(0, 0, source.width, source.height);

  recolorPixels(frame.data, inkHex);
  ctx.putImageData(frame, 0, 0);

  return { height: source.height, image: ctx.canvas, width: source.width };
}

/**
 * Downscales with smoothing, dithers that grid to ink-or-empty, then blows
 * back up with nearest-neighbor so each cell is a hard 1-bit block.
 */
function pixelateImage(
  source: SizedImage,
  cellSize: number,
  mode: DitherMode,
  inkHex: string,
): SizedImage {
  const cell = Math.max(1, cellSize);
  const cols = Math.max(1, Math.round(source.width / cell));
  const rows = Math.max(1, Math.round(source.height / cell));
  const smallCtx = createContext(cols, rows);

  smallCtx.imageSmoothingEnabled = true;
  smallCtx.drawImage(source.image, 0, 0, cols, rows);

  const frame = smallCtx.getImageData(0, 0, cols, rows);

  ditherPixels(frame.data, cols, rows, mode, inkHex);
  smallCtx.putImageData(frame, 0, 0);

  const ctx = createContext(source.width, source.height);

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(smallCtx.canvas, 0, 0, source.width, source.height);

  return { height: source.height, image: ctx.canvas, width: source.width };
}

/**
 * Maps cell coverage into the ASCII ramp across the full tonal range so
 * midtones keep distinct glyphs instead of collapsing to the densest end.
 */
export function asciiRampIndex(coverage: number, rampLength: number): number {
  if (rampLength <= 0 || coverage < ASCII_MIN_COVERAGE) return -1;

  return Math.min(rampLength - 1, Math.floor(coverage * rampLength));
}

/**
 * Redraws the image as monospace glyphs in the effect ink: one glyph per
 * cell, chosen from `charset` (light to dark) by how dark that cell samples,
 * with the cell's own alpha (so a cutout's cleared background stays empty
 * rather than filling with the ramp's lightest character).
 */
function asciifyImage(
  source: SizedImage,
  cellSize: number,
  inkHex: string,
  charset: string,
): SizedImage {
  const ramp = charset.length > 0 ? charset : DEFAULT_ASCII_CHARSET;
  const cell = Math.max(ASCII_MIN_CELL, cellSize);
  const cols = Math.max(1, Math.round(source.width / cell));
  const rows = Math.max(1, Math.round(source.height / cell));
  const sampleCtx = createContext(cols, rows);

  sampleCtx.imageSmoothingEnabled = true;
  sampleCtx.drawImage(source.image, 0, 0, cols, rows);

  const pixels = sampleCtx.getImageData(0, 0, cols, rows).data;
  const ctx = createContext(source.width, source.height);
  const { red, green, blue } = hexToRgb(inkHex);

  ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
  // Slight oversize keeps cells abutting without smearing tonal steps.
  ctx.font = `700 ${cell * 1.08}px ui-monospace, "JetBrains Mono", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const offset = (row * cols + col) * 4;
      const alpha = pixels[offset + 3]!;

      if (alpha < MIN_OPAQUE_ALPHA) continue;

      const amount = coverage(
        pixels[offset]!,
        pixels[offset + 1]!,
        pixels[offset + 2]!,
        alpha,
      );
      const rampIndex = asciiRampIndex(amount, ramp.length);

      if (rampIndex < 0) continue;

      const glyph = ramp[rampIndex];

      if (glyph === " " || glyph === undefined) continue;

      ctx.globalAlpha = 1;
      ctx.fillText(glyph, (col + 0.5) * cell, (row + 0.5) * cell);
    }
  }

  return { height: source.height, image: ctx.canvas, width: source.width };
}

const effectsBySource = new WeakMap<object, Map<string, SizedImage>>();

/**
 * The image with every enabled effect applied, computed once per source
 * image and settings combination. `source` is typically the raw imported
 * image or, when background removal is also on, the cutout result, so
 * effects compose with it: a pixelated or ASCII'd cutout keeps the cleared
 * background empty.
 *
 * Any combination of the three can be on; they chain in a fixed order —
 * Pixelate, then Recolor, then ASCII — documented on `ImageEffectToggles`.
 */
export function getEffectImage(
  source: SizedImage,
  effects: ImageEffectToggles,
  amount: number,
  inkHex: string,
  charset: string,
  ditherMode: DitherMode = DEFAULT_DITHER_MODE,
  blur = DEFAULT_EFFECT_BLUR,
  gamma = DEFAULT_EFFECT_GAMMA,
  blackPoint = DEFAULT_EFFECT_BLACK_POINT,
  whitePoint = DEFAULT_EFFECT_WHITE_POINT,
): SizedImage {
  if (!effects.pixelate && !effects.recolor && !effects.ascii) return source;

  const mode = resolveDitherMode(ditherMode);
  const preprocessed = effects.pixelate || effects.ascii;
  const preprocessKey = preprocessed
    ? `pre:${blur}:${gamma}:${blackPoint}:${whitePoint}`
    : "";
  const key = [
    preprocessKey,
    effects.pixelate ? `pixelate:${amount}:${mode}:${inkHex}` : "",
    effects.recolor ? `recolor:${inkHex}` : "",
    effects.ascii ? `ascii:${amount}:${inkHex}:${charset}` : "",
  ].join("|");
  const bucket = effectsBySource.get(source.image as object) ?? new Map();
  const cached = bucket.get(key);

  if (cached) return cached;

  let result = source;

  if (preprocessed) {
    result = preprocessImage(result, blur, gamma, blackPoint, whitePoint);
  }

  if (effects.pixelate) result = pixelateImage(result, amount, mode, inkHex);
  if (effects.recolor) result = recolorImage(result, inkHex);
  if (effects.ascii) result = asciifyImage(result, amount, inkHex, charset);

  bucket.set(key, result);
  effectsBySource.set(source.image as object, bucket);

  return result;
}
