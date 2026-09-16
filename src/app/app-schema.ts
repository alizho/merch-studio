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
  DEFAULT_CUSTOM_GARMENT_HEX,
  DEFAULT_CUSTOM_INK_HEX,
  DEFAULT_GARMENT_COLORWAY_ID,
  DEFAULT_INK_COLORWAY_ID,
  DEFAULT_TYPOGRAPHY,
} from "./design/tokens";
import { MARK_ITEMS } from "./design/swatches";
import {
  garmentColorwayControlType,
  inkColorwayControlType,
} from "./controls/colorway-control-types";
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
              treatment: {
                applicability: always,
                defaultValue: "print",
                label: "Finish",
                options: [
                  { label: "Print", value: "print" },
                  { label: "Stitch", value: "embroidery" },
                ],
                target: TARGETS.treatment,
                type: "segmented",
              },
            },
            description:
              "Print lays flat ink on the cloth. Stitch renders artwork as embroidery.",
            id: "treatment",
            title: "Treatment",
          },
          {
            controls: {
              mark: {
                applicability: always,
                defaultValue: DEFAULT_MARK_ID,
                items: MARK_ITEMS,
                label: "Library",
                target: TARGETS.libraryMark,
                type: "imagePicker",
              },
              place: {
                actions: [
                  { label: "Add mark", value: "component.addMark" },
                  { label: "Add text", value: "component.addText" },
                ],
                applicability: always,
                label: false,
                target: "component.place",
                type: "actions",
              },
              upload: {
                accept: "image/png,image/jpeg,image/svg+xml,image/webp",
                applicability: always,
                assetKind: "image",
                label: "Import artwork",
                multiple: true,
                target: "media.sources",
                type: "fileDrop",
              },
            },
            id: "artwork",
            title: "Artwork",
          },
          {
            controls: {
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
                label: "Face",
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
              "Applies to the selected component. Drag, scale, and rotate it on the canvas.",
            id: "component",
            title: "Selected",
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
