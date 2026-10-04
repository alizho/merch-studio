import { rotatePoint, type Box } from "../canvas/geometry";
import { unionBounds } from "../canvas/group-selection";
import type { ComponentPart, ComponentRecord } from "./components";

/** Bakes a compound's outer transform into its still-editable source records. */
export function separateParts(record: ComponentRecord): ComponentPart[] {
  const scale = record.width / (record.sourceWidth ?? record.width);
  return (record.parts ?? []).map(part => {
    const offset = rotatePoint({ x: part.record.centerX * scale, y: part.record.centerY * scale }, record.rotation);
    const child = part.record;
    return { ...part, record: {
      ...child, view: record.view,
      centerX: record.centerX + offset.x, centerY: record.centerY + offset.y,
      rotation: child.rotation + record.rotation,
      width: child.width * scale, height: child.height * scale,
      ...(child.typography ? { typography: { ...child.typography, size: child.typography.size * scale } } : {}),
    } };
  });
}

export function mergeParts(parts: ComponentPart[], measure: (record: ComponentRecord) => Box): ComponentRecord {
  // Flatten compound nesting as editable records, keeping depth and costs bounded.
  const leaves = parts.flatMap(part => part.record.kind === "compound"
    ? separateParts(part.record).map(child => ({ ...child, visible: child.visible && part.visible }))
    : [part]);
  const bounds = unionBounds(leaves.map(part => ({ record: part.record, box: measure(part.record) })))!;
  const centerX = (bounds.minX + bounds.maxX) / 2, centerY = (bounds.minY + bounds.maxY) / 2;
  const width = Math.max(1, bounds.maxX - bounds.minX), height = Math.max(1, bounds.maxY - bounds.minY);
  return {
    ...leaves[0].record, kind: "compound", centerX, centerY, width, height, rotation: 0,
    mediaId: undefined, resourceRef: undefined, rasterDataUrl: undefined, typography: undefined, text: undefined,
    sourceWidth: width, sourceHeight: height,
    parts: leaves.map(part => ({ ...part, record: { ...part.record,
      centerX: part.record.centerX - centerX, centerY: part.record.centerY - centerY,
    } })),
  };
}

export function remapComponentMedia(record: ComponentRecord, ids: ReadonlyMap<string, string>): ComponentRecord {
  return { ...record,
    ...(record.mediaId ? { mediaId: ids.get(record.mediaId) ?? record.mediaId } : {}),
    ...(record.parts ? { parts: record.parts.map(part => ({ ...part, record: remapComponentMedia(part.record, ids) })) } : {}),
  };
}
