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
 * with it. Image records are checked against their asset's content, because
 * the runtime recycles layer and media ids for later uploads.
 */

import * as React from "react";
import type {
  ToolcraftCommand,
  ToolcraftLayer,
  ToolcraftMediaAsset,
} from "@/toolcraft/runtime";

import {
  resolveGarment,
  resolveGarmentView,
  resolveTreatment,
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
import {
  raisePlacedLayers,
  reconcileImageComponents,
  type DecodedImageSize,
} from "./image-components";

type SyncInputs = {
  dispatch: React.Dispatch<ToolcraftCommand>;
  /** Decoded, oriented pixel sizes by media id. */
  importedImages: ReadonlyMap<string, DecodedImageSize>;
  layers: readonly ToolcraftLayer[];
  mediaAssets: readonly ToolcraftMediaAsset[];
  selectedLayerId: string | null;
  values: Record<string, unknown>;
};

export function useSelectionSync({
  dispatch,
  importedImages,
  layers,
  mediaAssets,
  selectedLayerId,
  values,
}: SyncInputs): void {
  // Image layers that arrived with the saved workspace (layers and media are
  // restored before the first render), captured once.
  const restoredLayerIdsRef = React.useRef<ReadonlySet<string> | null>(null);
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

    // Imported artwork arrives as a runtime media layer. Give each one a record
    // for exactly that import, and keep its box on the decoded pixel ratio.
    // This returns early so the selection pass below sees the new record.
    restoredLayerIdsRef.current ??= new Set(
      mediaAssets.map((asset) => asset.layerId),
    );

    const garment = resolveGarment(values[TARGETS.garmentType]);
    const view = resolveGarmentView(values[TARGETS.garmentView]);
    const reconciled = reconcileImageComponents({
      components,
      decoded: importedImages,
      layerIds: new Set(layers.map((layer) => layer.id)),
      mediaAssets,
      placement:
        garment.placement[resolveGarmentView(values[TARGETS.garmentView])],
      restoredLayerIds: restoredLayerIdsRef.current,
      treatment: resolveTreatment(values[TARGETS.selectedTreatment]),
      view,
    });

    if (reconciled) {
      writeComponents(reconciled.components, "Place artwork");

      // New uploads join the top of the stack like text and marks. The runtime
      // records reorders as their own step, so undoing an upload first drops it
      // back to where the runtime put it, then removes it.
      const raised = raisePlacedLayers(layers, reconciled.placedLayerIds);

      if (raised) {
        dispatch({ layers: raised, selectedLayerId, type: "layers.reorder" });
      }

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

    // A deliberate layer selection navigates to its face. Merely flipping the
    // garment never carries the old face's panel edits onto an invisible record.
    if (record && resolveGarmentView(record.view) !== view) {
      if (lastRef.current && lastRef.current.layerId !== selectedLayerId) {
        dispatch({
          type: "controls.setValue",
          target: TARGETS.garmentView,
          value: resolveGarmentView(record.view),
          history: "skip",
        });
      } else {
        lastRef.current = { layerId: selectedLayerId, panel: { ...panelNow, kind: "" } };
        if (panelNow.kind !== "") {
          dispatch({ type: "controls.setValue", target: TARGETS.selectedKind, value: "", history: "skip" });
        }
      }
      return;
    }

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

      // Applicability can only AND predicates, so Pixelate-or-ASCII visibility
      // reads this mirrored flag instead of two separate booleans.
      const modeActive = panelNow.effectPixelate || panelNow.effectAscii;

      if (values[TARGETS.selectedEffectModeActive] !== modeActive) {
        dispatch({
          history: "skip",
          target: TARGETS.selectedEffectModeActive,
          type: "controls.setValue",
          value: modeActive,
        });
      }

      return;
    }

    // The record changed elsewhere (a canvas gesture, undo, or redo), so the
    // panel follows it.
    if (!panelEqual(panelFromRecord(record), panelNow)) {
      hydrate(record);
    }
  }, [dispatch, importedImages, layers, mediaAssets, selectedLayerId, values]);
}
