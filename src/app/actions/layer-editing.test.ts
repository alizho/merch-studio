import { appSchema } from "../app-schema";
import { describe, expect, it } from "vitest";
import { createToolcraftState } from "@/toolcraft/runtime/state/create-template-state";
import { createToolcraftExternalStore } from "@/toolcraft/runtime/composition/public-state";
import { selectedLayerIds } from "@/toolcraft/runtime/modules/built-ins/layers/core/selection";
import { type ToolcraftState, type ToolcraftImageAsset } from "@/toolcraft/runtime";
import { layerEditingAdapter } from "./layer-editing";
import { readComponentRecord, readComponents, TARGETS } from "../state/components";
import { mergeParts, separateParts } from "../state/compound-components";

const a = readComponentRecord({ kind: "mark", markId: "logo", centerX: 100, centerY: 100, width: 80, height: 40, rotation: 30 })!;
const b = readComponentRecord({ kind: "text", text: "EDIT ME", centerX: 250, centerY: 160, typography: { size: 32 }, width: 100, height: 40 })!;
function fixture() {
  const schema = appSchema;
  const state = createToolcraftState(schema);
  return { ...state, layers: [{ id: "a", name: "Mark", visible: true }, { id: "b", name: "Type", visible: true }], selectedLayerId: "a", selectedLayerIds: ["a"],
    values: { ...state.values, [TARGETS.components]: { a, b }, [TARGETS.selectedKind]: "mark" } } satisfies ToolcraftState;
}

it("component layer edits preserve independent copies and atomic undo", () => {
  const store = createToolcraftExternalStore(fixture());
  const before = store.getState();
  const clipboard = layerEditingAdapter.capture(before, ["a", "b"]);
  const edit = layerEditingAdapter.edit("paste", before, [], clipboard)!;
  store.dispatch({ type: "layers.applyEdit", ...edit });
  expect(store.getState().layers).toHaveLength(4);
  expect(store.getState().history.undo).toHaveLength(1);
  const ids = selectedLayerIds(store.getState());
  expect(ids).toHaveLength(2);
  const records = readComponents(store.getState().values);
  expect(records[ids[0]].centerX).toBe(a.centerX + 16);
  expect(records[ids[1]].text).toBe("EDIT ME");
  expect(records.a).toEqual(a);
  store.dispatch({ type: "history.undo" });
  expect(store.getState().layers).toEqual(before.layers);
  expect(store.getState().values).toEqual(before.values);
  store.dispatch({ type: "history.redo" });
  expect(store.getState().layers).toHaveLength(4);
  const deletion = layerEditingAdapter.edit("delete", store.getState(), ids, null)!;
  store.dispatch({ type: "layers.applyEdit", ...deletion });
  expect(store.getState().layers).toHaveLength(2);
  expect(selectedLayerIds(store.getState())).toEqual([]);
  store.dispatch({ type: "history.undo" });
  expect(store.getState().layers).toHaveLength(4);
  expect(selectedLayerIds(store.getState())).toEqual(ids);
});

describe("layer selection and grouping", () => {
  it("toggles Shift selection and clears selection without adding history", () => {
    const store = createToolcraftExternalStore(fixture());
    store.dispatch({ type: "layers.select", layerId: "b", additive: true });
    expect(selectedLayerIds(store.getState())).toEqual(["a", "b"]);
    store.dispatch({ type: "layers.select", layerId: "a", additive: true });
    expect(selectedLayerIds(store.getState())).toEqual(["b"]);
    store.dispatch({ type: "layers.select", layerId: null });
    expect(selectedLayerIds(store.getState())).toEqual([]);
    expect(store.getState().history.undo).toHaveLength(0);
  });
  it("groups selected roots once and copies a subtree without duplicate children", () => {
    const state = fixture();
    const group = layerEditingAdapter.edit("group", state, ["a", "b"], null)!;
    expect(group.layers).toHaveLength(3);
    expect(group.layers.slice(1).every(layer => layer.parentGroupId === group.layers[0].id)).toBe(true);
    const grouped = { ...state, layers: group.layers };
    const copied = layerEditingAdapter.edit("duplicate", grouped, [group.layers[0].id, "a"], null)!;
    expect(copied.layers).toHaveLength(6);
    expect(copied.layers[1].parentGroupId).toBe(copied.layers[0].id);
    expect(copied.layers[2].parentGroupId).toBe(copied.layers[0].id);
    expect(copied.selectedLayerIds).toEqual([copied.layers[0].id]);
  });
  it("does not merge artwork from different garment faces", () => {
    const state = fixture();
    state.values[TARGETS.components] = { a, b: { ...b, view: "back" } };
    expect(layerEditingAdapter.canMerge(state, ["a", "b"])).toBe(false);
  });
});

it("merged parts retain geometry, text and appearance through resize and separation", () => {
  const merged = mergeParts([{ name: "Mark", record: a, visible: true }, { name: "Type", record: b, visible: true }], record => record);
  expect(merged.kind).toBe("compound");
  expect(merged.rasterDataUrl).toBeUndefined();
  const restored = readComponentRecord(JSON.parse(JSON.stringify(merged)))!;
  expect(restored.parts).toHaveLength(2);
  const separated = separateParts(restored);
  expect(separated[0].record.centerX).toBeCloseTo(a.centerX);
  expect(separated[1].record.centerY).toBeCloseTo(b.centerY);
  expect(separated[1].record.text).toBe("EDIT ME");
  const scaled = separateParts({ ...restored, width: restored.width * 2, height: restored.height * 2, rotation: 90 });
  expect(scaled[1].record.typography!.size).toBe(64);
  expect(scaled[0].record.rotation).toBe(120);
});

it("copies media metadata with independent identity and survives deleting the original", () => {
  const state = fixture();
  const asset = { id: "media-a", assetKind: "image", layerId: "a", resourceRef: `media:image:sha256:${"a".repeat(64)}`, sourceSize: { width: 80, height: 40 } } as ToolcraftImageAsset;
  state.mediaAssets = [asset];
  state.values[TARGETS.components] = { a: { ...a, kind: "image", mediaId: asset.id, resourceRef: asset.resourceRef }, b };
  const copy = layerEditingAdapter.edit("duplicate", state, ["a"], null)!;
  const copiedId = copy.selectedLayerIds[0];
  const copiedMedia = copy.mediaAssets.find(media => media.layerId === copiedId)! as ToolcraftImageAsset;
  expect(copiedMedia.id).not.toBe(asset.id);
  expect(copiedMedia.resourceRef).toBe(asset.resourceRef);
  expect(readComponents(copy.values)[copiedId].mediaId).toBe(copiedMedia.id);
  const deletion = layerEditingAdapter.edit("delete", { ...state, ...copy, values: { ...state.values, ...copy.values } }, ["a"], null)!;
  expect(deletion.mediaAssets).toEqual([copiedMedia]);
});
