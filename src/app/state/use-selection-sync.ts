"use client";

/**
 * Reconciles the panel's `selectedLayer.*` view with the component records.
 *
 * Each direction has exactly one writer, and the mirroring write is always
 * `history: "skip"`, because the originating write is already in history:
 * a panel edit is recorded by the control itself, and a canvas gesture is
 * recorded by the gesture. Without that, every edit would cost two undos.
 *
 * Records are never pruned when a layer disappears. Undoing a delete restores
 * the layer, and the surviving record is what makes the component come back
 * with it.
 */

import * as React from "react";
import type {
  ToolcraftCommand,
  ToolcraftLayer,
  ToolcraftMediaAsset,
} from "@/toolcraft/runtime";

import {
  DEFAULT_CUSTOM_INK_HEX,
  DEFAULT_INK_COLORWAY_ID,
  resolveGarment,
  resolveGarmentView,
} from "../design/tokens";
import {
  applyPanelToRecord,
  panelEqual,
  panelFromRecord,
  panelFromValues,
  panelWrites,
  type PanelValues,
} from "./selection-values";
import {
  isComponentKind,
  readComponents,
  TARGETS,
  withComponent,
  type ComponentMap,
  type ComponentRecord,
} from "./components";

/** Fraction of the print area a newly imported image fills. */
const IMPORT_WIDTH_RATIO = 0.7;

type SyncInputs = {
  dispatch: React.Dispatch<ToolcraftCommand>;
  layers: readonly ToolcraftLayer[];
  mediaAssets: readonly ToolcraftMediaAsset[];
  selectedLayerId: string | null;
  values: Record<string, unknown>;
};

export function useSelectionSync({
  dispatch,
  layers,
  mediaAssets,
  selectedLayerId,
  values,
}: SyncInputs): void {
  const lastRef = React.useRef<{
    layerId: string | null;
    panel: PanelValues;
  } | null>(null);

  React.useEffect(() => {
    const components = readComponents(values);

    const writeComponents = (next: ComponentMap, label: string) => {
      dispatch({
        history: "skip",
        label,
        target: TARGETS.components,
        type: "controls.setValue",
        value: next,
      });
    };

    // Imported artwork arrives as a runtime media layer; give it a record so
    // it becomes an editable component.
    const layerIds = new Set(layers.map((layer) => layer.id));
    const adopted = mediaAssets.filter(
      (asset) =>
        asset.assetKind === "image" &&
        layerIds.has(asset.layerId) &&
        !components[asset.layerId],
    );

    if (adopted.length > 0) {
      const garment = resolveGarment(values[TARGETS.garmentType]);
      const placement =
        garment.placement[resolveGarmentView(values[TARGETS.garmentView])];
      let next = components;

      for (const asset of adopted) {
        const width = Math.round(placement.width * IMPORT_WIDTH_RATIO);

        next = withComponent(next, asset.layerId, {
          centerX: placement.x + placement.width / 2,
          centerY: placement.y + placement.height / 2,
          height: width,
          inkHex: DEFAULT_CUSTOM_INK_HEX,
          inkId: DEFAULT_INK_COLORWAY_ID,
          kind: "image",
          mediaId: asset.id,
          rotation: 0,
          width,
        });
      }

      writeComponents(next, "Place artwork");

      return;
    }

    const record = selectedLayerId ? components[selectedLayerId] : undefined;
    const panelNow = panelFromValues(values);
    const editing = isComponentKind(panelNow.kind);

    const hydrate = (target: ComponentRecord) => {
      const panel = panelFromRecord(target);

      for (const [writeTarget, value] of panelWrites(panel)) {
        if (values[writeTarget] !== value) {
          dispatch({
            history: "skip",
            target: writeTarget,
            type: "controls.setValue",
            value,
          });
        }
      }

      lastRef.current = { layerId: selectedLayerId, panel };
    };

    // Selection moved, so the panel adopts the newly selected component.
    if (lastRef.current?.layerId !== selectedLayerId) {
      if (record) {
        if (!lastRef.current && !isComponentKind(panelNow.kind)) {
          lastRef.current = { layerId: selectedLayerId, panel: panelNow };

          return;
        }

        hydrate(record);

        return;
      }

      lastRef.current = { layerId: selectedLayerId, panel: panelNow };

      if (values[TARGETS.selectedKind] !== "") {
        dispatch({
          history: "skip",
          target: TARGETS.selectedKind,
          type: "controls.setValue",
          value: "",
        });
      }

      return;
    }

    if (!record || !selectedLayerId) {
      return;
    }

    // Enter or an empty-canvas click clears the kind so the handles hide.
    // Do not copy that empty panel back onto the record, and do not hydrate
    // the kind back from the still-selected layer.
    if (!editing) {
      lastRef.current = { layerId: selectedLayerId, panel: panelNow };

      return;
    }

    if (!lastRef.current) {
      lastRef.current = { layerId: selectedLayerId, panel: panelNow };

      return;
    }

    // A panel control changed, so the record follows it.
    if (!panelEqual(panelNow, lastRef.current.panel)) {
      lastRef.current = { layerId: selectedLayerId, panel: panelNow };
      writeComponents(
        withComponent(
          components,
          selectedLayerId,
          applyPanelToRecord(record, panelNow),
        ),
        "Edit component",
      );

      return;
    }

    // The record changed elsewhere (a canvas gesture, undo, or redo), so the
    // panel follows it.
    if (!panelEqual(panelFromRecord(record), panelNow)) {
      hydrate(record);
    }
  }, [dispatch, layers, mediaAssets, selectedLayerId, values]);
}
