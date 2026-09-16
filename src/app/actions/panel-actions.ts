/**
 * Product panel actions.
 *
 * Adding a component is two runtime commands: the layers module owns the new
 * layer, and one value write carries the component's properties. Export is
 * runtime-owned and never reaches this handler.
 */

import type { ToolcraftPanelActionHandler } from "@/toolcraft/runtime/react";

import {
  DEFAULT_CUSTOM_INK_HEX,
  DEFAULT_INK_COLORWAY_ID,
  DEFAULT_TYPOGRAPHY,
  readHexColor,
  resolveGarment,
  resolveGarmentView,
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

function newLayerId(): string {
  return `component-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function placementOf(values: Record<string, unknown>): PlacementArea {
  const garment = resolveGarment(values[TARGETS.garmentType]);

  return garment.placement[resolveGarmentView(values[TARGETS.garmentView])];
}

export const onPanelAction: ToolcraftPanelActionHandler = ({
  action,
  dispatch,
  state,
}) => {
  const values = state.values as Record<string, unknown>;

  if (action.value !== "component.addMark" && action.value !== "component.addText") {
    return;
  }

  const placement = placementOf(values);
  const centerX = placement.x + placement.width / 2;
  const centerY = placement.y + placement.height / 2;
  const layerId = newLayerId();
  const inkId =
    typeof values[TARGETS.selectedInk] === "string"
      ? (values[TARGETS.selectedInk] as string)
      : DEFAULT_INK_COLORWAY_ID;
  // A new component inherits whatever ink the panel is currently showing,
  // including a custom dye, so placing two marks in a row keeps one color.
  const inkHex = readHexColor(
    values[TARGETS.selectedInkColor],
    DEFAULT_CUSTOM_INK_HEX,
  );

  let record: ComponentRecord;
  let name: string;

  if (action.value === "component.addMark") {
    const markId =
      typeof values[TARGETS.libraryMark] === "string"
        ? (values[TARGETS.libraryMark] as string)
        : DEFAULT_MARK_ID;
    const mark = findMark(markId) ?? findMark(DEFAULT_MARK_ID)!;
    const width = Math.round(placement.width * MARK_WIDTH_RATIO);

    record = {
      centerX,
      centerY,
      height: Math.round(width * (mark.height / mark.width)),
      inkHex,
      inkId,
      kind: "mark",
      markId: mark.id,
      rotation: 0,
      width,
    };
    name = mark.label;
  } else {
    record = {
      centerX,
      centerY,
      height: Math.round(DEFAULT_TYPOGRAPHY.size * DEFAULT_TYPOGRAPHY.lineHeight),
      inkHex,
      inkId,
      kind: "text",
      rotation: 0,
      text: "Text",
      typography: { ...DEFAULT_TYPOGRAPHY },
      width: Math.round(placement.width * 0.7),
    };
    name = "Text";
  }

  // Index 0 is the front of the stack, matching the layers panel order.
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
};
