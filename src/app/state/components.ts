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
  DEFAULT_ASCII_CHARSET,
  DEFAULT_CUSTOM_INK_HEX,
  DEFAULT_EFFECT_AMOUNT,
  DEFAULT_INK_COLORWAY_ID,
  DEFAULT_TYPOGRAPHY,
  MAX_EFFECT_AMOUNT,
  MIN_EFFECT_AMOUNT,
  readHexColor,
  resolveDitherMode,
  resolveGarmentView,
  resolveTreatment,
  type DitherMode,
  type GarmentView,
  type Treatment,
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
  selectedCutout: "selectedLayer.cutout",
  selectedCase: "selectedLayer.case",
  selectedEffectAmount: "selectedLayer.effectAmount",
  selectedEffectAscii: "selectedLayer.effectAscii",
  selectedEffectCharset: "selectedLayer.effectCharset",
  selectedEffectDither: "selectedLayer.effectDither",
  selectedEffectInk: "selectedLayer.effectInk",
  selectedEffectInkColor: "selectedLayer.effectInkColor",
  selectedEffectPixelate: "selectedLayer.effectPixelate",
  selectedEffectRecolor: "selectedLayer.effectRecolor",
  selectedFace: "selectedLayer.face",
  selectedInk: "selectedLayer.ink",
  selectedInkColor: "selectedLayer.inkColor",
  selectedKind: "selectedLayer.kind",
  selectedRotation: "selectedLayer.rotation",
  selectedSize: "selectedLayer.size",
  selectedText: "selectedLayer.text",
  selectedTracking: "selectedLayer.tracking",
  selectedTreatment: "selectedLayer.treatment",
  /** Pre-per-layer finish; still read when hydrating older workspaces. */
  treatment: "treatment",
} as const;

export type ComponentKind = "image" | "mark" | "text";

export function isComponentKind(value: unknown): value is ComponentKind {
  return value === "image" || value === "mark" || value === "text";
}

export type ComponentRecord = {
  /** Owning garment face; legacy records without a side belong to the front. */
  view?: GarmentView;
  /** Removes a flat, edge-connected backdrop from imported artwork. */
  backgroundRemoval: boolean;
  /** Center in canvas coordinates; rotation is applied about this point. */
  centerX: number;
  centerY: number;
  /** Pixelate/ASCII cell size in canvas px. */
  effectAmount: number;
  /** Redraws the image as monospace glyphs; stacks with Pixelate and Recolor. */
  effectAscii: boolean;
  /** ASCII's glyph ramp, light to dark; user-editable, defaults to a tonal set. */
  effectCharset: string;
  /** Bayer, Floyd–Steinberg, or random kernel used while Pixelate is on. */
  effectDither: DitherMode;
  /**
   * The effect's own custom ink, kept separate from the component's general
   * ink (which images never expose) so Recolor/ASCII have a color to draw in.
   */
  effectInkHex: string;
  effectInkId: string;
  /** 1-bit dither of the image into ink or empty cells; stacks with Recolor and ASCII. */
  effectPixelate: boolean;
  /** Bakes a duotone in the effect ink; stacks with Pixelate and ASCII. */
  effectRecolor: boolean;
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
  /**
   * Content address of the imported bytes this image was placed for. Runtime
   * media ids are recycled after deletes, so this is what proves a record
   * still belongs to its layer's asset.
   */
  resourceRef?: string;
  /**
   * Flattened type, stored as a PNG data URL on the record so it can take
   * the same pixel effects as an import without becoming a second media layer.
   */
  rasterDataUrl?: string;
  rotation: number;
  text?: string;
  /** Print or stitch, owned by this component rather than the garment. */
  treatment: Treatment;
  typography?: Typography;
  width: number;
};

/** Pixelate, Recolor, and ASCII run on imported artwork and library marks. */
export function effectsApplyToKind(kind: ComponentKind): boolean {
  return kind === "image" || kind === "mark";
}

export function hasActiveEffects(record: ComponentRecord): boolean {
  return (
    effectsApplyToKind(record.kind) &&
    (record.effectPixelate || record.effectRecolor || record.effectAscii)
  );
}

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
export function readComponentRecord(
  value: unknown,
  fallbackTreatment: Treatment = "print",
): ComponentRecord | null {
  if (!isRecordLike(value)) {
    return null;
  }

  const kind = readKind(value.kind);

  return {
    view: resolveGarmentView(value.view),
    backgroundRemoval: kind === "image" && value.backgroundRemoval === true,
    centerX: readNumber(value.centerX, 0),
    centerY: readNumber(value.centerY, 0),
    effectAmount: Math.max(
      MIN_EFFECT_AMOUNT,
      Math.min(
        MAX_EFFECT_AMOUNT,
        readNumber(value.effectAmount, DEFAULT_EFFECT_AMOUNT),
      ),
    ),
    effectAscii: effectsApplyToKind(kind) && value.effectAscii === true,
    effectCharset:
      typeof value.effectCharset === "string" && value.effectCharset.length > 0
        ? value.effectCharset
        : DEFAULT_ASCII_CHARSET,
    effectDither: resolveDitherMode(value.effectDither),
    effectInkHex: readHexColor(value.effectInkHex, DEFAULT_CUSTOM_INK_HEX),
    effectInkId:
      typeof value.effectInkId === "string"
        ? value.effectInkId
        : DEFAULT_INK_COLORWAY_ID,
    effectPixelate: effectsApplyToKind(kind) && value.effectPixelate === true,
    effectRecolor: effectsApplyToKind(kind) && value.effectRecolor === true,
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
    ...(kind === "image" && typeof value.resourceRef === "string"
      ? { resourceRef: value.resourceRef }
      : {}),
    ...(kind === "image" &&
    typeof value.rasterDataUrl === "string" &&
    value.rasterDataUrl.startsWith("data:image/")
      ? { rasterDataUrl: value.rasterDataUrl }
      : {}),
    rotation: readNumber(value.rotation, 0),
    ...(kind === "text"
      ? {
          text: typeof value.text === "string" ? value.text : "",
          typography: readTypography(value.typography),
        }
      : {}),
    treatment: resolveTreatment(
      value.treatment === undefined ? fallbackTreatment : value.treatment,
    ),
    width: Math.max(1, readNumber(value.width, 240)),
  };
}

export function readComponents(values: Record<string, unknown>): ComponentMap {
  const raw = values[TARGETS.components];

  if (!isRecordLike(raw)) {
    return EMPTY_COMPONENTS;
  }

  const inherited = resolveTreatment(values[TARGETS.treatment]);
  const entries: Record<string, ComponentRecord> = {};

  for (const [layerId, candidate] of Object.entries(raw)) {
    const record = readComponentRecord(candidate, inherited);

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

/** Shared by both preview faces, canvas hit targets, and image export. */
export function componentIdsForView(
  components: ComponentMap,
  layerIds: readonly string[],
  view: GarmentView,
): string[] {
  return layerIds.filter((id) =>
    Boolean(components[id]) && resolveGarmentView(components[id].view) === view,
  );
}
