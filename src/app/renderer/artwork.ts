/**
 * Artwork mask building.
 *
 * Each component is rasterized into an alpha mask in its own local space, which
 * the treatment passes then turn into ink. Marks stay Path2D until an effect
 * needs pixels; live type stays glyphs until Flatten bakes it.
 */

import { canvasFontFor } from "../design/fonts";
import { createSurface, type Surface } from "./raster";
import { findMark } from "../library/marks";
import {
  resolveFace,
  resolveInkColorway,
  type ImageEffectToggles,
  type Typography,
} from "../design/tokens";
import { hasActiveEffects, type ComponentRecord } from "../state/components";
import { getCutoutImage, type SizedImage } from "./background-removal";
import { getEmbeddedRaster } from "./embedded-rasters";
import { getEffectImage } from "./image-effects";
import type { ImportedImage } from "./imported-images";

type AnyContext =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

export type ImageResources = {
  /** Imported artwork, oriented and keyed by runtime media asset id. */
  media: ReadonlyMap<string, ImportedImage>;
};

export type Box = {
  height: number;
  width: number;
};

function textLines(record: ComponentRecord): string[] {
  const typography = record.typography;
  const raw = record.text ?? "";
  const cased =
    typography?.textCase === "upper" ? raw.toLocaleUpperCase() : raw;

  return cased.split("\n");
}

function applyTextStyle(ctx: AnyContext, typography: Typography): void {
  const face = resolveFace(typography.faceId);

  ctx.font = canvasFontFor(face.family, typography.weight, typography.size);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  if ("letterSpacing" in ctx) {
    (ctx as CanvasRenderingContext2D).letterSpacing =
      `${typography.letterSpacing}em`;
  }
}

/**
 * Text geometry is measured rather than stored: the type size is the authored
 * value, so the box always matches what the face actually renders.
 */
export function measureText(
  ctx: AnyContext,
  record: ComponentRecord,
): Box {
  const typography = record.typography;

  if (!typography) {
    return { height: 1, width: 1 };
  }

  ctx.save();
  applyTextStyle(ctx, typography);

  const lines = textLines(record);
  let width = 0;

  for (const line of lines) {
    width = Math.max(width, ctx.measureText(line || " ").width);
  }

  ctx.restore();

  const lineHeight = typography.size * typography.lineHeight;

  return {
    height: Math.max(1, lineHeight * lines.length),
    width: Math.max(1, width),
  };
}

function drawTextFill(
  ctx: AnyContext,
  record: ComponentRecord,
  box: Box,
  padding: number,
): boolean {
  const typography = record.typography;

  if (!typography) {
    return false;
  }

  applyTextStyle(ctx, typography);

  const lines = textLines(record);
  const lineHeight = typography.size * typography.lineHeight;
  const firstBaseline =
    padding + (lineHeight - typography.size) / 2 + typography.size * 0.82;

  lines.forEach((line, index) => {
    ctx.fillText(
      line,
      padding + box.width / 2,
      firstBaseline + lineHeight * index,
    );
  });

  return true;
}

function drawMarkFill(
  ctx: AnyContext,
  record: ComponentRecord,
  box: Box,
  padding: number,
): boolean {
  const mark = findMark(record.markId ?? "");

  if (!mark) {
    return false;
  }

  const scale = Math.min(box.width / mark.width, box.height / mark.height);
  const drawWidth = mark.width * scale;
  const drawHeight = mark.height * scale;

  ctx.save();
  ctx.translate(
    padding + (box.width - drawWidth) / 2,
    padding + (box.height - drawHeight) / 2,
  );
  ctx.scale(scale, scale);
  ctx.fill(new Path2D(mark.d));
  ctx.restore();

  return true;
}

/**
 * Rasterizes live type in its ink so Flatten can hand the same bitmap to
 * Pixelate, Recolor, and ASCII that an import uses.
 */
export function rasterizeTextFill(
  measureCtx: AnyContext,
  record: ComponentRecord,
  inkHex: string,
): ImportedImage | null {
  const box = measureText(measureCtx, record);
  const surface = createSurface(box.width, box.height);

  surface.ctx.fillStyle = inkHex;

  if (!drawTextFill(surface.ctx as AnyContext, record, box, 0)) {
    return null;
  }

  return {
    height: box.height,
    image: surface.canvas,
    resourceRef: "flattened-text",
    width: box.width,
  };
}

function rasterizeMarkFill(
  record: ComponentRecord,
  box: Box,
  inkHex: string,
): ImportedImage | null {
  const surface = createSurface(box.width, box.height);

  surface.ctx.fillStyle = inkHex;

  if (!drawMarkFill(surface.ctx as AnyContext, record, box, 0)) {
    return null;
  }

  return {
    height: box.height,
    image: surface.canvas,
    resourceRef: record.markId ?? "mark",
    width: box.width,
  };
}

/**
 * Runs the effect chain and reports how far, in box-space pixels, the blur
 * grew the result past `source`'s own bounds on each axis — the caller needs
 * this before it sizes the mask surface, so the halo has room to land.
 */
