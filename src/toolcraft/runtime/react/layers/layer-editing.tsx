"use client";

import * as React from "react";
import {
  ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem,
  ContextMenuSeparator, ContextMenuShortcut,
} from "@/toolcraft/ui";
import type { ToolcraftState } from "../../state/types";
import type { ToolcraftLayerEdit } from "../../modules/built-ins/layers/contracts";
import { selectedLayerIds } from "../../modules/built-ins/layers/core/selection";
import { useToolcraftStore } from "../app-shell/toolcraft-store-context";
import { useToolcraftSelector } from "../app-shell/use-toolcraft";

export type LayerEditAction = "duplicate" | "paste" | "delete" | "group" | "merge" | "separate";
export type ToolcraftLayerEditingAdapter = {
  capture(state: ToolcraftState, ids: string[]): unknown;
  edit(action: LayerEditAction, state: ToolcraftState, ids: string[], clipboard: unknown): ToolcraftLayerEdit | null;
  canMerge(state: ToolcraftState, ids: string[]): boolean;
  canSeparate(state: ToolcraftState, ids: string[]): boolean;
};

type LayerEditing = {
  ids: string[];
  canPaste: boolean;
  canMerge: boolean;
  canSeparate: boolean;
  select(id: string | null, additive?: boolean): void;
  prepareMenu(id: string): void;
  run(action: LayerEditAction | "copy"): void;
};
const LayerEditingContext = React.createContext<LayerEditing | null>(null);
export function useToolcraftLayerEditing() { return React.useContext(LayerEditingContext); }

export function isLayerEditingTextTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(
    'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"],[role="dialog"]',
  ));
}

export function LayerEditingProvider({ adapter, children }: {
  adapter?: ToolcraftLayerEditingAdapter; children: React.ReactNode;
}) {
  const store = useToolcraftStore();
  const state = useToolcraftSelector(state => state);
  const clipboard = React.useRef<unknown>(null);
  const [clipboardVersion, setClipboardVersion] = React.useState(0);
  const ids = selectedLayerIds(state);
  const run = React.useCallback((action: LayerEditAction | "copy") => {
    if (!adapter) return;
    const current = store.getState();
    const selection = selectedLayerIds(current);
    if (action === "copy") {
      if (!selection.length) return;
      clipboard.current = adapter.capture(current, selection);
      setClipboardVersion(version => version + 1);
      return;
    }
    const edit = adapter.edit(action, current, selection, clipboard.current);
    if (edit) store.dispatch({ type: "layers.applyEdit", ...edit });
  }, [adapter, store]);

  React.useEffect(() => {
    if (!adapter) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.repeat || event.altKey || isLayerEditingTextTarget(event.target)) return;
      const modifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const ids = selectedLayerIds(store.getState());
      let action: LayerEditAction | "copy" | undefined;
      if (modifier && !event.shiftKey && key === "c" && ids.length) action = "copy";
      if (modifier && !event.shiftKey && key === "v" && clipboard.current) action = "paste";
      if (!modifier && (key === "backspace" || key === "delete") && ids.length) action = "delete";
      if (!action) return;
      event.preventDefault();
      run(action);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [adapter, run, store]);

  const value: LayerEditing | null = adapter ? {
    ids,
    canPaste: clipboardVersion > 0 && clipboard.current !== null,
    canMerge: adapter.canMerge(state, ids),
    canSeparate: adapter.canSeparate(state, ids),
    select: (layerId, additive = false) => store.dispatch({ type: "layers.select", layerId, additive }),
    prepareMenu: layerId => {
      if (!selectedLayerIds(store.getState()).includes(layerId)) store.dispatch({ type: "layers.select", layerId });
    },
    run,
  } : null;
  return <LayerEditingContext.Provider value={value}>{children}</LayerEditingContext.Provider>;
}

/** Runtime-owned menu shared by layer rows and product hit targets. */
export function ToolcraftLayerContextMenu({ layerId, children }: { layerId: string; children: React.ReactElement }) {
  const editing = useToolcraftLayerEditing();
  if (!editing) return children;
  const mod = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl+";
  return <ContextMenu onOpenChange={open => { if (open) editing.prepareMenu(layerId); }}>
    <ContextMenuTrigger render={children} />
    <ContextMenuContent aria-label="Layer actions">
      <ContextMenuItem onClick={() => editing.run("duplicate")}>Duplicate</ContextMenuItem>
      <ContextMenuItem onClick={() => editing.run("copy")}>Copy<ContextMenuShortcut>{mod}C</ContextMenuShortcut></ContextMenuItem>
      <ContextMenuItem disabled={!editing.canPaste} onClick={() => editing.run("paste")}>Paste<ContextMenuShortcut>{mod}V</ContextMenuShortcut></ContextMenuItem>
      <ContextMenuSeparator />
      {editing.ids.length > 1 && <ContextMenuItem onClick={() => editing.run("group")}>Group selected layers</ContextMenuItem>}
      {editing.ids.length > 1 && <ContextMenuItem disabled={!editing.canMerge} onClick={() => editing.run("merge")}>Merge selected layers</ContextMenuItem>}
      {editing.canSeparate && <ContextMenuItem onClick={() => editing.run("separate")}>Separate components</ContextMenuItem>}
      <ContextMenuItem
        variant="destructive"
        className="data-[variant=destructive]:text-[#A6C83D] data-[variant=destructive]:hover:bg-[color:color-mix(in_oklab,#A6C83D_10%,transparent)] data-[variant=destructive]:focus:bg-[color:color-mix(in_oklab,#A6C83D_10%,transparent)] data-[variant=destructive]:focus:text-[#A6C83D] data-[variant=destructive]:[&_[data-slot=context-menu-shortcut]]:text-[#A6C83D] data-[variant=destructive]:*:[svg]:text-[#A6C83D]"
        onClick={() => editing.run("delete")}
      >Delete<ContextMenuShortcut>⌫</ContextMenuShortcut></ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>;
}
