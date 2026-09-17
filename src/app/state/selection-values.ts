/**
 * Mapping between the panel's `selectedLayer.*` values and a component record.
 *
 * Pure on purpose: this is the contract that makes a panel edit and a canvas
 * gesture agree on one component, so it is asserted directly rather than
 * through a rendered panel.
 */

import {
  DEFAULT_ASCII_CHARSET,
  DEFAULT_CUSTOM_INK_HEX,
  DEFAULT_EFFECT_AMOUNT,
  DEFAULT_EFFECT_BLACK_POINT,
  DEFAULT_EFFECT_BLUR,
  DEFAULT_EFFECT_GAMMA,
  DEFAULT_EFFECT_WHITE_POINT,
  DEFAULT_INK_COLORWAY_ID,
  DEFAULT_TYPOGRAPHY,
  MAX_EFFECT_AMOUNT,
  MAX_EFFECT_BLACK_POINT,
  MAX_EFFECT_BLUR,
  MAX_EFFECT_GAMMA,
  MAX_EFFECT_WHITE_POINT,
  MIN_EFFECT_AMOUNT,
  MIN_EFFECT_BLACK_POINT,
  MIN_EFFECT_BLUR,
  MIN_EFFECT_GAMMA,
  MIN_EFFECT_WHITE_POINT,
  readHexColor,
  resolveDitherMode,
  resolveFace,
  resolveTreatment,
  type DitherMode,
  type TextCase,
  type Treatment,
  type Typography,
} from "../design/tokens";
import { TARGETS, effectsApplyToKind, type ComponentRecord } from "./components";

/** Tracking is authored in hundredths of an em so the slider stays integral. */
export const TRACKING_SCALE = 100;

export type PanelValues = {
  backgroundRemoval: boolean;
  effectAmount: number;
  effectAscii: boolean;
  effectBlackPoint: number;
  effectBlur: number;
  effectCharset: string;
  effectDither: DitherMode;
  effectGamma: number;
  effectInk: string;
  effectInkHex: string;
  effectPixelate: boolean;
  effectRecolor: boolean;
  effectWhitePoint: number;
  face: string;
  ink: string;
  inkHex: string;
  kind: string;
  rotation: number;
  size: number;
  text: string;
  textCase: TextCase;
  tracking: number;
  treatment: Treatment;
};

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function clampEffectAmount(value: number): number {
  return Math.max(MIN_EFFECT_AMOUNT, Math.min(MAX_EFFECT_AMOUNT, value));
}

function clampEffectBlur(value: number): number {
  return Math.max(MIN_EFFECT_BLUR, Math.min(MAX_EFFECT_BLUR, value));
}

function clampEffectGamma(value: number): number {
  return Math.max(MIN_EFFECT_GAMMA, Math.min(MAX_EFFECT_GAMMA, value));
}

function clampEffectBlackPoint(value: number): number {
  return Math.max(MIN_EFFECT_BLACK_POINT, Math.min(MAX_EFFECT_BLACK_POINT, value));
}

function clampEffectWhitePoint(value: number): number {
  return Math.max(MIN_EFFECT_WHITE_POINT, Math.min(MAX_EFFECT_WHITE_POINT, value));
}

export function panelFromValues(
  values: Record<string, unknown>,
): PanelValues {
  return {
    backgroundRemoval: values[TARGETS.selectedCutout] === true,
    effectAmount: clampEffectAmount(
      readNumber(values[TARGETS.selectedEffectAmount], DEFAULT_EFFECT_AMOUNT),
    ),
    effectAscii: values[TARGETS.selectedEffectAscii] === true,
    effectBlackPoint: clampEffectBlackPoint(
      readNumber(
        values[TARGETS.selectedEffectBlackPoint],
        DEFAULT_EFFECT_BLACK_POINT,
      ),
    ),
    effectBlur: clampEffectBlur(
      readNumber(values[TARGETS.selectedEffectBlur], DEFAULT_EFFECT_BLUR),
    ),
    effectCharset: readString(
      values[TARGETS.selectedEffectCharset],
      DEFAULT_ASCII_CHARSET,
    ),
    effectDither: resolveDitherMode(values[TARGETS.selectedEffectDither]),
    effectGamma: clampEffectGamma(
      readNumber(values[TARGETS.selectedEffectGamma], DEFAULT_EFFECT_GAMMA),
    ),
    effectInk: readString(
      values[TARGETS.selectedEffectInk],
      DEFAULT_INK_COLORWAY_ID,
    ),
    effectInkHex: readHexColor(
      values[TARGETS.selectedEffectInkColor],
      DEFAULT_CUSTOM_INK_HEX,
    ),
    effectPixelate: values[TARGETS.selectedEffectPixelate] === true,
    effectRecolor: values[TARGETS.selectedEffectRecolor] === true,
    effectWhitePoint: clampEffectWhitePoint(
      readNumber(
        values[TARGETS.selectedEffectWhitePoint],
        DEFAULT_EFFECT_WHITE_POINT,
      ),
    ),
    face: resolveFace(values[TARGETS.selectedFace]).id,
    ink: readString(values[TARGETS.selectedInk], DEFAULT_INK_COLORWAY_ID),
    inkHex: readHexColor(values[TARGETS.selectedInkColor], DEFAULT_CUSTOM_INK_HEX),
    kind: readString(values[TARGETS.selectedKind], ""),
    rotation: readNumber(values[TARGETS.selectedRotation], 0),
    size: readNumber(values[TARGETS.selectedSize], DEFAULT_TYPOGRAPHY.size),
    text: readString(values[TARGETS.selectedText], ""),
    textCase: values[TARGETS.selectedCase] === "upper" ? "upper" : "none",
    tracking: readNumber(values[TARGETS.selectedTracking], 0),
    treatment: resolveTreatment(values[TARGETS.selectedTreatment]),
  };
}

