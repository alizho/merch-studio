"use client";

/**
 * Colorway swatch rows for the garment and for component ink.
 *
 * The value is a stock colorway id, or `custom` when the design uses a dye the
 * stock list does not carry. That pairing is the reason this is not an
 * `imagePicker`: the picker's value is membership in a fixed set and has no way
 * to hand off to an arbitrary color, while the built-in `color` control has no
 * curated stock list. Here one row carries both, and the custom square shows
 * the live custom color inside a rainbow ring so the active dye is visible
 * without opening the picker.
 *
 * Chrome is the kit's: the toggle primitives own the frame, hover, focus, and
 * pressed states. Product geometry is only the square size and the color fill.
 */

import * as React from "react";
import type { ToolcraftCustomControlRendererProps } from "@/toolcraft/runtime/react";
import {
  ControlFieldLabel,
  Field,
  ToggleGroup,
  ToggleGroupItem,
} from "@/toolcraft/ui";

import {
  CUSTOM_COLORWAY_ID,
  DEFAULT_CUSTOM_GARMENT_HEX,
  DEFAULT_CUSTOM_INK_HEX,
  GARMENT_COLORWAYS,
  INK_COLORWAYS,
  readHexColor,
  type Colorway,
} from "../design/tokens";
import { TARGETS } from "../state/components";
import styles from "./colorway-control.module.css";

/** A hue sweep rather than an image, so the custom square stays crisp. */
const RAINBOW_RING =
  "conic-gradient(from 90deg, #F7FE62, #6BE07A, #35C8D8, #4C6BF5, #B44CF0, #F0417A, #F58A2E, #F7FE62)";

export type ColorwayControlProps = {
  /** Reads the active custom hex so the custom square can show it. */
  customHex: string;
  name: string;
  onSelect: (colorwayId: string) => void;
  swatches: readonly Colorway[];
  value: string;
};

export function ColorwayRow({
  customHex,
  name,
  onSelect,
  swatches,
  value,
}: ColorwayControlProps): React.JSX.Element {
  const handleValueChange = React.useCallback(
    (groupValue: string[]) => {
      const next = groupValue[0];

      // A toggle group can clear itself; a garment always has a color, so a
      // second click on the active swatch keeps it rather than unsetting it.
      if (typeof next === "string" && next.length > 0) {
        onSelect(next);
      }
    },
    [onSelect],
  );

  return (
    <Field>
      <ControlFieldLabel>{name}</ControlFieldLabel>
      <ToggleGroup
        className={styles.row}
        onValueChange={handleValueChange}
        spacing={1}
        value={[value]}
        variant="outline"
      >
        {swatches.map((colorway) => (
          <ToggleGroupItem
            aria-label={colorway.label}
            className={styles.swatch}
            key={colorway.id}
            title={colorway.label}
            value={colorway.id}
          >
            <span className={styles.chip} style={{ background: colorway.hex }} />
          </ToggleGroupItem>
        ))}
        <ToggleGroupItem
          aria-label="Custom color"
          className={styles.swatch}
          title="Custom color"
          value={CUSTOM_COLORWAY_ID}
        >
          <span className={styles.custom} style={{ background: RAINBOW_RING }}>
            <span
              className={styles.customCenter}
              style={{ background: customHex }}
            />
          </span>
        </ToggleGroupItem>
      </ToggleGroup>
    </Field>
  );
}

function renderColorwayRow({
  customTarget,
  defaultCustomHex,
  props,
  swatches,
}: {
  customTarget: string;
  defaultCustomHex: string;
  props: ToolcraftCustomControlRendererProps;
  swatches: readonly Colorway[];
}): React.JSX.Element {
  const { name, setValue, state, value } = props;

  return (
    <ColorwayRow
      customHex={readHexColor(state.values[customTarget], defaultCustomHex)}
      name={name}
      onSelect={setValue}
      swatches={swatches}
      value={typeof value === "string" ? value : ""}
    />
  );
}

export function GarmentColorwayControl(
  props: ToolcraftCustomControlRendererProps,
): React.JSX.Element {
  return renderColorwayRow({
    customTarget: TARGETS.garmentCustomColor,
    defaultCustomHex: DEFAULT_CUSTOM_GARMENT_HEX,
    props,
    swatches: GARMENT_COLORWAYS,
  });
}

export function InkColorwayControl(
  props: ToolcraftCustomControlRendererProps,
): React.JSX.Element {
  return renderColorwayRow({
    customTarget: TARGETS.selectedInkColor,
    defaultCustomHex: DEFAULT_CUSTOM_INK_HEX,
    props,
    swatches: INK_COLORWAYS,
  });
}
