import { composeToolcraftApp } from "@/toolcraft/runtime/react";

import { appSchema } from "./app-schema";
import {
  garmentColorwayControlType,
  inkColorwayControlType,
} from "./controls/colorway-control-types";
import {
  GarmentColorwayControl,
  InkColorwayControl,
} from "./controls/colorway-control";
import { libraryStampControlType } from "./controls/library-stamp-control-types";
import { LibraryStampControl } from "./controls/library-stamp-control";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./design/tokens";
import { DesignCanvas } from "./canvas/design-canvas";
import { designExportRenderer } from "./renderer/export";
import { onPanelAction } from "./actions/panel-actions";

/**
 * The product scene is the garment artboard itself, at the size the art is
 * authored. Live preview and export both resolve through this rect, so they
 * cannot disagree about geometry.
 *
 * World space centers on the origin, matching the runtime's finite artboard,
 * so the garment sits under the artboard rather than beside it.
 */
const GARMENT_SCENE = Object.freeze([
  Object.freeze({
    height: CANVAS_HEIGHT,
    width: CANVAS_WIDTH,
    x: -CANVAS_WIDTH / 2,
    y: -CANVAS_HEIGHT / 2,
  }),
]);

export const appComposition = composeToolcraftApp(appSchema, {
  actions: { onPanelAction },
  controls: {
    renderers: {
      [garmentColorwayControlType]: GarmentColorwayControl,
      [inkColorwayControlType]: InkColorwayControl,
      [libraryStampControlType]: LibraryStampControl,
    },
  },
  scene: {
    canvasContent: <DesignCanvas />,
    rasterFrameRenderer: designExportRenderer,
    // Imported artwork is drawn by the product renderer inside the print area
    // and carries the print or stitch treatment, so the generic media preview
    // would double it.
    renderDefaultCanvasMedia: false,
    sceneBoundsProvider: () => GARMENT_SCENE,
  },
});
