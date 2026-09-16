/**
 * Canvas-space geometry for the selection frame and the product handles.
 *
 * Hit testing is not here: each component carries its own button, so the
 * browser resolves which one the pointer is over.
 */

import type { ComponentRecord } from "../state/components";

export type Point = {
  x: number;
  y: number;
};

export type Box = {
  height: number;
  width: number;
};

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function rotatePoint(point: Point, degrees: number): Point {
  const angle = toRadians(degrees);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

/** Corner order: top-left, top-right, bottom-right, bottom-left. */
export function componentCorners(
  record: ComponentRecord,
  box: Box,
): readonly Point[] {
  const halfWidth = box.width / 2;
  const halfHeight = box.height / 2;

  return [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight },
  ].map((corner) => {
    const rotated = rotatePoint(corner, record.rotation);

    return { x: rotated.x + record.centerX, y: rotated.y + record.centerY };
  });
}

/** Converts a canvas point into the component's unrotated local space. */
export function toLocalPoint(record: ComponentRecord, point: Point): Point {
  return rotatePoint(
    { x: point.x - record.centerX, y: point.y - record.centerY },
    -record.rotation,
  );
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

