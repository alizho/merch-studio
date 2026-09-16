"use client";

/**
 * Product editing handles.
 *
 * The frame and the square nodes are product geometry in an inert SVG layer;
 * every interactive target is a public Toolcraft Button laid over its node, so
 * focus and keyboard behavior stay in the kit. Handles never appear in export,
 * because export renders through the canvas pass rather than the DOM.
 *
 * Rotation is authored here: the runtime's canvas editing covers drag, resize,
 * and selection, and its rotation is either a 90-degree media step or a 3D
 * orbit gizmo, neither of which fits free rotation of flat artwork. The panel
 * owns the exact degree value; this owns the gesture.
 */

import * as React from "react";
import { Button } from "@/toolcraft/ui";

import { componentCorners, type Box, type Point } from "./geometry";
import {
  angleBetween,
  gestureGroup,
  resolveGestureRecord,
  type Gesture,
  type GestureDraft,
} from "./gesture";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../design/tokens";
import {
  componentLabel,
  type ComponentMap,
  type ComponentRecord,
} from "../state/components";
import { selectionChromeMetrics } from "./selection-chrome";
import styles from "./handles.module.css";

const SELECTION_STROKE = "#F7FE62";
const NODE_FILL = "#0A0A0A";
const DELETE_GLYPH = "#FFFFFF";

let gestureCounter = 0;

export type HandlesProps = {
  components: ComponentMap;
  layerIds: readonly string[];
  measure: (record: ComponentRecord) => Box;
  onChange: (layerId: string, record: ComponentRecord, gesture: string) => void;
  onDelete: (layerId: string) => void;
  onSelect: (layerId: string) => void;
  selectedLayerId: string | null;
  zoom: number;
};

