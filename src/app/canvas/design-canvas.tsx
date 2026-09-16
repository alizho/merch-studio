"use client";

/**
 * Product output for the canvas.
 *
 * Draws the garment and its components through the same `drawDesign` pass the
 * PNG export uses, and mounts the product handles over it. No app chrome lives
 * here: panels, toolbar, and upload affordances stay runtime-owned.
 */

import * as React from "react";
import {
  useToolcraftDispatch,
  useToolcraftMediaPresentationUrls,
  useToolcraftProductSceneFrame,
  useToolcraftSelector,
} from "@/toolcraft/runtime/react";
import type { ToolcraftMediaAsset } from "@/toolcraft/runtime";

import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../design/tokens";
import {
  clearTreatedCache,
  drawDesign,
  measureComponent,
  type SceneResources,
} from "../renderer/compose";
import { Handles } from "./handles";
import { loadProductFaces } from "../design/fonts";
import { readScene, sceneGarmentSources } from "../state/scene";
import { TARGETS, withComponent, type ComponentRecord } from "../state/components";
import { useImages, useMediaImages } from "../renderer/image-cache";
import { measureContext } from "../renderer/measure";
import { panelFromRecord, panelWrites } from "../state/selection-values";
import { useSelectionSync } from "../state/use-selection-sync";
import {
  shouldDeselectOnKeyDown,
  shouldDeselectOnPointerDown,
  visibleSelectedLayerId,
} from "./selection";
import styles from "./design-canvas.module.css";

function useProductFaces(): boolean {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let active = true;

    void loadProductFaces().then(() => {
      if (!active) {
        return;
      }

      // Text cached against a fallback face would measure wrong from here on.
      clearTreatedCache();
      setReady(true);
    });

    return () => {
      active = false;
    };
  }, []);

  return ready;
}

export function DesignCanvas(): React.JSX.Element | null {
  const frame = useToolcraftProductSceneFrame();
  const dispatch = useToolcraftDispatch();
  const layers = useToolcraftSelector((state) => state.layers);
  const values = useToolcraftSelector((state) => state.values);
  const selectedLayerId = useToolcraftSelector(
    (state) => state.selectedLayerId,
  );
  const canvasZoom = useToolcraftSelector((state) => state.canvas.zoom);
  const mediaAssets = useToolcraftSelector((state) => state.mediaAssets);
  const facesReady = useProductFaces();

  useSelectionSync({
    dispatch,
    layers,
    mediaAssets,
    selectedLayerId,
    values,
  });

  const scene = React.useMemo(
    () => readScene({ layers, values }),
    [layers, values],
  );
  const garmentImages = useImages(sceneGarmentSources(scene));

  const imageAssets = React.useMemo(
    () =>
      mediaAssets.filter(
        (asset: ToolcraftMediaAsset) => asset.assetKind === "image",
      ),
    [mediaAssets],
  );
  const presentationUrls = useToolcraftMediaPresentationUrls(imageAssets);
  const mediaSources = React.useMemo(() => {
    const sources = new Map<string, string>();

    for (const asset of imageAssets) {
      const url = presentationUrls.get(asset.id);

      if (url) {
        sources.set(asset.id, url);
      }
    }

    return sources;
  }, [imageAssets, presentationUrls]);
  const mediaImages = useMediaImages(mediaSources);

  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  const measure = React.useCallback(
    (record: ComponentRecord) => measureComponent(measureContext(), record),
    [],
  );

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    const resources: SceneResources = {
      garments: garmentImages,
      media: mediaImages,
    };

    context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawDesign(context, scene, resources);
  }, [facesReady, garmentImages, mediaImages, scene]);

  const handleComponentChange = React.useCallback(
    (layerId: string, record: ComponentRecord, gesture: string) => {
      dispatch({
        // One gesture merges into one history entry, keyed by its group.
        history: "merge",
        historyGroup: gesture,
        label: "Edit component",
        target: TARGETS.components,
        type: "controls.setValue",
        value: withComponent(scene.components, layerId, record),
      });
    },
    [dispatch, scene.components],
  );

  const handleSelect = React.useCallback(
    (layerId: string) => {
      const record = scene.components[layerId];

      dispatch({ layerId, type: "layers.select" });

      if (!record) {
        return;
      }

      // Re-selecting the same layer does not change selectedLayerId, so the
      // panel kind has to be written here or the handles would stay hidden.
      for (const [target, value] of panelWrites(panelFromRecord(record))) {
        dispatch({
          history: "skip",
          target,
          type: "controls.setValue",
          value,
        });
      }
    },
    [dispatch, scene.components],
  );

  const handleDeselect = React.useCallback(() => {
    if (values[TARGETS.selectedKind] === "") {
      return;
    }

    dispatch({
      history: "skip",
      target: TARGETS.selectedKind,
      type: "controls.setValue",
      value: "",
    });
  }, [dispatch, values]);

  const editingLayerId = visibleSelectedLayerId(
    selectedLayerId,
    values[TARGETS.selectedKind],
  );

  React.useEffect(() => {
    if (!editingLayerId) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (shouldDeselectOnPointerDown(event)) {
        handleDeselect();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!shouldDeselectOnKeyDown(event)) {
        return;
      }

      event.preventDefault();
      handleDeselect();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [editingLayerId, handleDeselect]);

  /**
   * Deleting removes the layer and leaves its record in place, so undoing the
   * delete brings the component back with it.
   */
  const handleDelete = React.useCallback(
    (layerId: string) => {
      dispatch({ layerId, type: "layers.delete" });
    },
    [dispatch],
  );

  if (frame.kind !== "ready") {
    return null;
  }

  return (
    <div
      className={styles.surface}
      data-merch-design-surface=""
      data-toolcraft-product-output=""
    >
      <canvas
        className={styles.canvas}
        data-merch-design-canvas=""
        height={CANVAS_HEIGHT}
        ref={canvasRef}
        width={CANVAS_WIDTH}
      />
      <Handles
        components={scene.components}
        layerIds={scene.layerIds}
        measure={measure}
        onChange={handleComponentChange}
        onDelete={handleDelete}
        onSelect={handleSelect}
        selectedLayerId={editingLayerId}
        zoom={canvasZoom}
      />
    </div>
  );
}
