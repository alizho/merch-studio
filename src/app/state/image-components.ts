/**
 * Keeps imported-image component records paired with the exact runtime import
 * they describe.
 *
 * The runtime allocates `layer-N` and `media-N` ids from current counts, so an
 * id freed by a delete is handed to the next upload. Records are keyed by
 * layer id and deliberately survive deletes (undo brings them back), so a new
 * upload can land on a stale record. Each image record therefore stores the
 * content-addressed `resourceRef` it was placed for, and any record that no
 * longer matches its layer's asset is replaced rather than reused.
 */

import type {
  ToolcraftImageAsset,
  ToolcraftMediaAsset,
  ToolcraftMediaTransform,
} from "@/toolcraft/runtime";

import {
  DEFAULT_ASCII_CHARSET,
  DEFAULT_CUSTOM_INK_HEX,
  DEFAULT_EFFECT_AMOUNT,
  DEFAULT_INK_COLORWAY_ID,
  type GarmentView,
  type Treatment,
} from "../design/tokens";
import type { ComponentMap, ComponentRecord } from "./components";

export type PlacementArea = Readonly<{
  height: number;
  width: number;
  x: number;
  y: number;
}>;

export type ImageSize = Readonly<{ height: number; width: number }>;

/** Decoded pixels for one media asset, already rotated and flipped. */
export type DecodedImageSize = ImageSize & Readonly<{ resourceRef: string }>;

/** Fraction of the garment print area occupied by a newly imported image. */
const IMPORT_SIZE_RATIO = 0.7;

/** Relative aspect difference tolerated before a box is corrected. */
const ASPECT_TOLERANCE = 0.02;

export function isImageAsset(
  asset: ToolcraftMediaAsset,
): asset is ToolcraftImageAsset {
  return asset.assetKind === "image";
}

export function normalizeRotation(
  rotationDeg: number | undefined,
): 0 | 90 | 180 | 270 {
  const normalized = (((Math.round((rotationDeg ?? 0) / 90) * 90) % 360) + 360) % 360;

  return normalized === 90 || normalized === 180 || normalized === 270
    ? normalized
    : 0;
}

/** A quarter turn swaps the displayed width and height. */
export function orientSize(
  size: ImageSize,
  transform: ToolcraftMediaTransform | undefined,
): ImageSize {
  const rotation = normalizeRotation(transform?.rotationDeg);

  return rotation === 90 || rotation === 270
    ? { height: size.width, width: size.height }
    : { height: size.height, width: size.width };
}

/**
 * Fits imported artwork inside the print area without changing its aspect
 * ratio. Source pixels determine the ratio; scene units determine only the
 * displayed size and position.
 */
export function getImportedImagePlacement(
  size: ImageSize,
  placement: PlacementArea,
): Readonly<{
  centerX: number;
  centerY: number;
  height: number;
  width: number;
}> {
  const sourceWidth = Math.max(1, size.width);
  const sourceHeight = Math.max(1, size.height);
  const scale = Math.min(
    (placement.width * IMPORT_SIZE_RATIO) / sourceWidth,
    (placement.height * IMPORT_SIZE_RATIO) / sourceHeight,
  );

  return {
    centerX: placement.x + placement.width / 2,
    centerY: placement.y + placement.height / 2,
    height: Math.max(1, Math.round(sourceHeight * scale)),
    width: Math.max(1, Math.round(sourceWidth * scale)),
  };
}

/**
 * Returns a corrected box when a placed image's box disagrees with the pixels
 * it decoded to, or `null` when it already matches.
 *
 * The declared source size can be wrong: the runtime falls back to the canvas
 * size when it cannot measure a file in time, and EXIF-rotated photos can
 * report their stored rather than displayed orientation. The box keeps its
 * area but takes the decoded ratio.
 *
 * A box within rounding distance of the ratio on either axis already matches,
 * which keeps this idempotent and stops it fighting resize rounding.
 */
export function getAspectCorrectedSize(
  box: ImageSize,
  decoded: ImageSize,
): ImageSize | null {
  if (decoded.width <= 0 || decoded.height <= 0) return null;

  const target = decoded.width / decoded.height;
  const current = box.width / Math.max(1, box.height);

  if (
    Math.abs(current / target - 1) <= ASPECT_TOLERANCE ||
    Math.abs(box.width - box.height * target) <= 1 ||
    Math.abs(box.height - box.width / target) <= 1
  ) {
    return null;
  }

  const area = Math.max(1, box.width * box.height);
  const height = Math.max(1, Math.round(Math.sqrt(area / target)));
  const width = Math.max(1, Math.round(height * target));

  return { height, width };
}

