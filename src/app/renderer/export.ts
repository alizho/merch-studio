/**
 * PNG export.
 *
 * The runtime owns the export action, the encoder, and the download. This only
 * draws product pixels into the context it is handed, using the same
 * `drawDesign` pass as the live preview so the file matches the screen.
 */

import type { ToolcraftProductExportRenderer } from "@/toolcraft/runtime";

import { drawDesign, type SceneResources } from "./compose";
import { getLoadedImage, getMediaImages, loadImage } from "./image-cache";
import { loadProductFaces } from "../design/fonts";
import { readScene, sceneGarmentSources } from "../state/scene";

export const designExportRenderer: ToolcraftProductExportRenderer = {
  baseFileName: "merch-studio-design",
  async renderFrame({ context, frame, state }) {
    const scene = readScene(state);
    const garments = new Map<string, CanvasImageSource>();

    // Export can run before a view has ever been previewed, so the art and the
    // faces are resolved here rather than assumed to be warm.
    await loadProductFaces();

    for (const source of sceneGarmentSources(scene)) {
      await loadImage(source);

      const image = getLoadedImage(source);

      if (image) {
        garments.set(source, image);
      }
    }

    const resources: SceneResources = {
      garments,
      media: getMediaImages(),
    };

    // The context is in scene/world coordinates and the garment frame is
    // centered on the origin, so the origin moves to the frame before drawing.
    context.save();
    context.translate(frame.x, frame.y);
    drawDesign(context, scene, resources);
    context.restore();
  },
};
