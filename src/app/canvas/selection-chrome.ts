const NODE_SCREEN_SIZE = 12;
const HIT_TARGET_SCREEN_SIZE = 24;
const ROTATE_SCREEN_OFFSET = 32;
const SELECTION_SCREEN_DASH = [8, 6] as const;
const SELECTION_SCREEN_STROKE = 1.5;
const SNAP_GUIDE_SCREEN_DASH = [4, 4] as const;
const SNAP_GUIDE_SCREEN_STROKE = 1;

export function zoomScaleOf(zoomPercent: number): number {
  return Math.max(zoomPercent, 1) / 100;
}

/** Converts constant screen-space selection chrome into canvas units. */
export function selectionChromeMetrics(zoomPercent: number) {
  const zoomScale = zoomScaleOf(zoomPercent);
  const toCanvasUnits = (screenPixels: number) => screenPixels / zoomScale;

  return {
    dash: SELECTION_SCREEN_DASH.map(toCanvasUnits).join(" "),
    dashPeriod: toCanvasUnits(
      SELECTION_SCREEN_DASH[0] + SELECTION_SCREEN_DASH[1],
    ),
    hitTargetSize: toCanvasUnits(HIT_TARGET_SCREEN_SIZE),
    nodeSize: toCanvasUnits(NODE_SCREEN_SIZE),
    rotateOffset: toCanvasUnits(ROTATE_SCREEN_OFFSET),
    strokeWidth: toCanvasUnits(SELECTION_SCREEN_STROKE),
  };
}

/** Converts constant screen-space snap-guide chrome into canvas units. */
export function snapGuideMetrics(zoomPercent: number) {
  const zoomScale = zoomScaleOf(zoomPercent);
  const toCanvasUnits = (screenPixels: number) => screenPixels / zoomScale;

  return {
    dash: SNAP_GUIDE_SCREEN_DASH.map(toCanvasUnits).join(" "),
    strokeWidth: toCanvasUnits(SNAP_GUIDE_SCREEN_STROKE),
  };
}
