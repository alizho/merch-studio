/**
 * Print and embroidery treatments.
 *
 * Both take an artwork alpha mask and return a treated, ink-colored surface, so
 * the same two treatments apply to text, to the Infisical marks, and to
 * imported artwork. Neither is a physical simulation: they are the visual
 * shorthand a designer reads as "screen print" or "stitched".
 */

import {
  cloneSurface,
  createSurface,
  dilateMask,
  shiftColor,
  subtractMask,
  tintMask,
  type Surface,
} from "./raster";
import type { Treatment } from "../design/tokens";

type AnyContext = OffscreenCanvasRenderingContext2D;

/** Satin-stitch band spacing in canvas pixels. */
const STITCH_TILE = 14;

function offsetMask(source: Surface, dx: number, dy: number): Surface {
  const moved = createSurface(source.width, source.height);

  moved.ctx.drawImage(source.canvas, dx, dy);

  return moved;
}

/**
 * Diagonal satin bands with a bright core and dark gutter, baked at 45 degrees
 * so the tile stays seamless when repeated.
 */
function stitchPattern(ctx: AnyContext): CanvasPattern | null {
  const tile = createSurface(STITCH_TILE, STITCH_TILE);
  const tileCtx = tile.ctx;

  tileCtx.lineCap = "butt";

  for (let offset = -STITCH_TILE; offset <= STITCH_TILE * 2; offset += STITCH_TILE) {
    // Gutter between stitches.
    tileCtx.strokeStyle = "rgba(0, 0, 0, 0.42)";
    tileCtx.lineWidth = 3.2;
    tileCtx.beginPath();
    tileCtx.moveTo(offset - STITCH_TILE, STITCH_TILE * 2);
    tileCtx.lineTo(offset + STITCH_TILE * 2, -STITCH_TILE);
    tileCtx.stroke();

    // Thread crown catching the light.
    tileCtx.strokeStyle = "rgba(255, 255, 255, 0.50)";
    tileCtx.lineWidth = 2.1;
    tileCtx.beginPath();
    tileCtx.moveTo(offset - STITCH_TILE + 4.4, STITCH_TILE * 2);
    tileCtx.lineTo(offset + STITCH_TILE * 2 + 4.4, -STITCH_TILE);
    tileCtx.stroke();
  }

  return ctx.createPattern(tile.canvas, "repeat");
}

function paintClippedPattern(
  mask: Surface,
  pattern: CanvasPattern | null,
): Surface {
  const clipped = cloneSurface(mask);

  if (!pattern) {
    return clipped;
  }

  const ctx = clipped.ctx;

  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, clipped.width, clipped.height);

  return clipped;
}

/**
 * Screen print: flat ink sitting on the surface of the cloth. Garment shading
 * is applied later in canvas space, so adding another repeated texture here
 * produces an artificial checkerboard instead of useful material detail.
 *
 * Imported artwork keeps its own colors here, because a print can carry them.
 */
function applyPrint(
  mask: Surface,
  inkHex: string,
  preserveColor: boolean,
): Surface {
  const body = cloneSurface(mask);

  if (!preserveColor) {
    tintMask(body, inkHex);
  }

  return body;
}

/**
 * Embroidery: thread has volume, so the artwork thickens, gains a darker border
 * stitch, and picks up a directional sheen with a lit and a shaded edge.
 *
 * Everything reduces to one thread color, imported artwork included, because
 * that is what stitching physically does to a multicolor image.
 */
function applyEmbroidery(mask: Surface, inkHex: string): Surface {
  const thick = dilateMask(mask, 2);
  const result = createSurface(mask.width, mask.height);
  const resultCtx = result.ctx;

  // Border stitch, sitting just outside the thickened body.
  const border = subtractMask(dilateMask(thick, 2.2), thick);

  tintMask(border, shiftColor(inkHex, -0.45));
  resultCtx.drawImage(border.canvas, 0, 0);

  const body = cloneSurface(thick);

  tintMask(body, inkHex);

  const bodyCtx = body.ctx;
  const stitches = paintClippedPattern(thick, stitchPattern(bodyCtx));

  bodyCtx.globalCompositeOperation = "overlay";
  bodyCtx.globalAlpha = 0.9;
  bodyCtx.drawImage(stitches.canvas, 0, 0);
  bodyCtx.globalAlpha = 1;

  // Relief: lit rim toward the top left, shaded rim toward the bottom right.
  const litRim = subtractMask(thick, offsetMask(thick, 1.6, 1.6));
  const shadedRim = subtractMask(thick, offsetMask(thick, -1.6, -1.6));

  tintMask(litRim, shiftColor(inkHex, 0.42));
  tintMask(shadedRim, shiftColor(inkHex, -0.32));

  bodyCtx.globalCompositeOperation = "source-atop";
  bodyCtx.globalAlpha = 0.75;
  bodyCtx.drawImage(litRim.canvas, 0, 0);
  bodyCtx.globalAlpha = 0.65;
  bodyCtx.drawImage(shadedRim.canvas, 0, 0);
  bodyCtx.globalAlpha = 1;
  bodyCtx.globalCompositeOperation = "source-over";

  resultCtx.drawImage(body.canvas, 0, 0);

  return result;
}

export function applyTreatment(
  mask: Surface,
  treatment: Treatment,
  inkHex: string,
  preserveColor = false,
): Surface {
  return treatment === "embroidery"
    ? applyEmbroidery(mask, inkHex)
    : applyPrint(mask, inkHex, preserveColor);
}

/**
 * Padding each treatment needs around the artwork so thickening, the border
 * stitch, and the relief rims are never clipped by the buffer edge.
 */
export function treatmentPadding(treatment: Treatment): number {
  return treatment === "embroidery" ? 10 : 2;
}