function computeEffectedArtwork(
  record: ComponentRecord,
  source: SizedImage,
  box: Box,
): { effected: SizedImage; marginX: number; marginY: number } {
  const effectInkHex = resolveInkColorway(
    record.effectInkId,
    record.effectInkHex,
  ).hex;
  const effects: ImageEffectToggles = {
    ascii: record.effectAscii,
    pixelate: record.effectPixelate,
    recolor: record.effectRecolor,
  };
  const effected = getEffectImage(
    source,
    effects,
    record.effectAmount,
    effectInkHex,
    record.effectCharset,
    record.effectDither,
    record.effectBlur,
    record.effectGamma,
    record.effectBlackPoint,
    record.effectWhitePoint,
  );
  const marginX =
    ((effected.width - source.width) / 2) * (box.width / source.width);
  const marginY =
    ((effected.height - source.height) / 2) * (box.height / source.height);

  return { effected, marginX, marginY };
}

function paintEffectedImage(
  ctx: AnyContext,
  record: ComponentRecord,
  effected: SizedImage,
  box: Box,
  padding: number,
  marginX: number,
  marginY: number,
): void {
  ctx.imageSmoothingEnabled = !(record.effectPixelate && !record.effectAscii);
  ctx.drawImage(
    effected.image,
    padding - marginX,
    padding - marginY,
    box.width + marginX * 2,
    box.height + marginY * 2,
  );
  ctx.imageSmoothingEnabled = true;
}

/**
 * The pixels an image record should draw. A record stamped for different
 * content than its media id now holds draws nothing, rather than showing
 * another upload's pixels while it is being re-placed. Flattened type uses
 * the PNG stored on the record instead of a media id.
 */
export function resolveRecordImage(
  record: ComponentRecord,
  resources: ImageResources,
): ImportedImage | undefined {
  if (record.kind !== "image") return undefined;

  if (record.rasterDataUrl) {
    return getEmbeddedRaster(record.rasterDataUrl);
  }

  if (!record.mediaId) return undefined;

  const imported = resources.media.get(record.mediaId);

  return imported &&
    (record.resourceRef === undefined ||
      record.resourceRef === imported.resourceRef)
    ? imported
    : undefined;
}

/** The component's unrotated box in canvas units, used for drawing and handles. */
export function componentBox(
  ctx: AnyContext,
  record: ComponentRecord,
): Box {
  if (record.kind === "text") {
    return measureText(ctx, record);
  }

  return { height: record.height, width: record.width };
}

/**
 * Rasterizes one component into an alpha mask, padded so a treatment (or a
 * blur growing past the artwork's own edge) can never clip against the
 * buffer edge. The returned `padding` is what the surface was actually built
 * with — it can exceed the requested `padding` when blur needs more room,
 * and callers must use it (not the value they passed in) to place the mask.
 */
export function buildArtworkMask(
  measureCtx: AnyContext,
  record: ComponentRecord,
  resources: ImageResources,
  padding: number,
): { mask: Surface; box: Box; padding: number } | null {
  const box = componentBox(measureCtx, record);

  if (record.kind === "text") {
    const surface = createSurface(
      box.width + padding * 2,
      box.height + padding * 2,
    );
    const ctx = surface.ctx as AnyContext;

    ctx.fillStyle = "#000000";

    if (!drawTextFill(ctx, record, box, padding)) {
      return null;
    }

    return { box, mask: surface, padding };
  }

  if (record.kind === "mark" && hasActiveEffects(record)) {
    const inkHex = resolveInkColorway(record.inkId, record.inkHex).hex;
    const raster = rasterizeMarkFill(record, box, inkHex);

    if (!raster) {
      return null;
    }

    const { effected, marginX, marginY } = computeEffectedArtwork(
      record,
      raster,
      box,
    );
    const totalPadding = padding + Math.ceil(Math.max(marginX, marginY));
    const surface = createSurface(
      box.width + totalPadding * 2,
      box.height + totalPadding * 2,
    );
    const ctx = surface.ctx as AnyContext;

    paintEffectedImage(ctx, record, effected, box, totalPadding, marginX, marginY);

    return { box, mask: surface, padding: totalPadding };
  }

  if (record.kind === "mark") {
    const surface = createSurface(
      box.width + padding * 2,
      box.height + padding * 2,
    );
    const ctx = surface.ctx as AnyContext;

    ctx.fillStyle = "#000000";

    if (!drawMarkFill(ctx, record, box, padding)) {
      return null;
    }

    return { box, mask: surface, padding };
  }

  const imported = resolveRecordImage(record, resources);

  if (!imported) {
    return null;
  }

  const cutout = record.backgroundRemoval ? getCutoutImage(imported) : imported;
  const { effected, marginX, marginY } = computeEffectedArtwork(
    record,
    cutout,
    box,
  );
  const totalPadding = padding + Math.ceil(Math.max(marginX, marginY));
  const surface = createSurface(
    box.width + totalPadding * 2,
    box.height + totalPadding * 2,
  );
  const ctx = surface.ctx as AnyContext;

  paintEffectedImage(ctx, record, effected, box, totalPadding, marginX, marginY);

  return { box, mask: surface, padding: totalPadding };
}
