"use client";

import * as React from "react";

/** Vector workspace decoration, anchored to the viewport's centered world origin. */
export function CanvasTicksGridPattern({
  offset,
  scale,
}: {
  offset: Readonly<{ x: number; y: number }>;
  scale: number;
}): React.JSX.Element {
  const id = React.useId();
  const zoom = Number.isFinite(scale) && scale > 0 ? scale : 1;
  // At 100% zoom, grid lines are spaced 24px apart, with a small cross at
  // every intersection.
  const gap = 24 * zoom;
  const crossArm = 3 * zoom;
  const phase = 1 + gap / 2;
  const x = (Number.isFinite(offset.x) ? offset.x % gap : 0) - phase;
  const y = (Number.isFinite(offset.y) ? offset.y % gap : 0) - phase;

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full"
      data-slot="canvas-ticks-grid-pattern"
      focusable="false"
    >
      <defs>
        <pattern
          height={gap}
          id={id}
          patternTransform={`translate(${x}, ${y})`}
          patternUnits="userSpaceOnUse"
          width={gap}
          x="50%"
          y="50%"
        >
          <line stroke="var(--foreground)" strokeOpacity={0.1} x1={0} x2={gap} y1={0} y2={0} />
          <line stroke="var(--foreground)" strokeOpacity={0.1} x1={0} x2={0} y1={0} y2={gap} />
          <g stroke="var(--foreground)" strokeOpacity={0.4}>
            <line x1={-crossArm} x2={crossArm} y1={0} y2={0} />
            <line x1={0} x2={0} y1={-crossArm} y2={crossArm} />
          </g>
        </pattern>
      </defs>
      <rect fill={`url(#${id})`} height="100%" width="100%" />
    </svg>
  );
}
