/**
 * Product design tokens for Merch Studio.
 *
 * The garment and ink sets are stock lists, not interface palettes: Volt and
 * Infra green come from the published Infisical brand stylesheet
 * (https://infisical.com/infisical-brand.css) and anchor the sets, while the
 * rest are the colors blanks and inks actually ship in. Keeping them apart
 * from the tool's own neutrals is what makes a swatch read as cloth.
 *
 * Every set is closed. A design that needs a color outside the stock list uses
 * the custom dye, which is one explicit choice rather than an open palette.
 */

export type Colorway = {
  hex: string;
  id: string;
  label: string;
  /** Where the color comes from, kept so the set stays auditable. */
  token: string;
};

/**
 * The id used when the garment or the ink is dyed to a color the stock list
 * does not carry. The hex itself lives in its own value target, so the curated
 * choice and the custom dye never overwrite each other.
 */
export const CUSTOM_COLORWAY_ID = "custom";

/**
 * Eight garment colorways and no more. A blank garment is a physical product
 * with a real stock list, so this is a curated set of blanks rather than a
 * color picker: three neutrals, black, two deep hues, an earth tone, and the
 * Volt accent. The two brand colors are the anchors; the rest are garment
 * colors rather than interface colors, so the swatch row never reads as a
 * restatement of the tool's own palette.
 */
export const GARMENT_COLORWAYS: readonly Colorway[] = [
  { hex: "#FFFFFF", id: "white", label: "White", token: "neutral-0" },
  { hex: "#E8E1D0", id: "natural", label: "Natural", token: "undyed cotton" },
  { hex: "#B4B8B9", id: "heather", label: "Heather", token: "heather grey" },
  { hex: "#101010", id: "black", label: "Black", token: "neutral-950" },
  { hex: "#1B2A4A", id: "navy", label: "Navy", token: "garment navy" },
  { hex: "#0B4F36", id: "infra", label: "Infra green", token: "forest-900" },
  { hex: "#9C4A32", id: "clay", label: "Clay", token: "garment clay" },
  { hex: "#F7FE62", id: "volt", label: "Volt", token: "volt-400" },
] as const;

/**
 * Ink colorways for placed components. Deliberately smaller than the garment
 * set: these are the colors that actually hold on cotton as plastisol or as
 * embroidery thread.
 */
export const INK_COLORWAYS: readonly Colorway[] = [
  { hex: "#101010", id: "ink", label: "Ink", token: "neutral-950" },
  { hex: "#FFFFFF", id: "white", label: "White", token: "neutral-0" },
  { hex: "#F7FE62", id: "volt", label: "Volt", token: "volt-400" },
  { hex: "#0B4F36", id: "infra", label: "Infra green", token: "forest-900" },
  { hex: "#8C9398", id: "steel", label: "Steel", token: "ink steel" },
  { hex: "#9C4A32", id: "clay", label: "Clay", token: "ink clay" },
] as const;

export const DEFAULT_GARMENT_COLORWAY_ID = "black";
export const DEFAULT_INK_COLORWAY_ID = "volt";

/** Where a custom dye starts: a hue the stock list does not already carry. */
export const DEFAULT_CUSTOM_GARMENT_HEX = "#3D5AFE";
export const DEFAULT_CUSTOM_INK_HEX = "#FF6B3D";

const HEX_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/iu;

/**
 * Reads a hex color out of runtime state. The built-in color control commits
 * `{ hex }`, while a persisted or hand-edited value can be the bare string, so
 * both shapes are accepted and anything else falls back.
 */
export function readHexColor(value: unknown, fallback: string): string {
  const candidate =
    typeof value === "string"
      ? value
      : typeof value === "object" && value !== null
        ? (value as { hex?: unknown }).hex
        : undefined;

  if (typeof candidate !== "string" || !HEX_PATTERN.test(candidate.trim())) {
    return fallback;
  }

  const hex = candidate.trim().toUpperCase();

  if (hex.length === 7) {
    return hex;
  }

  return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
}

function customColorway(hex: string, label: string): Colorway {
  return { hex, id: CUSTOM_COLORWAY_ID, label, token: "custom" };
}

/**
 * Resolves the garment dye. A curated id names a stock blank; the custom id
 * defers to the hex the color control owns.
 */
export function resolveGarmentColorway(
  id: unknown,
  customValue?: unknown,
): Colorway {
  if (id === CUSTOM_COLORWAY_ID) {
    return customColorway(
      readHexColor(customValue, DEFAULT_CUSTOM_GARMENT_HEX),
      "Custom dye",
    );
  }

  return (
    GARMENT_COLORWAYS.find((entry) => entry.id === id) ??
    GARMENT_COLORWAYS.find((entry) => entry.id === DEFAULT_GARMENT_COLORWAY_ID)!
  );
}

export function resolveInkColorway(
  id: unknown,
  customValue?: unknown,
): Colorway {
  if (id === CUSTOM_COLORWAY_ID) {
    return customColorway(
      readHexColor(customValue, DEFAULT_CUSTOM_INK_HEX),
      "Custom ink",
    );
  }

  return (
    INK_COLORWAYS.find((entry) => entry.id === id) ??
    INK_COLORWAYS.find((entry) => entry.id === DEFAULT_INK_COLORWAY_ID)!
  );
}

