"use client";

/**
 * Image library tiles that stamp a mark onto the garment on every click.
 *
 * Built-in `imagePicker` stores one selected id and treats a second click on
 * the same tile as a no-op, so it cannot place another copy of the visible
 * mark. This control reuses the public ImagePicker chrome and, on every tile
 * click, writes the last-used id and dispatches the same place commands as
 * Add text.
 */

import * as React from "react";
import type { ToolcraftCustomControlRendererProps } from "@/toolcraft/runtime/react";
import { ImagePicker } from "@/toolcraft/ui";

import { placeMark } from "../actions/place-component";
import { MARK_ITEMS } from "../design/swatches";

export function LibraryStampControl(
  props: ToolcraftCustomControlRendererProps,
): React.JSX.Element {
  const { dispatch, name, setValue, state, value } = props;

  return (
    <ImagePicker
      items={MARK_ITEMS}
      name={name}
      onValueChange={(markId) => {
        setValue(markId);
        placeMark(
          dispatch,
          state.values as Record<string, unknown>,
          markId,
        );
      }}
      value={typeof value === "string" ? value : ""}
    />
  );
}
