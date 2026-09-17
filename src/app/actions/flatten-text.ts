/**
 * Flatten selected type into pixels so Effects can treat it like an image.
 *
 * The PNG lives on the component record rather than as a new media layer, so
 * placement, rotation, and the existing layer row stay put.
 */

import type { ToolcraftCommand, ToolcraftState } from "@/toolcraft/runtime";

import { resolveInkColorway } from "../design/tokens";
import { measureText, rasterizeTextFill } from "../renderer/artwork";
import { rememberEmbeddedRaster } from "../renderer/embedded-rasters";
import { measureContext } from "../renderer/measure";
import {
  readComponents,
  TARGETS,
  withComponent,
  type ComponentRecord,
} from "../state/components";
import { panelFromRecord, panelWrites } from "../state/selection-values";

export type FlattenDispatch = (command: ToolcraftCommand) => void;

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return `data:${blob.type || "image/png"};base64,${btoa(binary)}`;
}

export function flattenedImageRecord(
  record: ComponentRecord,
  rasterDataUrl: string,
  size: { height: number; width: number },
): ComponentRecord {
  return {
    backgroundRemoval: false,
    centerX: record.centerX,
    centerY: record.centerY,
    effectAmount: record.effectAmount,
    effectAscii: record.effectAscii,
    effectCharset: record.effectCharset,
    effectDither: record.effectDither,
    effectInkHex: record.effectInkHex,
    effectInkId: record.effectInkId,
    effectPixelate: record.effectPixelate,
    effectRecolor: record.effectRecolor,
    height: size.height,
    inkHex: record.inkHex,
    inkId: record.inkId,
    kind: "image",
    rasterDataUrl,
    rotation: record.rotation,
    treatment: record.treatment,
    view: record.view,
    width: size.width,
  };
}

export async function flattenSelectedText(
  dispatch: FlattenDispatch,
  state: Pick<ToolcraftState, "selectedLayerId" | "values">,
): Promise<void> {
  const layerId = state.selectedLayerId;

  if (!layerId) {
    return;
  }

  const values = state.values as Record<string, unknown>;
  const components = readComponents(values);
  const record = components[layerId];

  if (!record || record.kind !== "text") {
    return;
  }

  const inkHex = resolveInkColorway(record.inkId, record.inkHex).hex;
  const raster = rasterizeTextFill(measureContext(), record, inkHex);

  if (!raster) {
    return;
  }

  const canvas = raster.image as OffscreenCanvas;
  const blob = await canvas.convertToBlob({ type: "image/png" });
  const dataUrl = await blobToDataUrl(blob);
  const box = measureText(measureContext(), record);

  rememberEmbeddedRaster(dataUrl, raster.image, raster.width, raster.height);

  const flattened = flattenedImageRecord(record, dataUrl, box);

  dispatch({
    label: "Flatten text",
    target: TARGETS.components,
    type: "controls.setValue",
    value: withComponent(components, layerId, flattened),
  });

  for (const [target, value] of panelWrites(panelFromRecord(flattened))) {
    dispatch({
      history: "skip",
      target,
      type: "controls.setValue",
      value,
    });
  }
}