/** Garment art is authored at a single size, so the canvas matches it exactly. */
export const CANVAS_WIDTH = 1210;
export const CANVAS_HEIGHT = 1346;

export type GarmentType = "tee" | "hoodie";
export type GarmentView = "front" | "back";
export type Treatment = "print" | "embroidery";

/**
 * Where new artwork lands and how large it starts. Artwork is not clipped to
 * this rect: it is masked to the garment itself, so a component can sit
 * anywhere on the cloth.
 */
export type PlacementArea = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type GarmentDefinition = {
  id: GarmentType;
  label: string;
  /** Placement anchor per view, in canvas coordinates. */
  placement: Record<GarmentView, PlacementArea>;
  sources: Record<GarmentView, string>;
};

/**
 * Placement anchors are measured from each garment's alpha channel: new artwork
 * lands on the chest or the back panel at a printable starting size. The hoodie
 * front sits higher so a placed design clears the pocket seam.
 */
export const GARMENTS: readonly GarmentDefinition[] = [
  {
    id: "tee",
    label: "T-shirt",
    placement: {
      back: { height: 600, width: 500, x: 351, y: 380 },
      front: { height: 560, width: 480, x: 355, y: 400 },
    },
    sources: {
      back: "/garments/shirt-back.png",
      front: "/garments/shirt-front.png",
    },
  },
  {
    id: "hoodie",
    label: "Hoodie",
    placement: {
      back: { height: 520, width: 440, x: 380, y: 400 },
      front: { height: 300, width: 420, x: 390, y: 400 },
    },
    sources: {
      back: "/garments/hoodie-back.png",
      front: "/garments/hoodie-front.png",
    },
  },
] as const;

export function resolveGarment(id: unknown): GarmentDefinition {
  return GARMENTS.find((entry) => entry.id === id) ?? GARMENTS[0];
}

export function resolveGarmentView(value: unknown): GarmentView {
  return value === "back" ? "back" : "front";
}

export function resolveTreatment(value: unknown): Treatment {
  return value === "embroidery" ? "embroidery" : "print";
}

/**
 * Effects replace an imported image's pixels before the finish (print/stitch)
 * is applied, and any combination can be on at once: Pixelate mosaics the
 * image into blocks, Recolor bakes a duotone in the effect ink over whatever
 * that leaves, and ASCII redraws whatever remains as monospace glyphs in the
 * effect ink. That fixed order is also the render order: e.g. Pixelate then
 * Recolor keeps the mosaic's hard block edges under the duotone, while
 * turning ASCII on always renders it last regardless of the other two, since
 * it replaces pixels with glyphs outright. Text and marks are unaffected;
 * they already recolor via Ink.
 */
export type ImageEffectToggles = Readonly<{
  ascii: boolean;
  pixelate: boolean;
  recolor: boolean;
}>;

export const NO_IMAGE_EFFECTS: ImageEffectToggles = Object.freeze({
  ascii: false,
  pixelate: false,
  recolor: false,
});

/** Cell size in canvas px for Pixelate blocks and ASCII glyphs. */
export const DEFAULT_EFFECT_AMOUNT = 12;
export const MIN_EFFECT_AMOUNT = 3;
export const MAX_EFFECT_AMOUNT = 48;
/** ASCII glyph ramp, light to dark; the user can replace it with any characters. */
export const DEFAULT_ASCII_CHARSET = " .:-=+*#%@";

export type FaceDefinition = {
  /** CSS/canvas family name registered through the FontFace API. */
  family: string;
  id: string;
  label: string;
  source: string;
  /**
   * Alliance No.2 publishes only Regular, so its weight list is a single entry
   * rather than a synthesized range.
   */
  weights: readonly number[];
};

export const FACES: readonly FaceDefinition[] = [
  {
    family: "AllianceNo2",
    id: "alliance",
    label: "Alliance No.2",
    source: "/fonts/AllianceNo2-Regular.otf",
    weights: [400],
  },
  {
    family: "InterVariable",
    id: "inter",
    label: "Inter",
    source: "/fonts/inter-variable.woff2",
    weights: [400, 500, 600, 700],
  },
  {
    family: "JetBrainsMonoVariable",
    id: "mono",
    label: "JetBrains Mono",
    source: "/fonts/jetbrains-mono-variable.woff2",
    weights: [400, 500, 700],
  },
] as const;

export const DEFAULT_FACE_ID = "alliance";

export function resolveFace(id: unknown): FaceDefinition {
  return FACES.find((entry) => entry.id === id) ?? FACES[0];
}

export type TextCase = "none" | "upper";

export type Typography = {
  faceId: string;
  letterSpacing: number;
  lineHeight: number;
  size: number;
  textCase: TextCase;
  weight: number;
};

export const DEFAULT_TYPOGRAPHY: Typography = {
  faceId: DEFAULT_FACE_ID,
  letterSpacing: 0,
  lineHeight: 1.1,
  size: 72,
  textCase: "none",
  weight: 400,
};
