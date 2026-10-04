import type { ToolcraftState } from "../../../../state/types";

/** Legacy/single-select writers remain compatible; stale IDs never revive. */
export function selectedLayerIds(state: Pick<ToolcraftState, "layers" | "selectedLayerId" | "selectedLayerIds">): string[] {
  if (!state.selectedLayerId) return [];
  const candidates = state.selectedLayerIds?.includes(state.selectedLayerId)
    ? state.selectedLayerIds : [state.selectedLayerId];
  return candidates.filter(id => state.layers.some(layer => layer.id === id));
}
