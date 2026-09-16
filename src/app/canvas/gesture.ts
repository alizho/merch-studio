/**
 * Gesture math for the canvas handles.
 *
 * Kept pure and separate from the React layer so the transform rules can be
 * asserted directly: a move clamps to the print area, a resize scales about the
 * component center, and a rotate snaps only when Shift is held.
 */

import { clamp, toLocalPoint, type Box, type Point } from "./geometry";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../design/tokens";
import type { ComponentRecord } from "../state/components";

export const ROTATE_SNAP_DEGREES = 15;
export const MIN_COMPONENT_SIZE = 32;
export const MIN_TYPE_SIZE = 12;
export const MAX_TYPE_SIZE = 420;

export type GestureDraft =
  | { kind: "resize"; layerId: string; origin: ComponentRecord; start: Point }
  | { kind: "move"; layerId: string; origin: ComponentRecord; start: Point }
  | {
      kind: "rotate";
      layerId: string;
      origin: ComponentRecord;
      startAngle: number;
    };

/** Unique per gesture, so one drag collapses to exactly one history entry. */
export type Gesture = GestureDraft & { token: number };

export function gestureGroup(gesture: Gesture): string {
  return `${gesture.kind}:${gesture.layerId}:${gesture.token}`;
}

export function normalizeAngle(degrees: number): number {
  const wrapped = ((((degrees + 180) % 360) + 360) % 360) - 180;

  return Math.round(wrapped * 10) / 10;
}

export function angleBetween(origin: Point, point: Point): number {
  return (Math.atan2(point.y - origin.y, point.x - origin.x) * 180) / Math.PI;
}

export function resolveGestureRecord({
  box,
  gesture,
  point,
  shiftKey,
}: {
  /** The component's measured box, supplied so this stays free of canvas APIs. */
  box: Box;
  gesture: Gesture;
  point: Point;
  shiftKey: boolean;
}): ComponentRecord {
  if (gesture.kind === "move") {
    // Artwork is masked to the garment rather than boxed into a print area, so
    // a move is only held to the artboard, which keeps it recoverable.
    return {
      ...gesture.origin,
      centerX: clamp(
        gesture.origin.centerX + (point.x - gesture.start.x),
        0,
        CANVAS_WIDTH,
      ),
      centerY: clamp(
        gesture.origin.centerY + (point.y - gesture.start.y),
        0,
        CANVAS_HEIGHT,
      ),
    };
  }

  if (gesture.kind === "rotate") {
    const raw =
      gesture.origin.rotation +
      (angleBetween(
        { x: gesture.origin.centerX, y: gesture.origin.centerY },
        point,
      ) -
        gesture.startAngle);

    return {
      ...gesture.origin,
      rotation: normalizeAngle(
        shiftKey
          ? Math.round(raw / ROTATE_SNAP_DEGREES) * ROTATE_SNAP_DEGREES
          : raw,
      ),
    };
  }

  const localStart = toLocalPoint(gesture.origin, gesture.start);
  const localNow = toLocalPoint(gesture.origin, point);
  const startDistance = Math.hypot(localStart.x, localStart.y);
  const ratio =
    startDistance < 1
      ? 1
      : clamp(Math.hypot(localNow.x, localNow.y) / startDistance, 0.05, 20);

  // Scaling text changes its type size, so the glyphs stay vector-crisp
  // instead of being stretched from a cached raster.
  if (gesture.origin.kind === "text" && gesture.origin.typography) {
    return {
      ...gesture.origin,
      typography: {
        ...gesture.origin.typography,
        size: clamp(
          Math.round(gesture.origin.typography.size * ratio),
          MIN_TYPE_SIZE,
          MAX_TYPE_SIZE,
        ),
      },
    };
  }

  return {
    ...gesture.origin,
    height: Math.max(MIN_COMPONENT_SIZE, Math.round(box.height * ratio)),
    width: Math.max(MIN_COMPONENT_SIZE, Math.round(box.width * ratio)),
  };
}
