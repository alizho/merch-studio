/**
 * Recolor, Pixelate, and ASCII effects for imported images.
 *
 * Each effect bakes its result into a bitmap the same way the cutout does
 * (see `background-removal.ts`): it runs once per source image and settings
 * combination, then is cached, so dragging, resizing, or recoloring the
 * garment never repeats the work.
 *
 * Recolor and ASCII both draw in the effect's own ink, already resolved to a
 * final color, so the print treatment's `preserveColor` path can draw them
 * unchanged. Embroidery always re-tints everything to one thread color
 * regardless, so it is unaffected either way.
 */

import { hexToRgb } from "./raster";
import {
  DEFAULT_ASCII_CHARSET,
  type ImageEffectToggles,
} from "../design/tokens";
import type { SizedImage } from "./background-removal";

const ASCII_MIN_CELL = 4;
const MIN_OPAQUE_ALPHA = 8;

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

/** Downscales with smoothing (averages each cell), then blows back up with
 * nearest-neighbor sampling, which is what makes each cell read as a block. */
function pixelateImage(source: SizedImage, cellSize: number): SizedImage {
  const cell = Math.max(1, cellSize);
  const cols = Math.max(1, Math.round(source.width / cell));
  const rows = Math.max(1, Math.round(source.height / cell));
  const smallCtx = createContext(cols, rows);

  smallCtx.imageSmoothingEnabled = true;
  smallCtx.drawImage(source.image, 0, 0, cols, rows);

  const ctx = createContext(source.width, source.height);

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(smallCtx.canvas, 0, 0, source.width, source.height);

  return { height: source.height, image: ctx.canvas, width: source.width };
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
  ctx.font = `700 ${cell}px ui-monospace, "JetBrains Mono", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const offset = (row * cols + col) * 4;
      const alpha = pixels[offset + 3]!;

      if (alpha < MIN_OPAQUE_ALPHA) continue;

      const lum = luminance(pixels[offset]!, pixels[offset + 1]!, pixels[offset + 2]!);
      const rampIndex = Math.min(
        ramp.length - 1,
        Math.floor((1 - lum) * ramp.length),
      );
      const glyph = ramp[rampIndex];

      if (glyph === " " || glyph === undefined) continue;

      ctx.globalAlpha = alpha / 255;
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
 * That order is also why the key only carries each active stage's own
 * settings: it is a record of the exact pipeline run, so two components with
 * the same toggles and settings always share one cached bitmap, and toggling
 * only Recolor's ink never busts a cached Pixelate-only result for another
 * component.
 */
export function getEffectImage(
  source: SizedImage,
  effects: ImageEffectToggles,
  amount: number,
  inkHex: string,
  charset: string,
): SizedImage {
  if (!effects.pixelate && !effects.recolor && !effects.ascii) return source;

  const key = [
    effects.pixelate ? `pixelate:${amount}` : "",
    effects.recolor ? `recolor:${inkHex}` : "",
    effects.ascii ? `ascii:${amount}:${inkHex}:${charset}` : "",
  ].join("|");
  const bucket = effectsBySource.get(source.image as object) ?? new Map();
  const cached = bucket.get(key);

  if (cached) return cached;

  let result = source;

  if (effects.pixelate) result = pixelateImage(result, amount);
  if (effects.recolor) result = recolorImage(result, inkHex);
  if (effects.ascii) result = asciifyImage(result, amount, inkHex, charset);

  bucket.set(key, result);
  effectsBySource.set(source.image as object, bucket);

  return result;
}