/**
 * Whether a record was placed for exactly this asset. Records saved before
 * `resourceRef` existed can't prove that, so they are only accepted when the
 * caller vouches for them (the asset was restored with the workspace).
 */
export function isRecordForAsset(
  record: ComponentRecord | undefined,
  asset: ToolcraftImageAsset,
  acceptUnstamped: boolean,
): boolean {
  return (
    record?.kind === "image" &&
    record.mediaId === asset.id &&
    (record.resourceRef === undefined
      ? acceptUnstamped
      : record.resourceRef === asset.resourceRef)
  );
}

export function createImageComponent(
  asset: ToolcraftImageAsset,
  size: ImageSize,
  placement: PlacementArea,
  treatment: Treatment,
  view: GarmentView = "front",
): ComponentRecord {
  const frame = getImportedImagePlacement(size, placement);

  return {
    backgroundRemoval: false,
    centerX: frame.centerX,
    centerY: frame.centerY,
    effectAmount: DEFAULT_EFFECT_AMOUNT,
    effectAscii: false,
    effectCharset: DEFAULT_ASCII_CHARSET,
    effectInkHex: DEFAULT_CUSTOM_INK_HEX,
    effectInkId: DEFAULT_INK_COLORWAY_ID,
    effectPixelate: false,
    effectRecolor: false,
    height: frame.height,
    inkHex: DEFAULT_CUSTOM_INK_HEX,
    inkId: DEFAULT_INK_COLORWAY_ID,
    kind: "image",
    mediaId: asset.id,
    resourceRef: asset.resourceRef,
    rotation: 0,
    treatment,
    view,
    width: frame.width,
  };
}

/**
 * Brings every live image layer's record in line with its asset: places new
 * or recycled-id imports, stamps legacy records with their resource, and snaps
 * boxes to the decoded, transformed pixel ratio.
 *
 * `restoredLayerIds` are the image layers present when the workspace loaded;
 * only those may keep a record saved without a `resourceRef`. Any later upload
 * that lands on such a record is on a recycled id and gets a fresh one.
 *
 * Returns `null` when nothing changed, so callers can skip the write.
 * `placedLayerIds` lists layers that received a fresh record: new uploads,
 * as opposed to records restored by undo, redo, or reload.
 */
export function reconcileImageComponents({
  components,
  decoded,
  layerIds,
  mediaAssets,
  placement,
  restoredLayerIds,
  treatment,
  view = "front",
}: {
  components: ComponentMap;
  decoded: ReadonlyMap<string, DecodedImageSize>;
  layerIds: ReadonlySet<string>;
  mediaAssets: readonly ToolcraftMediaAsset[];
  placement: PlacementArea;
  restoredLayerIds: ReadonlySet<string>;
  treatment: Treatment;
  view?: GarmentView;
}): { components: ComponentMap; placedLayerIds: readonly string[] } | null {
  let next: Record<string, ComponentRecord> | null = null;
  const placedLayerIds: string[] = [];

  for (const asset of mediaAssets) {
    if (!isImageAsset(asset) || !layerIds.has(asset.layerId)) continue;

    const current = components[asset.layerId];
    const pixels = decoded.get(asset.id);
    const trusted =
      pixels && pixels.resourceRef === asset.resourceRef ? pixels : undefined;
    let record: ComponentRecord;

    if (
      !isRecordForAsset(current, asset, restoredLayerIds.has(asset.layerId))
    ) {
      record = createImageComponent(
        asset,
        trusted ?? orientSize(asset.sourceSize, asset.transform),
        placement,
        treatment,
        view,
      );
      placedLayerIds.push(asset.layerId);
    } else {
      record = current!;

      if (record.resourceRef === undefined) {
        record = { ...record, resourceRef: asset.resourceRef };
      }

      const corrected = trusted && getAspectCorrectedSize(record, trusted);

      if (corrected) {
        record = { ...record, ...corrected };
      }
    }

    if (record !== current) {
      next ??= { ...components };
      next[asset.layerId] = record;
    }
  }

  return next ? { components: next, placedLayerIds } : null;
}

/**
 * Layer order with newly placed uploads moved to the front of the stack,
 * latest import frontmost, or `null` when they are already there. The runtime
 * appends imported layers at the back, while text and marks are added on top.
 */
export function raisePlacedLayers<Layer extends { id: string }>(
  layers: readonly Layer[],
  placedLayerIds: readonly string[],
): Layer[] | null {
  const placed = new Set(placedLayerIds);
  const raised = layers.filter((layer) => placed.has(layer.id)).reverse();

  if (raised.length === 0) return null;

  const next = [...raised, ...layers.filter((layer) => !placed.has(layer.id))];

  return next.every((layer, index) => layer === layers[index]) ? null : next;
}
