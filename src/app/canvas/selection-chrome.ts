const NODE_SCREEN_SIZE = 12;
const HIT_TARGET_SCREEN_SIZE = 24;
const ROTATE_SCREEN_OFFSET = 32;
const SELECTION_SCREEN_DASH = [8, 6] as const;
const SELECTION_SCREEN_STROKE = 1.5;

/** Converts constant screen-space selection chrome into canvas units. */
export function selectionChromeMetrics(zoomPercent: number) {
  const zoomScale = Math.max(zoomPercent, 1) / 100;
  const toCanvasUnits = (screenPixels: number) => screenPixels / zoomScale;

  return {
    dash: SELECTION_SCREEN_DASH.map(toCanvasUnits).join(" "),
    hitTargetSize: toCanvasUnits(HIT_TARGET_SCREEN_SIZE),
    nodeSize: toCanvasUnits(NODE_SCREEN_SIZE),
    rotateOffset: toCanvasUnits(ROTATE_SCREEN_OFFSET),
    strokeWidth: toCanvasUnits(SELECTION_SCREEN_STROKE),
  };
}
