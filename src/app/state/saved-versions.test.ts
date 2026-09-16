import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { createToolcraftState } from "@/toolcraft/runtime/state/create-template-state";
import { createToolcraftExternalStore } from "@/toolcraft/runtime/composition/public-state";
import { createToolcraftAppDefaults } from "@/toolcraft/runtime/schema/app-defaults";
import { readToolcraftWorkspaceDefaults } from "@/toolcraft/runtime/composition/workspace-defaults";
import { listVersions, saveVersion, readVersionResources, type SavedVersion } from "@/toolcraft/runtime/react/versions/version-repository";
import { appSchema } from "../app-schema";

it("keeps saved versions immutable and restores both garment sides without changing defaults", async () => {
  const store = createToolcraftExternalStore(createToolcraftState(appSchema));
  const originalDefaults = JSON.stringify(appSchema.sourceDefaults);
  store.dispatch({ type: "controls.setValue", target: "design.components", value: {
    front: { kind: "text", view: "front", text: "FRONT" },
    back: { kind: "text", view: "back", text: "BACK" },
  } });
  const snapshot = createToolcraftAppDefaults(store.getState());
  const version: SavedVersion = { id: crypto.randomUUID(), appId: appSchema.identity.id, createdAt: Date.now(), name: "Version 1", parentId: null, snapshot };
  await saveVersion(version, []);
  store.dispatch({ type: "controls.setValue", target: "design.components", value: {} });
  const saved = (await listVersions(appSchema.identity.id)).find(row => row.id === version.id)!;
  store.replaceWorkspace(createToolcraftState(appSchema, readToolcraftWorkspaceDefaults(appSchema, saved.snapshot)));
  expect(store.getState().values["design.components"]).toEqual(snapshot.state.values["design.components"]);
  expect(JSON.stringify(appSchema.sourceDefaults)).toBe(originalDefaults);
  await expect(saveVersion({ ...version, name: "Overwrite" }, [])).rejects.toBeTruthy();
  expect((await listVersions(appSchema.identity.id)).find(row => row.id === version.id)?.name).toBe("Version 1");
});

it("stores independent artwork bytes and aborts resource changes when revision publication fails", async () => {
  const resource = { ref: "version-test-image", path: "public/test.bin", sha256: "test", byteLength: 3, contentType: "image/png", dependencies: [], durable: true };
  const snapshot = { ...createToolcraftAppDefaults(createToolcraftState(appSchema)), resources: [resource] };
  const version: SavedVersion = { id: crypto.randomUUID(), appId: "binary-test", createdAt: Date.now(), name: "With image", parentId: null, snapshot };
  const bytes = new Uint8Array([1, 2, 3]);
  await saveVersion(version, [{ resource, bytes }]);
  bytes.fill(0);
  expect((await readVersionResources(version))[0].bytes).toEqual(new Uint8Array([1, 2, 3]));
  await expect(saveVersion(version, [{ resource, bytes: new Uint8Array([9, 9, 9]) }])).rejects.toBeTruthy();
  expect((await readVersionResources(version))[0].bytes).toEqual(new Uint8Array([1, 2, 3]));
});

it("deletes only the requested version and preserves shared artwork until its final reference is removed", async () => {
  const { deleteVersion } = await import("@/toolcraft/runtime/react/versions/version-repository");
  const resource = { ref: "shared-deletion-test", path: "public/shared.bin", sha256: "test", byteLength: 1, contentType: "image/png", dependencies: [], durable: true };
  const snapshot = { ...createToolcraftAppDefaults(createToolcraftState(appSchema)), resources: [resource] };
  const first: SavedVersion = { id: crypto.randomUUID(), appId: "delete-test", createdAt: Date.now(), name: "Version 1", parentId: null, snapshot };
  const second = { ...first, id: crypto.randomUUID(), name: "Version 2" };
  await saveVersion(first, [{ resource, bytes: new Uint8Array([7]) }]);
  await saveVersion(second, []);
  await deleteVersion("another-app", first.id);
  expect(await listVersions(first.appId)).toHaveLength(2);
  await deleteVersion(first.appId, first.id);
  expect((await listVersions(first.appId)).map(row => row.id)).toEqual([second.id]);
  expect((await readVersionResources(second))[0].bytes).toEqual(new Uint8Array([7]));
  await deleteVersion(second.appId, second.id);
  expect(await listVersions(first.appId)).toHaveLength(0);
  await expect(readVersionResources(second)).rejects.toThrow("missing artwork");
});
