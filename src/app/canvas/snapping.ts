/**
 * Figma-style snap-to-align for the move gesture.
 *
 * Snap targets are the canvas center lines plus every other visible
 * component's axis-aligned bounding box (left/center/right and
 * top/middle/bottom), computed independently per axis so a drag can snap
 * horizontally and vertically to two different elements at once. Kept pure
 * and separate from `gesture.ts` — this composes on top of its move output
 * rather than changing how a move resolves.
 */

import { componentCorners, type Box } from "./geometry";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../design/tokens";
import { zoomScaleOf } from "./selection-chrome";
import type { ComponentMap, ComponentRecord } from "../state/components";

/** Snap distance, in on-screen pixels regardless of zoom. */
const SNAP_THRESHOLD_SCREEN_PX = 5;

export type SnapLine = {
  /** The coordinate every snapped edge/center now sits on. */
  position: number;
  /** Perpendicular extent to draw the guide across, in canvas units. */
  start: number;
  end: number;
};

export type SnapGuides = {
  horizontal: SnapLine | null;
  vertical: SnapLine | null;
};

export const NO_SNAP_GUIDES: SnapGuides = { horizontal: null, vertical: null };

type Bounds = { maxX: number; maxY: number; minX: number; minY: number };
type Edge = { extentEnd: number; extentStart: number; value: number };

function boundsOf(
  record: Pick<ComponentRecord, "centerX" | "centerY" | "rotation">,
  box: Box,
): Bounds {
  const corners = componentCorners(record, box);
  const xs = corners.map((corner) => corner.x);
  const ys = corners.map((corner) => corner.y);

  return {
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
    minX: Math.min(...xs),
    minY: Math.min(...ys),
  };
}

/** Left/center/right edges for `axis: "x"`, top/middle/bottom for `"y"`. */
function bboxEdges(bounds: Bounds, axis: "x" | "y"): Edge[] {
  const [min, max, extentStart, extentEnd] =
    axis === "x"
      ? [bounds.minX, bounds.maxX, bounds.minY, bounds.maxY]
      : [bounds.minY, bounds.maxY, bounds.minX, bounds.maxX];

  return [
    { extentEnd, extentStart, value: min },
    { extentEnd, extentStart, value: (min + max) / 2 },
    { extentEnd, extentStart, value: max },
  ];
}

function bestSnap(
  draggedEdges: Edge[],
  targetEdges: Edge[],
  threshold: number,
): { line: SnapLine; offset: number } | null {
  let best: { delta: number; line: SnapLine; offset: number } | null = null;

  for (const dragged of draggedEdges) {
    for (const target of targetEdges) {
      const offset = target.value - dragged.value;
      const delta = Math.abs(offset);

      if (delta > threshold || (best && delta >= best.delta)) continue;

      best = {
        delta,
        line: {
          end: Math.max(dragged.extentEnd, target.extentEnd),
          position: target.value,
          start: Math.min(dragged.extentStart, target.extentStart),
        },
        offset,
      };
    }
  }

  return best ? { line: best.line, offset: best.offset } : null;
}

/**
 * Snaps a proposed move to the canvas center and to other visible
 * components' bounding-box edges/centers, within a fixed on-screen
 * threshold. Returns the (possibly adjusted) record alongside the guide
 * lines to render; horizontal and vertical snapping are resolved
 * independently, so a drag can align on one axis without the other.
 */
export function resolveMoveSnap({
  box,
  components,
  excludeLayerId,
  layerIds,
  measure,
  record,
  zoom,
}: {
  box: Box;
  components: ComponentMap;
  excludeLayerId: string;
  layerIds: readonly string[];
  measure: (record: ComponentRecord) => Box;
  record: ComponentRecord;
  zoom: number;
}): { guides: SnapGuides; record: ComponentRecord } {
  const threshold = SNAP_THRESHOLD_SCREEN_PX / zoomScaleOf(zoom);
  const draggedBounds = boundsOf(record, box);

  const otherBounds: Bounds[] = [];

  for (const layerId of layerIds) {
    if (layerId === excludeLayerId) continue;

    const other = components[layerId];

    if (!other) continue;

    otherBounds.push(boundsOf(other, measure(other)));
  }

  const verticalTargets: Edge[] = [
    { extentEnd: CANVAS_HEIGHT, extentStart: 0, value: CANVAS_WIDTH / 2 },
    ...otherBounds.flatMap((bounds) => bboxEdges(bounds, "x")),
  ];
  const horizontalTargets: Edge[] = [
    { extentEnd: CANVAS_WIDTH, extentStart: 0, value: CANVAS_HEIGHT / 2 },
    ...otherBounds.flatMap((bounds) => bboxEdges(bounds, "y")),
  ];

  const verticalSnap = bestSnap(bboxEdges(draggedBounds, "x"), verticalTargets, threshold);
  const horizontalSnap = bestSnap(bboxEdges(draggedBounds, "y"), horizontalTargets, threshold);

  return {
    guides: {
      horizontal: horizontalSnap?.line ?? null,
      vertical: verticalSnap?.line ?? null,
    },
    record: {
      ...record,
      centerX: record.centerX + (verticalSnap?.offset ?? 0),
      centerY: record.centerY + (horizontalSnap?.offset ?? 0),
    },
  };
}
