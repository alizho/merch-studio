/**
 * Mapping between the panel's `selectedLayer.*` values and a component record.
 *
 * Pure on purpose: this is the contract that makes a panel edit and a canvas
 * gesture agree on one component, so it is asserted directly rather than
 * through a rendered panel.
 */

import {
  DEFAULT_CUSTOM_INK_HEX,
  DEFAULT_INK_COLORWAY_ID,
  DEFAULT_TYPOGRAPHY,
  readHexColor,
  resolveFace,
  type TextCase,
  type Typography,
} from "../design/tokens";
import { TARGETS, type ComponentRecord } from "./components";

/** Tracking is authored in hundredths of an em so the slider stays integral. */
export const TRACKING_SCALE = 100;

export type PanelValues = {
  face: string;
  ink: string;
  inkHex: string;
  kind: string;
  rotation: number;
  size: number;
  text: string;
  textCase: TextCase;
  tracking: number;
};

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

export function panelFromValues(
  values: Record<string, unknown>,
): PanelValues {
  return {
    face: resolveFace(values[TARGETS.selectedFace]).id,
    ink: readString(values[TARGETS.selectedInk], DEFAULT_INK_COLORWAY_ID),
    inkHex: readHexColor(values[TARGETS.selectedInkColor], DEFAULT_CUSTOM_INK_HEX),
    kind: readString(values[TARGETS.selectedKind], ""),
    rotation: readNumber(values[TARGETS.selectedRotation], 0),
    size: readNumber(values[TARGETS.selectedSize], DEFAULT_TYPOGRAPHY.size),
    text: readString(values[TARGETS.selectedText], ""),
    textCase: values[TARGETS.selectedCase] === "upper" ? "upper" : "none",
    tracking: readNumber(values[TARGETS.selectedTracking], 0),
  };
}

export function panelFromRecord(record: ComponentRecord): PanelValues {
  const typography = record.typography ?? DEFAULT_TYPOGRAPHY;

  return {
    face: typography.faceId,
    ink: record.inkId,
    inkHex: record.inkHex,
    kind: record.kind,
    rotation: record.rotation,
    size: typography.size,
    text: record.text ?? "",
    textCase: typography.textCase,
    tracking: Math.round(typography.letterSpacing * TRACKING_SCALE),
  };
}

export function panelEqual(left: PanelValues, right: PanelValues): boolean {
  return (
    left.face === right.face &&
    left.ink === right.ink &&
    left.inkHex === right.inkHex &&
    left.kind === right.kind &&
    left.rotation === right.rotation &&
    left.size === right.size &&
    left.text === right.text &&
    left.textCase === right.textCase &&
    left.tracking === right.tracking
  );
}

export function typographyFromPanel(panel: PanelValues): Typography {
  return {
    faceId: panel.face,
    letterSpacing: panel.tracking / TRACKING_SCALE,
    lineHeight: DEFAULT_TYPOGRAPHY.lineHeight,
    size: panel.size,
    textCase: panel.textCase,
    weight: DEFAULT_TYPOGRAPHY.weight,
  };
}

export function applyPanelToRecord(
  record: ComponentRecord,
  panel: PanelValues,
): ComponentRecord {
  return {
    ...record,
    inkHex: panel.inkHex,
    inkId: panel.ink,
    rotation: panel.rotation,
    ...(record.kind === "text"
      ? { text: panel.text, typography: typographyFromPanel(panel) }
      : {}),
  };
}

/** Panel writes for a newly selected component, in a stable order. */
export function panelWrites(
  panel: PanelValues,
): readonly (readonly [string, unknown])[] {
  return [
    [TARGETS.selectedKind, panel.kind],
    [TARGETS.selectedInk, panel.ink],
    [TARGETS.selectedInkColor, panel.inkHex],
    [TARGETS.selectedRotation, panel.rotation],
    [TARGETS.selectedText, panel.text],
    [TARGETS.selectedFace, panel.face],
    [TARGETS.selectedSize, panel.size],
    [TARGETS.selectedCase, panel.textCase],
    [TARGETS.selectedTracking, panel.tracking],
  ];
}