export function Handles({
  components,
  layerIds,
  measure,
  onChange,
  onDelete,
  onSelect,
  selectedLayerId,
  zoom,
}: HandlesProps): React.JSX.Element {
  const overlayRef = React.useRef<HTMLDivElement | null>(null);
  const gestureRef = React.useRef<Gesture | null>(null);
  const selected = selectedLayerId ? components[selectedLayerId] : undefined;

  /** Canvas units per CSS pixel, so pan and zoom need no viewport state. */
  const toCanvasPoint = (clientX: number, clientY: number): Point => {
    const overlay = overlayRef.current;

    if (!overlay) {
      return { x: 0, y: 0 };
    }

    const rect = overlay.getBoundingClientRect();
    const scaleX = rect.width === 0 ? 1 : CANVAS_WIDTH / rect.width;
    const scaleY = rect.height === 0 ? 1 : CANVAS_HEIGHT / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  /**
   * Pointer capture keeps the gesture on its own button, so a drag continues
   * past the handle without the product registering global listeners.
   */
  const beginGesture = (
    event: React.PointerEvent<HTMLButtonElement>,
    draft: GestureDraft,
  ) => {
    if (event.button !== 0) {
      return;
    }

    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    gestureCounter += 1;
    gestureRef.current = { ...draft, token: gestureCounter };
  };

  const continueGesture = (event: React.PointerEvent<HTMLButtonElement>) => {
    const gesture = gestureRef.current;

    if (!gesture) {
      return;
    }

    onChange(
      gesture.layerId,
      resolveGestureRecord({
        box: measure(gesture.origin),
        gesture,
        point: toCanvasPoint(event.clientX, event.clientY),
        shiftKey: event.shiftKey,
      }),
      gestureGroup(gesture),
    );
  };

  const endGesture = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (gestureRef.current) {
      continueGesture(event);
      gestureRef.current = null;
    }
  };

  const selectionBox = selected ? measure(selected) : null;
  const corners =
    selected && selectionBox ? componentCorners(selected, selectionBox) : [];

  // Anchors are plain arithmetic in the component's rotated frame: the rotate
  // node sits above the top edge, and delete sits just outside the top-right
  // corner, clear of the resize node.
  const angle = ((selected?.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const centerX = selected?.centerX ?? 0;
  const centerY = selected?.centerY ?? 0;
  const halfWidth = (selectionBox?.width ?? 0) / 2;
  const halfHeight = (selectionBox?.height ?? 0) / 2;
  const chrome = selectionChromeMetrics(zoom);

  const rotateLocalY = -halfHeight - chrome.rotateOffset;
  const rotateX = centerX - rotateLocalY * sin;
  const rotateY = centerY + rotateLocalY * cos;

  const deleteLocalX = halfWidth + chrome.deleteOffset;
  const deleteLocalY = -halfHeight - chrome.deleteOffset;
  const deleteX = centerX + deleteLocalX * cos - deleteLocalY * sin;
  const deleteY = centerY + deleteLocalX * sin + deleteLocalY * cos;
  const topEdge =
    corners.length === 4
      ? {
          x: (corners[0].x + corners[1].x) / 2,
          y: (corners[0].y + corners[1].y) / 2,
        }
      : null;

  return (
    <div
      className={styles.overlay}
      data-merch-handles=""
      data-merch-selection={selectedLayerId ? "active" : "idle"}
      ref={overlayRef}
    >
      <svg
        aria-hidden="true"
        className={styles.frame}
        viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
      >
        {selected && topEdge ? (
          <g>
            <polygon
              data-merch-selection-frame=""
              fill="none"
              points={corners
                .map((corner) => `${corner.x},${corner.y}`)
                .join(" ")}
              stroke={SELECTION_STROKE}
              strokeDasharray={chrome.dash}
              strokeWidth={chrome.strokeWidth}
            />
            <line
              stroke={SELECTION_STROKE}
              strokeWidth={chrome.strokeWidth}
              x1={topEdge.x}
              x2={rotateX}
              y1={topEdge.y}
              y2={rotateY}
            />
            {corners.map((corner, index) => (
              <rect
                data-merch-selection-anchor=""
                fill={NODE_FILL}
                height={chrome.nodeSize}
                key={`resize-${index}`}
                stroke={SELECTION_STROKE}
                strokeWidth={chrome.strokeWidth}
                width={chrome.nodeSize}
                x={corner.x - chrome.nodeSize / 2}
                y={corner.y - chrome.nodeSize / 2}
              />
            ))}
            <rect
              data-merch-selection-anchor=""
              fill={NODE_FILL}
              height={chrome.nodeSize}
              stroke={SELECTION_STROKE}
              strokeWidth={chrome.strokeWidth}
              width={chrome.nodeSize}
              x={rotateX - chrome.nodeSize / 2}
              y={rotateY - chrome.nodeSize / 2}
            />
            <g>
              <rect
                data-merch-selection-anchor=""
                fill={NODE_FILL}
                height={chrome.nodeSize}
                stroke={SELECTION_STROKE}
                strokeWidth={chrome.strokeWidth}
                width={chrome.nodeSize}
                x={deleteX - chrome.nodeSize / 2}
                y={deleteY - chrome.nodeSize / 2}
              />
              <g
                stroke={DELETE_GLYPH}
                strokeLinecap="round"
                strokeWidth={chrome.strokeWidth}
              >
                <line
                  x1={deleteX - chrome.nodeSize / 5}
                  x2={deleteX + chrome.nodeSize / 5}
                  y1={deleteY - chrome.nodeSize / 5}
                  y2={deleteY + chrome.nodeSize / 5}
                />
                <line
                  x1={deleteX + chrome.nodeSize / 5}
                  x2={deleteX - chrome.nodeSize / 5}
                  y1={deleteY - chrome.nodeSize / 5}
                  y2={deleteY + chrome.nodeSize / 5}
                />
              </g>
            </g>
          </g>
        ) : null}
      </svg>

      {/* Back to front, so the frontmost component receives the pointer. */}
      {[...layerIds].reverse().map((layerId) => {
        const record = components[layerId];

        if (!record) {
          return null;
        }

        const box = measure(record);

        return (
          <div
            className={styles.body}
            data-merch-interactive=""
            key={layerId}
            style={{
              height: box.height,
              left: record.centerX - box.width / 2,
              top: record.centerY - box.height / 2,
              transform: `rotate(${record.rotation}deg)`,
              width: box.width,
            }}
          >
            <Button
              aria-label={`Select and move ${componentLabel(record)}`}
              className={styles.fill}
              onPointerDown={(event) => {
                onSelect(layerId);
                beginGesture(event, {
                  kind: "move",
                  layerId,
                  origin: record,
                  start: toCanvasPoint(event.clientX, event.clientY),
                });
              }}
              onPointerMove={continueGesture}
              onPointerUp={endGesture}
              variant="ghost"
            />
          </div>
        );
      })}

      {selected && selectedLayerId
        ? corners.map((corner, index) => (
            <div
              className={styles.handle}
              data-merch-interactive=""
              key={`resize-${index}`}
              style={{
                height: chrome.hitTargetSize,
                left: corner.x - chrome.hitTargetSize / 2,
                top: corner.y - chrome.hitTargetSize / 2,
                width: chrome.hitTargetSize,
              }}
            >
              <Button
                aria-label="Resize component"
                className={styles.fill}
                onPointerDown={(event) =>
                  beginGesture(event, {
                    kind: "resize",
                    layerId: selectedLayerId,
                    origin: selected,
                    start: toCanvasPoint(event.clientX, event.clientY),
                  })
                }
                onPointerMove={continueGesture}
                onPointerUp={endGesture}
                variant="ghost"
              />
            </div>
          ))
        : null}

      {selected && selectedLayerId ? (
        <div
          className={styles.handle}
          data-merch-interactive=""
          style={{
            height: chrome.hitTargetSize,
            left: rotateX - chrome.hitTargetSize / 2,
            top: rotateY - chrome.hitTargetSize / 2,
            width: chrome.hitTargetSize,
          }}
        >
          <Button
            aria-label="Rotate component"
            className={styles.fill}
            onPointerDown={(event) =>
              beginGesture(event, {
                kind: "rotate",
                layerId: selectedLayerId,
                origin: selected,
                startAngle: angleBetween(
                  { x: selected.centerX, y: selected.centerY },
                  toCanvasPoint(event.clientX, event.clientY),
                ),
              })
            }
            onPointerMove={continueGesture}
            onPointerUp={endGesture}
            variant="ghost"
          />
        </div>
      ) : null}

      {selected && selectedLayerId ? (
        <div
          className={styles.handle}
          data-merch-interactive=""
          style={{
            height: chrome.hitTargetSize,
            left: deleteX - chrome.hitTargetSize / 2,
            top: deleteY - chrome.hitTargetSize / 2,
            width: chrome.hitTargetSize,
          }}
        >
          <Button
            aria-label="Delete component"
            className={styles.fill}
            onClick={() => onDelete(selectedLayerId)}
            onPointerMove={continueGesture}
            onPointerUp={endGesture}
            variant="ghost"
          />
        </div>
      ) : null}
    </div>
  );
}
