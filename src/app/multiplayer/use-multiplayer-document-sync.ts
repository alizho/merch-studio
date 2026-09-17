import { useEffect, useRef } from "react";
import type { ToolcraftCommand, ToolcraftLayer } from "@/toolcraft/runtime";
import { useToolcraftDispatch, useToolcraftSelector } from "@/toolcraft/runtime/react";

import { TARGETS, type ComponentMap } from "../state/components";
import { multiplayerSocket, type MultiplayerDocState, type MultiplayerMessage } from "./socket";

const BROADCAST_THROTTLE_MS = 120;

/**
 * `layers.reorder` only accepts a same-id-set reshuffle (see
 * layers-commands.ts) — it silently no-ops if the incoming layer set adds or
 * removes ids. So additions/deletions have to be reconciled with explicit
 * `layers.add` / `layers.delete` commands first; only once the local id set
 * matches the remote one can `layers.reorder` be used to sync order, names,
 * visibility, and grouping in one shot.
 */
function reconcileRemoteLayers(
  dispatch: (command: ToolcraftCommand) => void,
  localLayers: readonly ToolcraftLayer[],
  remoteLayers: readonly ToolcraftLayer[],
): void {
  const remoteIds = new Set(remoteLayers.map((layer) => layer.id));
  const localIds = new Set(localLayers.map((layer) => layer.id));

  for (const layer of localLayers) {
    if (!remoteIds.has(layer.id)) {
      dispatch({ type: "layers.delete", layerId: layer.id });
    }
  }

  remoteLayers.forEach((layer, insertIndex) => {
    if (!localIds.has(layer.id)) {
      dispatch({
        type: "layers.add",
        layer: {
          collapsed: layer.collapsed,
          displayName: layer.displayName,
          id: layer.id,
          kind: layer.kind,
          name: layer.name,
          parentGroupId: layer.parentGroupId,
          visible: layer.visible,
        },
        insertIndex,
      });
    }
  });

  dispatch({ type: "layers.reorder", layers: [...remoteLayers] });
}

/**
 * Mirrors the full document (layers + component properties: position,
 * rotation, scale, effects, treatment, layer order/visibility/deletion) to
 * every other connected browser. There is no diffing or conflict
 * resolution — every local change re-broadcasts the whole document, and
 * every remote "doc" message replaces the whole local document wholesale.
 * That's enough for live collaborative editing, but simultaneous edits from
 * two browsers are last-write-wins.
 */
export function useMultiplayerDocumentSync(): void {
  const dispatch = useToolcraftDispatch();
  const layers = useToolcraftSelector((state) => state.layers);
  const components = useToolcraftSelector(
    (state) => (state.values[TARGETS.components] as ComponentMap | undefined) ?? {},
  );

  // True while this hook is applying a doc that just arrived over the wire,
  // so the broadcast effect below doesn't immediately echo it back out.
  const isApplyingRemoteRef = useRef(false);
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDocRef = useRef<MultiplayerDocState | null>(null);
  const latestDocRef = useRef<MultiplayerDocState>({ layers, components });
  latestDocRef.current = { layers, components };

  useEffect(() => {
    if (isApplyingRemoteRef.current) {
      isApplyingRemoteRef.current = false;
      return;
    }

    pendingDocRef.current = { layers, components };

    if (throttleTimerRef.current) {
      return;
    }

    throttleTimerRef.current = setTimeout(() => {
      throttleTimerRef.current = null;
      const doc = pendingDocRef.current;
      pendingDocRef.current = null;

      if (doc) {
        multiplayerSocket.send({ type: "doc", layers: doc.layers, components: doc.components });
      }
    }, BROADCAST_THROTTLE_MS);
  }, [layers, components]);

  useEffect(() => {
    const handleMessage = (message: MultiplayerMessage) => {
      if (message.type === "doc") {
        isApplyingRemoteRef.current = true;
        reconcileRemoteLayers(dispatch, latestDocRef.current.layers, message.layers);
        dispatch({
          type: "controls.setValue",
          target: TARGETS.components,
          value: message.components,
          history: "skip",
        });
      } else if (message.type === "join") {
        const doc = latestDocRef.current;
        multiplayerSocket.send({ type: "doc", layers: doc.layers, components: doc.components });
      }
    };

    return multiplayerSocket.subscribe(handleMessage);
  }, [dispatch]);
}
