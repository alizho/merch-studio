/**
 * SVG decoding for imported artwork.
 *
 * `createImageBitmap` rejects SVG blobs, so SVG goes through an image element
 * and is rasterized once at a fixed long edge. The root is given explicit
 * width and height first: without them browsers fall back to a tiny default
 * size (or, in Firefox, refuse to draw the image to a canvas at all).
 */

export const SVG_RASTER_LONG_EDGE = 2048;

/** Per spec, an SVG with no usable size renders at 300×150. */
const DEFAULT_SVG_RATIO = 2;

export type SvgRootSizing = Readonly<{
  height?: string | null;
  viewBox?: string | null;
  width?: string | null;
}>;

export function isSvgType(mimeType: string | undefined): boolean {
  return /^image\/svg\+xml\b/i.test(mimeType ?? "");
}

function readLength(value: string | null | undefined): number | undefined {
  const match = /^\s*(\d*\.?\d+(?:e[+-]?\d+)?)\s*(px)?\s*$/i.exec(value ?? "");
  const length = match ? Number(match[1]) : Number.NaN;

  return Number.isFinite(length) && length > 0 ? length : undefined;
}

function readViewBox(
  value: string | null | undefined,
): { height: number; width: number } | undefined {
  const parts = (value ?? "").trim().split(/[\s,]+/).map(Number);

  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    return undefined;
  }

  const [, , width, height] = parts as [number, number, number, number];

  return width > 0 && height > 0 ? { height, width } : undefined;
}

/**
 * The raster size for an SVG root, plus the viewBox it needs so its content
 * scales to that size instead of rendering at its authored user units.
 */
export function resolveSvgRaster(
  root: SvgRootSizing,
  longEdge = SVG_RASTER_LONG_EDGE,
): Readonly<{ height: number; viewBox?: string; width: number }> {
  const width = readLength(root.width);
  const height = readLength(root.height);
  const viewBox = readViewBox(root.viewBox);
  const ratio =
    width && height
      ? width / height
      : viewBox
        ? viewBox.width / viewBox.height
        : DEFAULT_SVG_RATIO;
  const raster =
    ratio >= 1
      ? { height: Math.max(1, Math.round(longEdge / ratio)), width: longEdge }
      : { height: longEdge, width: Math.max(1, Math.round(longEdge * ratio)) };

  return !viewBox && width && height
    ? { ...raster, viewBox: `0 0 ${width} ${height}` }
    : raster;
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = "async";
  image.src = url;

  return image.decode().then(() => image);
}

/** Decodes SVG markup into a bitmap at a fixed long edge. */
export async function decodeSvg(blob: Blob): Promise<ImageBitmap> {
  const document = new DOMParser().parseFromString(
    await blob.text(),
    "image/svg+xml",
  );
  const root = document.documentElement;

  if (
    root.localName !== "svg" ||
    document.getElementsByTagName("parsererror").length > 0
  ) {
    throw new Error("Not a valid SVG document.");
  }

  const raster = resolveSvgRaster({
    height: root.getAttribute("height"),
    viewBox: root.getAttribute("viewBox"),
    width: root.getAttribute("width"),
  });

  if (raster.viewBox) root.setAttribute("viewBox", raster.viewBox);
  root.setAttribute("width", String(raster.width));
  root.setAttribute("height", String(raster.height));

  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(root)], {
      type: "image/svg+xml",
    }),
  );

  try {
    const image = await loadImageElement(url);
    const canvas = new OffscreenCanvas(raster.width, raster.height);
    const ctx = canvas.getContext("2d");

    if (!ctx) throw new Error("Could not rasterize SVG.");

    ctx.drawImage(image, 0, 0, raster.width, raster.height);

    return await createImageBitmap(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}
