/**
 * Figma-style group selection helpers: click redirection to a group's
 * bounding box, one-level-at-a-time drill-in, and the bounds math shared by
 * group selection rings, group hit-plates, and group-aware dragging.
 *
 * Kept pure so the click/drag resolution rules can be asserted directly, the
 * same way `gesture.ts` and `snapping.ts` are.
 */

import type { ToolcraftLayer } from "@/toolcraft/runtime";

import { componentCorners, toLocalPoint, type Box, type Point } from "./geometry";
import { resolveMoveSnap, type SnapGuides } from "./snapping";
import type { ComponentMap, ComponentRecord } from "../state/components";

export type Bounds = { maxX: number; maxY: number; minX: number; minY: number };

/** Root-to-leaf chain of group ancestors; empty when the layer sits at the top level. */
export function groupAncestorChain(
  layers: readonly ToolcraftLayer[],
  leafId: string,
): string[] {
  const chain: string[] = [];
  const visited = new Set<string>([leafId]);
  let parentId = layers.find((layer) => layer.id === leafId)?.parentGroupId;

  while (parentId && !visited.has(parentId)) {
    chain.push(parentId);
    visited.add(parentId);
    parentId = layers.find((layer) => layer.id === parentId)?.parentGroupId;
  }

  return chain.reverse();
}

/**
 * The id a click on `leafId` should select, given how deep the current
 * selection is drilled into that leaf's group chain: the outermost
 * not-yet-entered group, or the leaf itself once every ancestor has been
 * entered. Clicking a different branch naturally truncates `drillPath` to
 * the common ancestor, which is how popping out of a drill happens for free.
 */
export function resolveClickTarget(
  layers: readonly ToolcraftLayer[],
  leafId: string,
  drillPath: readonly string[],
): { targetId: string; nextDrillPath: string[] } {
  const chain = groupAncestorChain(layers, leafId);
  let depth = 0;

  while (depth < drillPath.length && depth < chain.length && chain[depth] === drillPath[depth]) {
    depth += 1;
  }

  return {
    nextDrillPath: drillPath.slice(0, depth),
    targetId: depth < chain.length ? chain[depth] : leafId,
  };
}

/** Leaf component ids under `groupId`, in no particular order. */
export function groupLeafIds(
  layers: readonly ToolcraftLayer[],
  components: ComponentMap,
  groupId: string,
): string[] {
  return layers
    .filter((layer) => components[layer.id] && groupAncestorChain(layers, layer.id).includes(groupId))
    .map((layer) => layer.id);
}

/** Expands a selection (a mix of group and leaf ids) to its leaf members, deduped. */
export function expandSelectionToMembers(
  layers: readonly ToolcraftLayer[],
  components: ComponentMap,
  selectedIds: readonly string[],
): { layerId: string; origin: ComponentRecord }[] {
  const seen = new Set<string>();
  const result: { layerId: string; origin: ComponentRecord }[] = [];

  for (const id of selectedIds) {
    const members = groupLeafIds(layers, components, id);
    const leafIds = members.length > 0 ? members : components[id] ? [id] : [];

    for (const leafId of leafIds) {
      if (seen.has(leafId)) continue;
      seen.add(leafId);
      result.push({ layerId: leafId, origin: components[leafId] });
    }
  }

  return result;
}

export function unionBounds(entries: readonly { box: Box; record: ComponentRecord }[]): Bounds | null {
  if (!entries.length) return null;

  const corners = entries.flatMap(({ box, record }) => componentCorners(record, box));
  const xs = corners.map((corner) => corner.x);
  const ys = corners.map((corner) => corner.y);

  return {
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
    minX: Math.min(...xs),
    minY: Math.min(...ys),
  };
}

/** Axis-aligned rectangle for `bounds`, in the same corner order/shape as `componentCorners`. */
export function boundsCorners(bounds: Bounds): Point[] {
  return [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY },
  ];
}

export function pointInComponent(record: ComponentRecord, box: Box, point: Point): boolean {
  const local = toLocalPoint(record, point);

  return Math.abs(local.x) <= box.width / 2 && Math.abs(local.y) <= box.height / 2;
}

/**
 * Adapts `resolveMoveSnap` (built for a single dragged record) to a group
 * move: the union bounds stand in for the dragged box, every member is
 * excluded from the candidate targets by filtering them out of `layerIds`
 * up front, and the resulting center offset is folded back into the raw
 * drag delta.
 */
export function resolveGroupMoveSnap({
  bounds,
  components,
  delta,
  layerIds,
  measure,
  memberIds,
  template,
  zoom,
}: {
  bounds: Bounds;
  components: ComponentMap;
  delta: Point;
  layerIds: readonly string[];
  measure: (record: ComponentRecord) => Box;
  memberIds: readonly string[];
  template: ComponentRecord;
  zoom: number;
}): { delta: Point; guides: SnapGuides } {
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const proposedCenterX = (bounds.minX + bounds.maxX) / 2 + delta.x;
  const proposedCenterY = (bounds.minY + bounds.maxY) / 2 + delta.y;
  const memberSet = new Set(memberIds);

  const snapped = resolveMoveSnap({
    box: { height, width },
    components,
    excludeLayerId: "",
    layerIds: layerIds.filter((id) => !memberSet.has(id)),
    measure,
    record: { ...template, centerX: proposedCenterX, centerY: proposedCenterY, height, rotation: 0, width },
    zoom,
  });

  return {
    delta: {
      x: delta.x + (snapped.record.centerX - proposedCenterX),
      y: delta.y + (snapped.record.centerY - proposedCenterY),
    },
    guides: snapped.guides,
  };
}
