import type { ToolcraftLayer, ToolcraftMediaAsset, ToolcraftState } from "@/toolcraft/runtime";
import { isToolcraftLayerVisibleInTree, type ToolcraftLayerEditingAdapter } from "@/toolcraft/runtime/react";
import { readComponents, TARGETS, type ComponentMap, type ComponentRecord } from "../state/components";
import { mergeParts, remapComponentMedia, separateParts } from "../state/compound-components";
import { measureComponent } from "../renderer/compose";
import { measureContext } from "../renderer/measure";
import { resolveGarmentView } from "../design/tokens";
import { panelFromRecord, panelWrites } from "../state/selection-values";

function newId(prefix: string) { return `${prefix}-${crypto.randomUUID()}`; }

function selectionBlock(layers: ToolcraftLayer[], ids: string[]): ToolcraftLayer[] {
  const selected = new Set(ids);
  let changed = true;
  while (changed) {
    changed = false;
    for (const layer of layers) {
      if (layer.parentGroupId && selected.has(layer.parentGroupId) && !selected.has(layer.id)) {
        selected.add(layer.id); changed = true;
      }
    }
  }
  return layers.filter(layer => selected.has(layer.id));
}

type Clipboard = { layers: ToolcraftLayer[]; components: ComponentMap; media: ToolcraftMediaAsset[] };
function capture(state: ToolcraftState, ids: string[]): Clipboard {
  const layers = selectionBlock(state.layers, ids);
  const components = readComponents(state.values);
  const included = new Set(layers.map(layer => layer.id));
  return structuredClone({
    layers,
    components: Object.fromEntries(layers.filter(layer => components[layer.id]).map(layer => [layer.id, components[layer.id]])),
    media: state.mediaAssets.filter(asset => included.has(asset.layerId)),
  });
}

function componentLayers(state: ToolcraftState, ids: string[]) {
  const components = readComponents(state.values);
  return selectionBlock(state.layers, ids).filter(layer => components[layer.id]);
}

export const layerEditingAdapter: ToolcraftLayerEditingAdapter = {
  capture,
  canMerge(state, ids) {
    const components = readComponents(state.values);
    const layers = componentLayers(state, ids);
    return ids.length > 1 && layers.length > 1 && new Set(layers.map(layer => resolveGarmentView(components[layer.id].view))).size === 1;
  },
  canSeparate(state, ids) {
    return ids.length === 1 && readComponents(state.values)[ids[0]]?.kind === "compound";
  },
  edit(action, state, ids, clipboard) {
    let layers = [...state.layers];
    let mediaAssets = [...state.mediaAssets];
    let components = { ...readComponents(state.values) };
    let selected = [...ids];
    let label = "Edit layers";
    const block = selectionBlock(layers, ids);
    const blockIds = new Set(block.map(layer => layer.id));
    const insertion = Math.max(0, layers.findIndex(layer => blockIds.has(layer.id)));
    const roots = block.filter(layer => !layer.parentGroupId || !blockIds.has(layer.parentGroupId));
    const parent = roots.length && roots.every(layer => layer.parentGroupId === roots[0].parentGroupId) ? roots[0].parentGroupId : undefined;

    if (action === "paste" || action === "duplicate") {
      const source = action === "duplicate" ? capture(state, ids) : clipboard as Clipboard | null;
      if (!source?.layers.length) return null;
      const layerIds = new Map(source.layers.map(layer => [layer.id, newId("component")]));
      const mediaIds = new Map(source.media.map(asset => [asset.id, newId("media")]));
      const copies = source.layers.map(layer => ({ ...layer, id: layerIds.get(layer.id)!,
        name: `${layer.displayName ?? layer.name} copy`, displayName: `${layer.displayName ?? layer.name} copy`,
        parentGroupId: layer.parentGroupId && layerIds.has(layer.parentGroupId) ? layerIds.get(layer.parentGroupId) : parent,
      }));
      for (const [oldId, record] of Object.entries(source.components)) {
        const copy = remapComponentMedia(structuredClone(record), mediaIds);
        components[layerIds.get(oldId)!] = { ...copy, centerX: copy.centerX + 16, centerY: copy.centerY + 16 };
      }
      layers.splice(insertion, 0, ...copies);
      mediaAssets.push(...source.media.map(asset => ({ ...structuredClone(asset), id: mediaIds.get(asset.id)!, layerId: layerIds.get(asset.layerId)! })));
      selected = copies.filter(layer => !layer.parentGroupId || !copies.some(copy => copy.id === layer.parentGroupId)).map(layer => layer.id);
      label = action === "paste" ? "Paste components" : "Duplicate components";
    } else if (action === "delete") {
      if (!block.length) return null;
      layers = layers.filter(layer => !blockIds.has(layer.id));
      mediaAssets = mediaAssets.filter(asset => !blockIds.has(asset.layerId));
      for (const id of blockIds) delete components[id];
      selected = [];
      label = "Delete components";
    } else if (action === "group") {
      if (roots.length < 2) return null;
      const id = newId("group");
      const group: ToolcraftLayer = { id, name: "Group", displayName: "Group", kind: "group", visible: true, collapsed: false, parentGroupId: parent };
      const rootIds = new Set(roots.map(layer => layer.id));
      const moved = block.map(layer => rootIds.has(layer.id) ? { ...layer, parentGroupId: id } : layer);
      layers = layers.filter(layer => !blockIds.has(layer.id));
      layers.splice(insertion, 0, group, ...moved);
      selected = [id]; label = "Group components";
    } else if (action === "merge") {
      if (!this.canMerge(state, ids)) return null;
      const source = componentLayers(state, ids);
      const id = newId("component");
      const record = mergeParts(source.map(layer => ({
        name: layer.displayName ?? layer.name,
        visible: isToolcraftLayerVisibleInTree(state.layers, layer.id),
        record: components[layer.id],
      })), record => measureComponent(measureContext(), record));
      layers = layers.filter(layer => !blockIds.has(layer.id));
      layers.splice(insertion, 0, { id, name: "Merged component", kind: "layer", visible: true, parentGroupId: parent });
      mediaAssets = mediaAssets.map(asset => blockIds.has(asset.layerId) ? { ...asset, layerId: id } : asset);
      for (const oldId of blockIds) delete components[oldId];
      components[id] = record;
      selected = [id]; label = "Merge components";
    } else if (action === "separate") {
      if (!this.canSeparate(state, ids)) return null;
      const parts = separateParts(components[ids[0]]);
      const newLayers: ToolcraftLayer[] = [];
      for (const part of parts) {
        const id = newId("component");
        newLayers.push({ id, name: part.name, displayName: part.name, kind: "layer", visible: part.visible, parentGroupId: parent });
        components[id] = part.record;
        mediaAssets = mediaAssets.map(asset => asset.id === part.record.mediaId ? { ...asset, layerId: id } : asset);
      }
      layers = layers.filter(layer => layer.id !== ids[0]);
      layers.splice(insertion, 0, ...newLayers);
      delete components[ids[0]];
      selected = newLayers.map(layer => layer.id); label = "Separate components";
    }
    const active: ComponentRecord | undefined = selected.length === 1 ? components[selected[0]] : undefined;
    return { layers, mediaAssets, selectedLayerIds: selected, label,
      values: {
        [TARGETS.components]: components,
        ...Object.fromEntries(active ? panelWrites(panelFromRecord(active)) : [[TARGETS.selectedKind, ""]]),
      },
    };
  },
};
