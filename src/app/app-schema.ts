import {
  canvasEditingModule,
  defineToolcraft,
  imageExportModule,
  layersModule,
  mediaSourceModule,
} from "@/toolcraft/runtime";

import appDefaults from "./app-defaults.json" with { type: "json" };
import { appIdentity } from "./app-identity";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  CUSTOM_COLORWAY_ID,
  DEFAULT_ASCII_CHARSET,
  DEFAULT_CUSTOM_GARMENT_HEX,
  DEFAULT_CUSTOM_INK_HEX,
  DEFAULT_DITHER_MODE,
  DEFAULT_EFFECT_AMOUNT,
  DEFAULT_GARMENT_COLORWAY_ID,
  DEFAULT_INK_COLORWAY_ID,
  DEFAULT_TYPOGRAPHY,
  MAX_EFFECT_AMOUNT,
  MIN_EFFECT_AMOUNT,
} from "./design/tokens";
import {
  garmentColorwayControlType,
  inkColorwayControlType,
} from "./controls/colorway-control-types";
import { libraryStampControlType } from "./controls/library-stamp-control-types";
import { DEFAULT_MARK_ID } from "./library/marks";
import { TARGETS } from "./state/components";

/**
 * Typography is declared as individual built-in controls rather than through
 * `fontPicker`. The built-in cannot represent this product's value model: its
 * catalog is 1,907 Google families compiled into the signed runtime, no schema
 * field constrains that list, and it resolves faces through Google stylesheet
 * URLs, so it cannot serve Alliance No.2 from a local file at all. Its
 * atomicity rule binds the entity it owns, and here it owns nothing. See the
 * control-selection inventory in `docs/toolcraft/agent-worklog.md`.
 */

/** Any component is selected, so selection-scoped controls apply. */
const whenComponentSelected = {
  all: [
    { oneOf: ["text", "mark", "image"], target: TARGETS.selectedKind },
  ],
  mode: "conditional",
} as const;

const whenTextSelected = {
  all: [{ equals: "text", target: TARGETS.selectedKind }],
  mode: "conditional",
} as const;

const whenImageSelected = {
  all: [{ equals: "image", target: TARGETS.selectedKind }],
  mode: "conditional",
} as const;

const whenImageOrMarkSelected = {
  all: [{ oneOf: ["image", "mark"], target: TARGETS.selectedKind }],
  mode: "conditional",
} as const;

/**
 * Ink applies to type and to the marks. Imported artwork keeps its own colors
 * in print, so an ink choice would not change it there.
 */
const whenInkApplies = {
  all: [{ oneOf: ["text", "mark"], target: TARGETS.selectedKind }],
  mode: "conditional",
} as const;

/**
 * The custom dye rows only exist once the swatch row has been handed off to a
 * custom color, so the curated set stays the default path and the open color
 * entry is a deliberate second step.
 */
const whenGarmentDyeIsCustom = {
  all: [{ equals: CUSTOM_COLORWAY_ID, target: TARGETS.garmentColor }],
  mode: "conditional",
} as const;

const whenInkIsCustom = {
  all: [
    { oneOf: ["text", "mark"], target: TARGETS.selectedKind },
    { equals: CUSTOM_COLORWAY_ID, target: TARGETS.selectedInk },
  ],
  mode: "conditional",
} as const;

/**
 * Effect ink and Detail are shared settings, each read by more than one of
 * the three independent effect toggles below (ink by Recolor and ASCII,
 * Detail by Pixelate and ASCII), so gating either on "the specific toggle
 * that currently needs it" would need an OR across independent booleans that
 * applicability predicates cannot express (predicates only AND). They stay
 * visible for any selected image or mark instead, like Cutout does, so a
 * value set ahead of turning an effect on is not lost or hidden.
 */
const whenEffectInkIsCustom = {
  all: [
    { oneOf: ["image", "mark"], target: TARGETS.selectedKind },
    { equals: CUSTOM_COLORWAY_ID, target: TARGETS.selectedEffectInk },
  ],
  mode: "conditional",
} as const;

/** The dither kernel only means anything while Pixelate is on. */
const whenPixelateOn = {
  all: [
    { oneOf: ["image", "mark"], target: TARGETS.selectedKind },
    { equals: true, target: TARGETS.selectedEffectPixelate },
  ],
  mode: "conditional",
} as const;

const whenEffectIsAscii = {
  all: [
    { oneOf: ["image", "mark"], target: TARGETS.selectedKind },
    { equals: true, target: TARGETS.selectedEffectAscii },
  ],
  mode: "conditional",
} as const;

const always = { mode: "always" } as const;

