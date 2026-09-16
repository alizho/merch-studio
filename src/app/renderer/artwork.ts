/**
 * Artwork mask building.
 *
 * Each component is rasterized into an alpha mask in its own local space, which
 * the treatment passes then turn into ink. Marks draw from `Path2D`, so they
 * stay crisp at any scale or rotation instead of being resampled from a bitmap.
 */

import { canvasFontFor } from "../design/fonts";
import { createSurface, type Surface } from "./raster";
import { findMark } from "../library/marks";
import { resolveFace, type Typography } from "../design/tokens";
import type { ComponentRecord } from "../state/components";

type AnyContext =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

export type ImageResources = {
  /** Imported artwork, keyed by runtime media asset id. */
  media: ReadonlyMap<string, CanvasImageSource>;
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
 * Rasterizes one component into an alpha mask, padded so a treatment can grow
 * past the artwork edge without clipping.
 */
export function buildArtworkMask(
  measureCtx: AnyContext,
  record: ComponentRecord,
  resources: ImageResources,
  padding: number,
): { mask: Surface; box: Box } | null {
  const box = componentBox(measureCtx, record);
  const surface = createSurface(
    box.width + padding * 2,
    box.height + padding * 2,
  );
  const ctx = surface.ctx as AnyContext;

  ctx.fillStyle = "#000000";

  if (record.kind === "text") {
    const typography = record.typography;

    if (!typography) {
      return null;
    }

    applyTextStyle(ctx, typography);

    const lines = textLines(record);
    const lineHeight = typography.size * typography.lineHeight;
    // Seat the first baseline so the block is vertically centered in the box.
    const firstBaseline =
      padding + (lineHeight - typography.size) / 2 + typography.size * 0.82;

    lines.forEach((line, index) => {
      ctx.fillText(
        line,
        padding + box.width / 2,
        firstBaseline + lineHeight * index,
      );
    });

    return { box, mask: surface };
  }

  if (record.kind === "mark") {
    const mark = findMark(record.markId ?? "");

    if (!mark) {
      return null;
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

    return { box, mask: surface };
  }

  const image = record.mediaId
    ? resources.media.get(record.mediaId)
    : undefined;

  if (!image) {
    return null;
  }

  ctx.drawImage(image, padding, padding, box.width, box.height);

  return { box, mask: surface };
}
