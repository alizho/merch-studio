/**
 * "Cutout image": clears a mostly uniform backdrop connected to an imported
 * image's edges.
 *
 * This runs on the image's own pixels, never on a padded artwork mask: the
 * treatment padding is a transparent frame, and a transparent frame reads as
 * "no background" to the edge sampler, which is why the cutout used to do
 * nothing. The result is cached per decoded image, so resizing or recoloring a
 * layer never repeats the flood fill.
 */

/** Pixels this close to the backdrop color are cleared outright. */
const CLEAR_DISTANCE = 24;
/** The flood fill spreads through pixels up to this distance. */
const FILL_DISTANCE = 54;
const MIN_OPAQUE_ALPHA = 8;
/** Long edge the cutout is computed at; larger images are downscaled first. */
const CUTOUT_MAX_EDGE = 2048;

type Rgb = Readonly<{ blue: number; green: number; red: number }>;

function colorDistanceSquared(
  data: Uint8ClampedArray,
  offset: number,
  color: Rgb,
): number {
  const red = data[offset]! - color.red;
  const green = data[offset + 1]! - color.green;
  const blue = data[offset + 2]! - color.blue;

  return red * red + green * green + blue * blue;
}

function dominantBorderColor(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Rgb | null {
  const buckets = new Map<number, { blue: number; count: number; green: number; red: number }>();
  const visit = (x: number, y: number): void => {
    const offset = (y * width + x) * 4;

    if (data[offset + 3]! < MIN_OPAQUE_ALPHA) return;

    const key =
      (Math.round(data[offset]! / 16) << 8) |
      (Math.round(data[offset + 1]! / 16) << 4) |
      Math.round(data[offset + 2]! / 16);
    const bucket = buckets.get(key) ?? {
      blue: 0,
      count: 0,
      green: 0,
      red: 0,
    };
    bucket.red += data[offset]!;
    bucket.green += data[offset + 1]!;
    bucket.blue += data[offset + 2]!;
    bucket.count += 1;
    buckets.set(key, bucket);
  };

  for (let x = 0; x < width; x += 1) {
    visit(x, 0);
    if (height > 1) visit(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    visit(0, y);
    if (width > 1) visit(width - 1, y);
  }

  const dominant = [...buckets.values()].sort(
    (left, right) => right.count - left.count,
  )[0];

  return dominant
    ? {
        blue: dominant.blue / dominant.count,
        green: dominant.green / dominant.count,
        red: dominant.red / dominant.count,
      }
    : null;
}

/**
 * Clears only background-colored pixels connected to an image edge, so
 * matching colors enclosed inside the artwork survive. Pixels between the
 * clear and fill distances are edge blends: they keep partial alpha and have
 * the backdrop color taken back out, which avoids a hard, haloed outline.
 *
 * Deterministic and local, so preview and export always agree.
 */
export function removeEdgeConnectedBackgroundPixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): void {
  if (width < 1 || height < 1 || data.length !== width * height * 4) return;

  const background = dominantBorderColor(data, width, height);

  if (!background) return;

  const fillSquared = FILL_DISTANCE * FILL_DISTANCE;
  const visited = new Uint8Array(width * height);
  const queue = new Uint32Array(width * height);
  let head = 0;
  let tail = 0;

  const enqueue = (index: number): void => {
    if (visited[index] === 1) return;
    visited[index] = 1;
    const offset = index * 4;

    if (
      data[offset + 3]! >= MIN_OPAQUE_ALPHA &&
      colorDistanceSquared(data, offset, background) <= fillSquared
    ) {
      queue[tail] = index;
      tail += 1;
    }
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    if (height > 1) enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(y * width);
    if (width > 1) enqueue(y * width + width - 1);
  }

  while (head < tail) {
    const index = queue[head]!;
    head += 1;
    const x = index % width;
    const y = Math.floor(index / width);

    if (x > 0) enqueue(index - 1);
    if (x + 1 < width) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y + 1 < height) enqueue(index + width);

    const offset = index * 4;
    const distance = Math.sqrt(colorDistanceSquared(data, offset, background));

    if (distance <= CLEAR_DISTANCE) {
      data[offset + 3] = 0;
      continue;
    }

    // observed = k * artwork + (1 - k) * backdrop, solved for the artwork.
    const coverage = (distance - CLEAR_DISTANCE) / (FILL_DISTANCE - CLEAR_DISTANCE);
    data[offset] = background.red + (data[offset]! - background.red) / coverage;
    data[offset + 1] =
      background.green + (data[offset + 1]! - background.green) / coverage;
    data[offset + 2] =
      background.blue + (data[offset + 2]! - background.blue) / coverage;
    data[offset + 3] = Math.round(data[offset + 3]! * coverage);
  }
}

export type SizedImage = Readonly<{
  height: number;
  image: CanvasImageSource;
  width: number;
}>;

const cutoutsBySource = new WeakMap<object, SizedImage>();

/**
 * The image with its edge-connected backdrop cleared, computed once per
 * decoded source image. Falls back to the original when no 2D context exists.
 * Downscaling for images above `CUTOUT_MAX_EDGE` changes the returned pixel
 * size, so this hands back the new size alongside the image rather than
 * leaving callers to assume the source's own dimensions still apply.
 */
export function getCutoutImage(source: SizedImage): SizedImage {
  const key = source.image as object;
  const cached = cutoutsBySource.get(key);

  if (cached) return cached;

  const scale = Math.min(
    1,
    CUTOUT_MAX_EDGE / Math.max(1, source.width, source.height),
  );
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  if (!ctx) return source;

  ctx.drawImage(source.image, 0, 0, width, height);

  const pixels = ctx.getImageData(0, 0, width, height);
  removeEdgeConnectedBackgroundPixels(pixels.data, width, height);
  ctx.putImageData(pixels, 0, 0);

  const result: SizedImage = { height, image: canvas, width };

  cutoutsBySource.set(key, result);

  return result;
}
