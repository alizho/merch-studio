/**
 * One shared context for text measurement.
 *
 * Measuring needs a real 2D context but no pixels, so a single tiny surface is
 * reused instead of allocating one per measurement.
 */

import { createSurface, type Surface } from "./raster";

let surface: Surface | null = null;

export function measureContext(): OffscreenCanvasRenderingContext2D {
  if (!surface) {
    surface = createSurface(8, 8);
  }

  return surface.ctx;
}
