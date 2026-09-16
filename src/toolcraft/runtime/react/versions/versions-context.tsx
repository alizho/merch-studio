"use client";
import * as React from "react";
import { createToolcraftAppDefaults } from "../../schema/app-defaults";
import { parseToolcraftWorkspaceDefaults, readToolcraftWorkspaceDefaults } from "../../composition/workspace-defaults";
import { createToolcraftState } from "../../state/create-template-state";
import type { ToolcraftState } from "../../state/types";
import { useToolcraftStore } from "../app-shell/toolcraft-store-context";
import { ToolcraftSourceAssetCoordinatorContext } from "../app-shell/toolcraft-source-asset-context";
import { ToolcraftThemeContext } from "../app-shell/theme-runtime";
import { deleteVersion, listVersions, readVersionResources, saveVersion, type SavedVersion } from "./version-repository";

type VersionsContext = {
  versions: SavedVersion[];
  busy: boolean;
  ready: boolean;
  error: string | null;
  message: string | null;
  save: () => void;
  remove: (version: SavedVersion) => void;
  restore: (version: SavedVersion) => void;
};
const Context = React.createContext<VersionsContext | null>(null);
export function useVersions() { return React.useContext(Context); }

export function VersionsProvider({ children }: { children: React.ReactNode }) {
  const store = useToolcraftStore();
  const coordinator = React.useContext(ToolcraftSourceAssetCoordinatorContext);
  const theme = React.useContext(ToolcraftThemeContext);
  const [versions, setVersions] = React.useState<SavedVersion[]>([]);
  const [ready, setReady] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const lock = React.useRef(false);
  const parent = React.useRef<string | null>(null);
  const appId = store.getState().schema.identity.id;
  const refresh = React.useCallback(async () => setVersions(await listVersions(appId)), [appId]);
  React.useEffect(() => {
    let active = true;
    listVersions(appId).then(rows => {
      if (active) { setVersions(rows); setReady(true); }
    }).catch(reason => { if (active) setError(String(reason)); });
    return () => { active = false; };
  }, [appId]);

  const capture = async (state: ToolcraftState, name?: string) => {
    if (state.mediaAssets.length && !coordinator?.captureDefaultResources) throw new Error("Artwork storage is not ready. Please retry.");
    const uploads = await coordinator?.captureDefaultResources?.(state.mediaAssets) ?? [];
    const snapshot = createToolcraftAppDefaults(state, uploads.map(upload => upload.resource), theme?.themePreference);
    const version: SavedVersion = {
      id: crypto.randomUUID(), appId, createdAt: Date.now(),
      name: name ?? `Version ${Math.max(0, ...(await listVersions(appId)).map(row => Number(/^Version (\d+)$/.exec(row.name)?.[1] ?? 0))) + 1}`,
      parentId: parent.current, snapshot,
    };
    await saveVersion(version, uploads);
    return version;
  };
  const run = (task: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null); setMessage(null);
    void task().catch(reason => setError(reason instanceof Error ? reason.message : "Could not save or restore. Please retry."))
      .finally(() => { lock.current = false; setBusy(false); void refresh().catch(() => {}); });
  };
  const save = () => run(async () => {
    const version = await capture(store.getState());
    parent.current = version.id;
    setMessage(`${version.name} saved.`);
  });
  const remove = (version: SavedVersion) => run(async () => {
    await deleteVersion(appId, version.id);
    if (parent.current === version.id) parent.current = null;
    setMessage(`${version.name} deleted.`);
  });
  const restore = (version: SavedVersion) => run(async () => {
    const before = store.getState();
    const snapshot = parseToolcraftWorkspaceDefaults(before.schema, version.snapshot);
    const uploads = await readVersionResources(version);
    if (uploads.length && !coordinator?.restoreVersionResources) throw new Error("Artwork storage is not ready. Please retry.");
    const release = await coordinator?.restoreVersionResources?.(uploads);
    try {
      const initial = readToolcraftWorkspaceDefaults(before.schema, snapshot);
      const restored = createToolcraftState(before.schema, initial);
      const assets = await Promise.all(restored.mediaAssets.map(async asset => {
        const resolved = await coordinator?.resolveSettingsAsset?.(asset);
        if (!resolved) throw new Error("Saved artwork could not be restored. Your current design has not been changed.");
        return resolved;
      }));
      const next = { ...restored, mediaAssets: assets };
      await capture(before, "Before restore");
      if (store.getState() !== before) throw new Error("The design changed during restore. Please retry; your edits are safe.");
      store.replaceWorkspace(next);
      theme?.setThemePreference(snapshot.theme);
      parent.current = version.id;
      setMessage(`${version.name} restored. Previous draft saved as a recovery checkpoint.`);
    } finally { release?.(); }
  });
  return <Context.Provider value={{ versions, busy, ready, error, message, save, restore, remove }}>{children}</Context.Provider>;
}
