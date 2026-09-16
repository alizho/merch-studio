/**
 * Builds the renderer's scene description from runtime state.
 *
 * Preview and export both read the scene through here, so neither can drift
 * from the other.
 */

import { isToolcraftLayerVisibleInTree } from "@/toolcraft/runtime/react";
import type { ToolcraftLayer } from "@/toolcraft/runtime";

import {
  resolveGarment,
  resolveGarmentColorway,
  resolveGarmentView,
  resolveTreatment,
} from "../design/tokens";
import { readComponents, TARGETS } from "./components";
import type { DesignScene } from "../renderer/compose";

/** Structural view of the state this module needs, so it reads both the live
 *  store state and the readonly state handed to the export renderer. */
type StateLike = {
  layers: readonly ToolcraftLayer[];
  values: Record<string, unknown>;
};

export function readScene(state: StateLike): DesignScene {
  const components = readComponents(state.values);
  const garment = resolveGarment(state.values[TARGETS.garmentType]);
  const view = resolveGarmentView(state.values[TARGETS.garmentView]);

  return {
    components,
    garment,
    garmentColorHex: resolveGarmentColorway(
      state.values[TARGETS.garmentColor],
      state.values[TARGETS.garmentCustomColor],
    ).hex,
    layerIds: state.layers
      .filter(
        (layer: ToolcraftLayer) =>
          Boolean(components[layer.id]) &&
          isToolcraftLayerVisibleInTree([...state.layers], layer.id),
      )
      .map((layer: ToolcraftLayer) => layer.id),
    treatment: resolveTreatment(state.values[TARGETS.treatment]),
    view,
  };
}

/** Garment art URLs the current scene needs decoded. */
export function sceneGarmentSources(scene: DesignScene): readonly string[] {
  return [scene.garment.sources[scene.view]];
}
