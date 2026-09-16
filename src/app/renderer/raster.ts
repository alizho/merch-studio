/**
 * Offscreen raster helpers shared by the garment and treatment passes.
 *
 * Every treatment works on an artwork's alpha mask rather than on its source
 * geometry. That is what lets print and embroidery apply identically to text,
 * to the Infisical marks, and to imported artwork without three code paths.
 */

export type Surface = {
  canvas: OffscreenCanvas;
  ctx: OffscreenCanvasRenderingContext2D;
  height: number;
  width: number;
};

/**
 * Every intermediate buffer is an `OffscreenCanvas`. It needs no document, so
 * the renderer never acquires DOM host-factory authority to draw.
 */
export function createSurface(width: number, height: number): Surface {
  const safeWidth = Math.max(1, Math.ceil(width));
  const safeHeight = Math.max(1, Math.ceil(height));
  const canvas = new OffscreenCanvas(safeWidth, safeHeight);
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Merch Studio could not acquire an offscreen 2D context.");
  }

  return { canvas, ctx, height: safeHeight, width: safeWidth };
}

/** Recolors a surface in place, keeping its alpha shape. */
export function tintMask(surface: Surface, color: string): void {
  const ctx = surface.ctx;

  ctx.save();
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, surface.width, surface.height);
  ctx.restore();
}

/**
 * Grows a mask outward by `radius`, approximated by stamping the source around
 * a ring of offsets. Embroidery uses this both for the thread border and for
 * the way real stitching thickens fine detail.
 */
export function dilateMask(source: Surface, radius: number): Surface {
  const grown = createSurface(source.width, source.height);
  const ctx = grown.ctx;
  const steps = 16;

  for (let step = 0; step < steps; step += 1) {
    const angle = (step / steps) * Math.PI * 2;

    ctx.drawImage(
      source.canvas,
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
    );
  }

  ctx.drawImage(source.canvas, 0, 0);

  return grown;
}

/** Returns `source` minus `cutout`: the ring left when a mask is subtracted. */
export function subtractMask(source: Surface, cutout: Surface): Surface {
  const ring = createSurface(source.width, source.height);
  const ctx = ring.ctx;

  ctx.drawImage(source.canvas, 0, 0);
  ctx.globalCompositeOperation = "destination-out";
  ctx.drawImage(cutout.canvas, 0, 0);

  return ring;
}

export function cloneSurface(source: Surface): Surface {
  const copy = createSurface(source.width, source.height);

  copy.ctx.drawImage(source.canvas, 0, 0);

  return copy;
}

/** Relative luminance, used to decide how much highlight a colorway needs. */
export function luminanceOf(hex: string): number {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((char) => char + char)
          .join("")
      : value;
  const red = Number.parseInt(full.slice(0, 2), 16) / 255;
  const green = Number.parseInt(full.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(full.slice(4, 6), 16) / 255;

  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

export function shiftColor(hex: string, amount: number): string {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((char) => char + char)
          .join("")
      : value;
  const channels = [0, 2, 4].map((offset) => {
    const channel = Number.parseInt(full.slice(offset, offset + 2), 16);
    const next =
      amount >= 0
        ? channel + (255 - channel) * amount
        : channel * (1 + amount);

    return Math.max(0, Math.min(255, Math.round(next)));
  });

  return `#${channels
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}
