/**
 * Scene composition.
 *
 * One function draws the finished design, and both the live preview and the PNG
 * export call it, so what the user sees is what the file contains.
 *
 * Pass order: tinted garment, then every component treated in its own local
 * space, then one fabric-shading pass in canvas space. Shading last and in
 * canvas space is what makes the artwork follow the folds of the cloth instead
 * of rotating with each piece.
 *
 * Drawing is always 0-based in garment coordinates and never clears the
 * surface: callers place the origin, and the runtime owns the export
 * background.
 */

import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  CUSTOM_COLORWAY_ID,
  resolveInkColorway,
  type GarmentDefinition,
  type GarmentView,
  type Treatment,
} from "../design/tokens";
import {
  buildArtworkMask,
  componentBox,
  type ImageResources,
} from "./artwork";
import { applyTreatment, treatmentPadding } from "./treatment";
import {
  cloneSurface,
  createSurface,
  luminanceOf,
  type Surface,
} from "./raster";
import type { ComponentMap, ComponentRecord } from "../state/components";

type AnyContext =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

export type DesignScene = {
  components: ComponentMap;
  garment: GarmentDefinition;
  garmentColorHex: string;
  /** Visible component layer ids, index 0 frontmost, matching the panel. */
  layerIds: readonly string[];
  treatment: Treatment;
  view: GarmentView;
};

export type SceneResources = ImageResources & {
  garments: ReadonlyMap<string, CanvasImageSource>;
};

const garmentCache = new Map<string, Surface>();

function garmentCacheKey(scene: DesignScene): string {
  return `${scene.garment.id}:${scene.view}:${scene.garmentColorHex}`;
}

/**
 * Tints the garment by multiplying the colorway through the artwork's baked
 * shading, then restores the original alpha. A soft-light pass scaled by how
 * dark the colorway is brings fold contrast back to the deep colors, which
 * multiply alone flattens.
 */
function tintedGarment(
  scene: DesignScene,
  source: CanvasImageSource,
): Surface {
  const key = garmentCacheKey(scene);
  const cached = garmentCache.get(key);

  if (cached) {
    return cached;
  }

  const surface = createSurface(CANVAS_WIDTH, CANVAS_HEIGHT);
  const ctx = surface.ctx;

  ctx.drawImage(source, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = scene.garmentColorHex;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(source, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.globalCompositeOperation = "soft-light";
  ctx.globalAlpha = 0.34 * (1 - luminanceOf(scene.garmentColorHex));
  ctx.drawImage(source, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  if (garmentCache.size > 24) {
    garmentCache.clear();
  }

  garmentCache.set(key, surface);

  return surface;
}

/**
 * Treated artwork depends on the component's appearance, not on where it sits,
 * so dragging and rotating reuse the cached buffer instead of re-running the
 * stitch or weave passes every frame.
 */
const treatedCache = new Map<string, { box: Box; surface: Surface }>();

type Box = { height: number; width: number };

function treatedCacheKey(record: ComponentRecord, scene: DesignScene): string {
  const typography = record.typography;

  return [
    record.kind,
    scene.treatment,
    record.inkId,
    record.inkId === CUSTOM_COLORWAY_ID ? record.inkHex : "",
    Math.round(record.width),
    Math.round(record.height),
    record.markId ?? "",
    record.mediaId ?? "",
    record.text ?? "",
    typography
      ? [
          typography.faceId,
          typography.weight,
          typography.size,
          typography.letterSpacing,
          typography.lineHeight,
          typography.textCase,
        ].join(",")
      : "",
  ].join("|");
}

/** Drops treated-artwork buffers, for a treatment or token change. */
export function clearTreatedCache(): void {
  treatedCache.clear();
}

function drawComponent(
  target: AnyContext,
  measureCtx: AnyContext,
  record: ComponentRecord,
  scene: DesignScene,
  resources: SceneResources,
): void {
  const padding = treatmentPadding(scene.treatment);
  const key = treatedCacheKey(record, scene);
  const cached = treatedCache.get(key);
  let treated: Surface;
  let box: Box;

  if (cached) {
    treated = cached.surface;
    box = cached.box;
  } else {
    const built = buildArtworkMask(measureCtx, record, resources, padding);

    if (!built) {
      return;
    }

    treated = applyTreatment(
      built.mask,
      scene.treatment,
      resolveInkColorway(record.inkId, record.inkHex).hex,
      record.kind === "image",
    );
    box = built.box;

    if (treatedCache.size > 64) {
      treatedCache.clear();
    }

    treatedCache.set(key, { box, surface: treated });
  }

  target.save();
  target.translate(record.centerX, record.centerY);
  target.rotate((record.rotation * Math.PI) / 180);
  target.drawImage(
    treated.canvas,
    -box.width / 2 - padding,
    -box.height / 2 - padding,
  );
  target.restore();
}

/**
 * Multiplies the garment's own shading over the artwork layer, then masks the
 * layer to the garment.
 *
 * The source art is near-white, so its pixel values read as a shading map:
 * folds darken the ink and flat cloth leaves it alone. The second
 * `destination-in` intersects the artwork with the garment's alpha, which is
 * what keeps a design on the cloth and off the background without boxing it
 * into a rectangle.
 */
function shadeAndMaskArtwork(
  layer: Surface,
  source: CanvasImageSource,
): void {
  const alphaCopy = cloneSurface(layer);
  const ctx = layer.ctx;

  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(source, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(alphaCopy.canvas, 0, 0);
  // Mask to the garment silhouette.
  ctx.drawImage(source, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.globalCompositeOperation = "source-over";
}

/** The component's axis-aligned box before rotation, in canvas units. */
export function measureComponent(
  measureCtx: AnyContext,
  record: ComponentRecord,
): { height: number; width: number } {
  return componentBox(measureCtx, record);
}

export function drawDesign(
  target: AnyContext,
  scene: DesignScene,
  resources: SceneResources,
): void {
  const source = resources.garments.get(scene.garment.sources[scene.view]);

  if (!source) {
    return;
  }

  const garment = tintedGarment(scene, source);

  target.drawImage(garment.canvas, 0, 0);

  const visible = scene.layerIds.filter((layerId) =>
    Boolean(scene.components[layerId]),
  );

  if (visible.length === 0) {
    return;
  }

  const artLayer = createSurface(CANVAS_WIDTH, CANVAS_HEIGHT);
  const artCtx = artLayer.ctx;

  // Back to front, so index 0 stays frontmost as the layers panel shows it.
  for (let index = visible.length - 1; index >= 0; index -= 1) {
    const record = scene.components[visible[index]];

    if (record) {
      drawComponent(artCtx, target, record, scene, resources);
    }
  }

  shadeAndMaskArtwork(artLayer, source);

  target.drawImage(artLayer.canvas, 0, 0);
}
