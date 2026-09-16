/**
 * Placed-component state.
 *
 * Components are layers: the runtime layers panel owns how many exist, their
 * order, visibility, names, and which one is selected. Their per-component
 * properties live in one app-owned value target, so they ride the runtime's
 * existing history and persistence instead of a second store.
 *
 * The `selectedLayer.*` targets are the panel's editing view of whichever
 * component is selected. They are reconciled with the record map in one place
 * (`src/app/state/selection-sync.ts`) so each direction has a single writer.
 */

import {
  DEFAULT_CUSTOM_INK_HEX,
  DEFAULT_INK_COLORWAY_ID,
  DEFAULT_TYPOGRAPHY,
  readHexColor,
  type Typography,
} from "../design/tokens";
import { DEFAULT_MARK_ID } from "../library/marks";

export const TARGETS = {
  components: "design.components",
  garmentColor: "garment.color",
  garmentCustomColor: "garment.customColor",
  garmentType: "garment.type",
  garmentView: "garment.view",
  libraryMark: "library.mark",
  selectedCase: "selectedLayer.case",
  selectedFace: "selectedLayer.face",
  selectedInk: "selectedLayer.ink",
  selectedInkColor: "selectedLayer.inkColor",
  selectedKind: "selectedLayer.kind",
  selectedRotation: "selectedLayer.rotation",
  selectedSize: "selectedLayer.size",
  selectedText: "selectedLayer.text",
  selectedTracking: "selectedLayer.tracking",
  treatment: "treatment",
} as const;

export type ComponentKind = "image" | "mark" | "text";

export function isComponentKind(value: unknown): value is ComponentKind {
  return value === "image" || value === "mark" || value === "text";
}

export type ComponentRecord = {
  /** Center in canvas coordinates; rotation is applied about this point. */
  centerX: number;
  centerY: number;
  height: number;
  /**
   * The component's custom ink, kept per component so switching a component to
   * a stock color and back does not lose the dye it was mixed with.
   */
  inkHex: string;
  inkId: string;
  kind: ComponentKind;
  markId?: string;
  /** Runtime media asset id for imported artwork. */
  mediaId?: string;
  rotation: number;
  text?: string;
  typography?: Typography;
  width: number;
};

export type ComponentMap = Readonly<Record<string, ComponentRecord>>;

export const EMPTY_COMPONENTS: ComponentMap = Object.freeze({});

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function readKind(value: unknown): ComponentKind {
  return isComponentKind(value) ? value : "text";
}

function readTypography(value: unknown): Typography {
  if (!isRecordLike(value)) {
    return DEFAULT_TYPOGRAPHY;
  }

  return {
    faceId:
      typeof value.faceId === "string"
        ? value.faceId
        : DEFAULT_TYPOGRAPHY.faceId,
    letterSpacing: readNumber(
      value.letterSpacing,
      DEFAULT_TYPOGRAPHY.letterSpacing,
    ),
    lineHeight: readNumber(value.lineHeight, DEFAULT_TYPOGRAPHY.lineHeight),
    size: readNumber(value.size, DEFAULT_TYPOGRAPHY.size),
    textCase: value.textCase === "upper" ? "upper" : "none",
    weight: readNumber(value.weight, DEFAULT_TYPOGRAPHY.weight),
  };
}

/** Parses a persisted or imported record, falling back rather than throwing. */
export function readComponentRecord(value: unknown): ComponentRecord | null {
  if (!isRecordLike(value)) {
    return null;
  }

  const kind = readKind(value.kind);

  return {
    centerX: readNumber(value.centerX, 0),
    centerY: readNumber(value.centerY, 0),
    height: Math.max(1, readNumber(value.height, 120)),
    inkHex: readHexColor(value.inkHex, DEFAULT_CUSTOM_INK_HEX),
    inkId:
      typeof value.inkId === "string" ? value.inkId : DEFAULT_INK_COLORWAY_ID,
    kind,
    ...(kind === "mark"
      ? {
          markId: typeof value.markId === "string" ? value.markId : DEFAULT_MARK_ID,
        }
      : {}),
    ...(kind === "image" && typeof value.mediaId === "string"
      ? { mediaId: value.mediaId }
      : {}),
    rotation: readNumber(value.rotation, 0),
    ...(kind === "text"
      ? {
          text: typeof value.text === "string" ? value.text : "",
          typography: readTypography(value.typography),
        }
      : {}),
    width: Math.max(1, readNumber(value.width, 240)),
  };
}

export function readComponents(values: Record<string, unknown>): ComponentMap {
  const raw = values[TARGETS.components];

  if (!isRecordLike(raw)) {
    return EMPTY_COMPONENTS;
  }

  const entries: Record<string, ComponentRecord> = {};

  for (const [layerId, candidate] of Object.entries(raw)) {
    const record = readComponentRecord(candidate);

    if (record) {
      entries[layerId] = record;
    }
  }

  return entries;
}

export function withComponent(
  components: ComponentMap,
  layerId: string,
  record: ComponentRecord,
): ComponentMap {
  return { ...components, [layerId]: record };
}

export function componentLabel(record: ComponentRecord): string {
  if (record.kind === "text") {
    const text = (record.text ?? "").trim();

    return text.length > 0 ? text.slice(0, 24) : "Text";
  }

  if (record.kind === "mark") {
    return "Mark";
  }

  return "Artwork";
}