export function panelFromRecord(record: ComponentRecord): PanelValues {
  const typography = record.typography ?? DEFAULT_TYPOGRAPHY;

  return {
    backgroundRemoval: record.backgroundRemoval,
    effectAmount: record.effectAmount,
    effectAscii: record.effectAscii,
    effectBlackPoint: record.effectBlackPoint,
    effectBlur: record.effectBlur,
    effectCharset: record.effectCharset,
    effectDither: record.effectDither,
    effectGamma: record.effectGamma,
    effectInk: record.effectInkId,
    effectInkHex: record.effectInkHex,
    effectPixelate: record.effectPixelate,
    effectRecolor: record.effectRecolor,
    effectWhitePoint: record.effectWhitePoint,
    face: typography.faceId,
    ink: record.inkId,
    inkHex: record.inkHex,
    kind: record.kind,
    rotation: record.rotation,
    size: typography.size,
    text: record.text ?? "",
    textCase: typography.textCase,
    tracking: Math.round(typography.letterSpacing * TRACKING_SCALE),
    treatment: record.treatment,
  };
}

export function panelEqual(left: PanelValues, right: PanelValues): boolean {
  return (
    left.backgroundRemoval === right.backgroundRemoval &&
    left.effectAmount === right.effectAmount &&
    left.effectAscii === right.effectAscii &&
    left.effectBlackPoint === right.effectBlackPoint &&
    left.effectBlur === right.effectBlur &&
    left.effectCharset === right.effectCharset &&
    left.effectDither === right.effectDither &&
    left.effectGamma === right.effectGamma &&
    left.effectInk === right.effectInk &&
    left.effectInkHex === right.effectInkHex &&
    left.effectPixelate === right.effectPixelate &&
    left.effectRecolor === right.effectRecolor &&
    left.effectWhitePoint === right.effectWhitePoint &&
    left.face === right.face &&
    left.ink === right.ink &&
    left.inkHex === right.inkHex &&
    left.kind === right.kind &&
    left.rotation === right.rotation &&
    left.size === right.size &&
    left.text === right.text &&
    left.textCase === right.textCase &&
    left.tracking === right.tracking &&
    left.treatment === right.treatment
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
  const acceptsEffects = effectsApplyToKind(record.kind);

  return {
    ...record,
    backgroundRemoval: record.kind === "image" ? panel.backgroundRemoval : false,
    effectAmount: panel.effectAmount,
    // The Pixelate/ASCII checkboxes are `disabledWhen` the other is on, so a
    // panel write can only ever turn one of them on; nothing further to
    // reconcile here.
    effectAscii: acceptsEffects && panel.effectAscii,
    effectBlackPoint: panel.effectBlackPoint,
    effectBlur: panel.effectBlur,
    effectCharset: panel.effectCharset,
    effectDither: panel.effectDither,
    effectGamma: panel.effectGamma,
    effectInkHex: panel.effectInkHex,
    effectInkId: panel.effectInk,
    effectPixelate: acceptsEffects && panel.effectPixelate,
    effectRecolor: acceptsEffects && panel.effectRecolor,
    effectWhitePoint: panel.effectWhitePoint,
    inkHex: panel.inkHex,
    inkId: panel.ink,
    rotation: panel.rotation,
    treatment: panel.treatment,
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
    [TARGETS.selectedCutout, panel.backgroundRemoval],
    [TARGETS.selectedEffectPixelate, panel.effectPixelate],
    [TARGETS.selectedEffectRecolor, panel.effectRecolor],
    [TARGETS.selectedEffectAscii, panel.effectAscii],
    [
      TARGETS.selectedEffectModeActive,
      panel.effectPixelate || panel.effectAscii,
    ],
    [TARGETS.selectedEffectAmount, panel.effectAmount],
    [TARGETS.selectedEffectBlur, panel.effectBlur],
    [TARGETS.selectedEffectGamma, panel.effectGamma],
    [TARGETS.selectedEffectBlackPoint, panel.effectBlackPoint],
    [TARGETS.selectedEffectWhitePoint, panel.effectWhitePoint],
    [TARGETS.selectedEffectCharset, panel.effectCharset],
    [TARGETS.selectedEffectDither, panel.effectDither],
    [TARGETS.selectedEffectInk, panel.effectInk],
    [TARGETS.selectedEffectInkColor, panel.effectInkHex],
    [TARGETS.selectedInk, panel.ink],
    [TARGETS.selectedInkColor, panel.inkHex],
    [TARGETS.selectedRotation, panel.rotation],
    [TARGETS.selectedText, panel.text],
    [TARGETS.selectedFace, panel.face],
    [TARGETS.selectedSize, panel.size],
    [TARGETS.selectedCase, panel.textCase],
    [TARGETS.selectedTracking, panel.tracking],
    [TARGETS.selectedTreatment, panel.treatment],
  ];
}
