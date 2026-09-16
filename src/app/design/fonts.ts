/**
 * Face registration for the three product faces.
 *
 * Faces are self-hosted from `public/fonts` and registered through the FontFace
 * API rather than a stylesheet: product CSS is module-scoped by contract, and
 * Canvas 2D needs the face present in `document.fonts` before `ctx.font` will
 * resolve it anyway.
 */

import { FACES, type FaceDefinition } from "./tokens";

const registered = new Map<string, Promise<void>>();

function formatOf(source: string): string {
  return source.endsWith(".otf") ? "opentype" : "woff2";
}

function registerFace(face: FaceDefinition): Promise<void> {
  const existing = registered.get(face.id);

  if (existing) {
    return existing;
  }

  const load = (async () => {
    if (typeof document === "undefined" || typeof FontFace === "undefined") {
      return;
    }

    const descriptors =
      face.weights.length > 1
        ? { weight: `${face.weights[0]} ${face.weights[face.weights.length - 1]}` }
        : { weight: String(face.weights[0]) };
    const fontFace = new FontFace(
      face.family,
      `url(${face.source}) format("${formatOf(face.source)}")`,
      descriptors,
    );

    await fontFace.load();
    document.fonts.add(fontFace);
  })();

  registered.set(face.id, load);

  return load;
}

/**
 * Resolves once every product face is usable by the canvas renderer. Callers
 * re-render on resolution so text is never measured against a fallback face.
 */
export function loadProductFaces(): Promise<void> {
  return Promise.all(FACES.map(registerFace)).then(() => undefined);
}

export function canvasFontFor(
  family: string,
  weight: number,
  sizePx: number,
): string {
  return `${weight} ${sizePx}px "${family}"`;
}