export const appSchema = defineToolcraft({
  base: {
    canvas: {
      draggable: true,
      enabled: true,
      // The garment art is authored at one size, so that is the canvas
      // default. Output stays editable, and `sceneBoundsProvider` keeps the
      // garment rect as the product frame regardless of artboard size.
      size: { height: CANVAS_HEIGHT, unit: "px", width: CANVAS_WIDTH },
      sizing: { defaultMode: "finite", mode: "editable-output" },
      upload: true,
    },
    identity: appIdentity,
    panels: {
      controls: {
        sections: [
          {
            controls: {
              type: {
                applicability: always,
                defaultValue: "tee",
                label: "Garment",
                options: [
                  { label: "T-shirt", value: "tee" },
                  { label: "Hoodie", value: "hoodie" },
                ],
                target: TARGETS.garmentType,
                type: "segmented",
              },
              view: {
                applicability: always,
                defaultValue: "front",
                label: "View",
                options: [
                  { label: "Front", value: "front" },
                  { label: "Back", value: "back" },
                ],
                target: TARGETS.garmentView,
                type: "segmented",
              },
              color: {
                applicability: always,
                defaultValue: DEFAULT_GARMENT_COLORWAY_ID,
                label: "Colorway",
                orderRole: "primary",
                target: TARGETS.garmentColor,
                type: garmentColorwayControlType,
              },
              customColor: {
                applicability: whenGarmentDyeIsCustom,
                defaultValue: DEFAULT_CUSTOM_GARMENT_HEX,
                label: "Custom dye",
                target: TARGETS.garmentCustomColor,
                type: "color",
              },
            },
            id: "garment",
            title: "Garment",
          },
          {
            controls: {
              mark: {
                applicability: always,
                defaultValue: DEFAULT_MARK_ID,
                label: "Image library",
                orderRole: "primary",
                target: TARGETS.libraryMark,
                type: libraryStampControlType,
              },
              upload: {
                accept: "image/png,image/jpeg,image/svg+xml,image/webp",
                applicability: always,
                assetKind: "image",
                label: "Add image",
                multiple: true,
                target: "media.sources",
                type: "fileDrop",
              },
              place: {
                actions: [{ label: "Add text", value: "component.addText" }],
                applicability: always,
                label: false,
                target: "component.place",
                type: "actions",
              },
            },
            // Standalone so imagePicker-class tiles, fileDrop, and actions stay
            // in one Components section instead of splitting by layout kind.
            id: "components",
            layout: "standalone",
            title: "Components",
          },
          {
            controls: {
              treatment: {
                applicability: whenComponentSelected,
                defaultValue: "print",
                label: "Finish",
                options: [
                  { label: "Print", value: "print" },
                  { label: "Stitch", value: "embroidery" },
                ],
                target: TARGETS.selectedTreatment,
                type: "segmented",
              },
              cutout: {
                applicability: whenImageSelected,
                defaultValue: false,
                description:
                  "Clears a mostly uniform outer color connected to the image edges.",
                label: "Cutout image",
                target: TARGETS.selectedCutout,
                type: "switch",
              },
              text: {
                applicability: whenTextSelected,
                commitMode: "content",
                defaultValue: "",
                label: "Text",
                target: TARGETS.selectedText,
                textValueKind: "single-line",
                type: "text",
              },
              face: {
                applicability: whenTextSelected,
                defaultValue: DEFAULT_TYPOGRAPHY.faceId,
                label: "Font",
                options: [
                  { label: "Alliance No.2", value: "alliance" },
                  { label: "Inter", value: "inter" },
                  { label: "JetBrains Mono", value: "mono" },
                ],
                target: TARGETS.selectedFace,
                type: "select",
              },
              size: {
                applicability: whenTextSelected,
                defaultValue: DEFAULT_TYPOGRAPHY.size,
                label: "Size",
                max: 420,
                min: 12,
                sliderValueKind: "continuous",
                step: 1,
                target: TARGETS.selectedSize,
                type: "slider",
                unit: "px",
              },
              textCase: {
                applicability: whenTextSelected,
                defaultValue: DEFAULT_TYPOGRAPHY.textCase,
                label: "Case",
                options: [
                  { label: "Aa", value: "none" },
                  { label: "AA", value: "upper" },
                ],
                target: TARGETS.selectedCase,
                type: "segmented",
              },
              tracking: {
                applicability: whenTextSelected,
                defaultValue: 0,
                label: "Tracking",
                max: 20,
                min: -10,
                sliderValueKind: "continuous",
                step: 1,
                target: TARGETS.selectedTracking,
                type: "slider",
              },
              flatten: {
                actions: [{ label: "Flatten", value: "component.flattenText" }],
                applicability: whenTextSelected,
                description:
                  "Turns type into pixels so Pixelate, Recolor, and ASCII can treat it like an image. Type settings are removed after flattening.",
                label: "Raster",
                target: "component.flatten",
                type: "actions",
              },
              rotation: {
                applicability: whenComponentSelected,
                defaultValue: 0,
                label: "Rotation",
                max: 180,
                min: -180,
                sliderValueKind: "continuous",
                step: 1,
                target: TARGETS.selectedRotation,
                type: "slider",
                unit: "°",
              },
              ink: {
                applicability: whenInkApplies,
                defaultValue: DEFAULT_INK_COLORWAY_ID,
                label: "Ink",
                orderRole: "primary",
                target: TARGETS.selectedInk,
                type: inkColorwayControlType,
              },
              inkColor: {
                applicability: whenInkIsCustom,
                defaultValue: DEFAULT_CUSTOM_INK_HEX,
                label: "Custom ink",
                target: TARGETS.selectedInkColor,
                type: "color",
              },
            },
            description:
              "Finish, image cleanup, type, ink, and rotation apply only to the selected component.",
            id: "component",
            title: "Selected",
          },
          {
            controls: {
              effectPixelate: {
                applicability: whenImageOrMarkSelected,
                defaultValue: false,
                description:
                  "Halftones the image into ink or empty cells, with no in-between tones.",
                label: "Dither",
                target: TARGETS.selectedEffectPixelate,
                type: "switch",
              },
              effectDither: {
                applicability: whenPixelateOn,
                defaultValue: DEFAULT_DITHER_MODE,
                description:
                  "Bayer is an ordered grid, F-S spreads quantization error to neighbors, and Random uses a stable noise threshold.",
                label: "Algorithm",
                options: [
                  { label: "Bayer", value: "bayer" },
                  { label: "F-S", value: "floyd" },
                  { label: "Random", value: "random" },
                ],
                target: TARGETS.selectedEffectDither,
                type: "segmented",
              },
              effectRecolor: {
                applicability: whenImageOrMarkSelected,
                defaultValue: false,
                description: "Bakes a duotone in the ink below.",
                label: "Recolor",
                target: TARGETS.selectedEffectRecolor,
                type: "switch",
              },
              effectAscii: {
                applicability: whenImageOrMarkSelected,
                defaultValue: false,
                description:
                  "Replaces the image with monospace characters in the ink below.",
                label: "ASCII",
                target: TARGETS.selectedEffectAscii,
                type: "switch",
              },
              effectInk: {
                applicability: whenImageOrMarkSelected,
                defaultValue: DEFAULT_INK_COLORWAY_ID,
                description: "Used by Pixelate, Recolor, and ASCII.",
                label: "Effect ink",
                orderRole: "primary",
                target: TARGETS.selectedEffectInk,
                type: inkColorwayControlType,
              },
              effectInkColor: {
                applicability: whenEffectInkIsCustom,
                defaultValue: DEFAULT_CUSTOM_INK_HEX,
                label: "Custom effect ink",
                target: TARGETS.selectedEffectInkColor,
                type: "color",
              },
              effectAmount: {
                applicability: whenImageOrMarkSelected,
                defaultValue: DEFAULT_EFFECT_AMOUNT,
                description:
                  "Cell size for Pixelate and ASCII; smaller values keep more detail.",
                label: "Detail",
                max: MAX_EFFECT_AMOUNT,
                min: MIN_EFFECT_AMOUNT,
                sliderValueKind: "continuous",
                step: 1,
                target: TARGETS.selectedEffectAmount,
                type: "slider",
                unit: "px",
              },
              effectCharset: {
                applicability: whenEffectIsAscii,
                commitMode: "content",
                defaultValue: DEFAULT_ASCII_CHARSET,
                description:
                  "Characters render light to dark, left to right; the leftmost stands in for empty space.",
                label: "Characters",
                target: TARGETS.selectedEffectCharset,
                textValueKind: "single-line",
                type: "text",
              },
            },
            description:
              "Any combination of Pixelate, Recolor, and ASCII can be on for the selected image or library mark, on top of its finish. Pixelate is 1-bit dither.",
            id: "effects",
            title: "Effects",
          },
        ],
        title: "Controls",
      },
    },
    persistence: {
      // The component records are app-owned state, so they are named here to
      // ride the runtime's own versioned workspace persistence.
      additionalValueTargets: [TARGETS.components, TARGETS.selectedKind],
      storage: "localStorage",
    },
    toolbar: {
      history: true,
      radar: true,
      theme: true,
      zoom: true,
    },
  },
  defaults: appDefaults,
  modules: [
    canvasEditingModule(),
    layersModule(),
    mediaSourceModule(),
    imageExportModule(),
  ],
});
