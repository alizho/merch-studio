/**
 * Commands that put a new component onto the garment.
 *
 * Layers own the new row; one value write carries the component's properties.
 * The library stamp and the Add text action share this so a tile click and a
 * button press land with the same size, ink, and placement.
 */

import type { ToolcraftCommand } from "@/toolcraft/runtime";

import {
  DEFAULT_ASCII_CHARSET,
  DEFAULT_CUSTOM_INK_HEX,
  DEFAULT_EFFECT_AMOUNT,
  DEFAULT_INK_COLORWAY_ID,
  DEFAULT_TYPOGRAPHY,
  readHexColor,
  resolveGarment,
  resolveGarmentView,
  resolveTreatment,
  type PlacementArea,
} from "../design/tokens";
import { findMark, DEFAULT_MARK_ID } from "../library/marks";
import {
  readComponents,
  TARGETS,
  withComponent,
  type ComponentRecord,
} from "../state/components";

/** Marks land at a printable default: a bit over half the print width. */
const MARK_WIDTH_RATIO = 0.62;

export type PlaceDispatch = (command: ToolcraftCommand) => void;

function newLayerId(): string {
  return `component-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function placementOf(values: Record<string, unknown>): PlacementArea {
  const garment = resolveGarment(values[TARGETS.garmentType]);

  return garment.placement[resolveGarmentView(values[TARGETS.garmentView])];
}

function currentFinish(values: Record<string, unknown>) {
  return resolveTreatment(values[TARGETS.selectedTreatment]);
}

function currentInk(values: Record<string, unknown>): {
  inkHex: string;
  inkId: string;
} {
  const inkId =
    typeof values[TARGETS.selectedInk] === "string"
      ? (values[TARGETS.selectedInk] as string)
      : DEFAULT_INK_COLORWAY_ID;

  return {
    inkHex: readHexColor(
      values[TARGETS.selectedInkColor],
      DEFAULT_CUSTOM_INK_HEX,
    ),
    inkId,
  };
}

function commitPlacement(
  dispatch: PlaceDispatch,
  values: Record<string, unknown>,
  record: ComponentRecord,
  name: string,
): void {
  const layerId = newLayerId();

  dispatch({
    insertIndex: 0,
    layer: { id: layerId, name, visible: true },
    type: "layers.add",
  });
  dispatch({
    label: `Add ${name.toLowerCase()}`,
    target: TARGETS.components,
    type: "controls.setValue",
    value: withComponent(readComponents(values), layerId, record),
  });
}

export function placeMark(
  dispatch: PlaceDispatch,
  values: Record<string, unknown>,
  requestedMarkId?: string,
): void {
  const placement = placementOf(values);
  const { inkHex, inkId } = currentInk(values);
  const markId =
    requestedMarkId ??
    (typeof values[TARGETS.libraryMark] === "string"
      ? (values[TARGETS.libraryMark] as string)
      : DEFAULT_MARK_ID);
  const mark = findMark(markId) ?? findMark(DEFAULT_MARK_ID)!;
  const width = Math.round(placement.width * MARK_WIDTH_RATIO);

  commitPlacement(
    dispatch,
    values,
    {
      view: resolveGarmentView(values[TARGETS.garmentView]),
      backgroundRemoval: false,
      centerX: placement.x + placement.width / 2,
      centerY: placement.y + placement.height / 2,
      effectAmount: DEFAULT_EFFECT_AMOUNT,
      effectAscii: false,
      effectCharset: DEFAULT_ASCII_CHARSET,
      effectInkHex: DEFAULT_CUSTOM_INK_HEX,
      effectInkId: DEFAULT_INK_COLORWAY_ID,
      effectPixelate: false,
      effectRecolor: false,
      height: Math.round(width * (mark.height / mark.width)),
      inkHex,
      inkId,
      kind: "mark",
      markId: mark.id,
      rotation: 0,
      treatment: currentFinish(values),
      width,
    },
    mark.label,
  );
}

export function placeText(
  dispatch: PlaceDispatch,
  values: Record<string, unknown>,
): void {
  const placement = placementOf(values);
  const { inkHex, inkId } = currentInk(values);

  commitPlacement(
    dispatch,
    values,
    {
      view: resolveGarmentView(values[TARGETS.garmentView]),
      backgroundRemoval: false,
      centerX: placement.x + placement.width / 2,
      centerY: placement.y + placement.height / 2,
      effectAmount: DEFAULT_EFFECT_AMOUNT,
      effectAscii: false,
      effectCharset: DEFAULT_ASCII_CHARSET,
      effectInkHex: DEFAULT_CUSTOM_INK_HEX,
      effectInkId: DEFAULT_INK_COLORWAY_ID,
      effectPixelate: false,
      effectRecolor: false,
      height: Math.round(DEFAULT_TYPOGRAPHY.size * DEFAULT_TYPOGRAPHY.lineHeight),
      inkHex,
      inkId,
      kind: "text",
      rotation: 0,
      text: "Text",
      treatment: currentFinish(values),
      typography: { ...DEFAULT_TYPOGRAPHY },
      width: Math.round(placement.width * 0.7),
    },
    "Text",
  );
}
