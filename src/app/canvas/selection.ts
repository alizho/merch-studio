/**
 * Canvas selection chrome.
 *
 * Runtime `layers.select` cannot clear a layer, so the visible frame is owned
 * here: a component kind on `selectedLayer.kind` means the handles are up, and
 * an empty kind means the design is shown without them.
 */

import { isComponentKind } from "../state/components";

const CANVAS_ROOT = '[data-slot="toolcraft-runtime-canvas"]';
const INTERACTIVE = "[data-merch-interactive]";
const KEY_BLOCKERS =
  '[role="listbox"], [role="menu"], [role="option"], [role="combobox"], [role="dialog"]';

export function visibleSelectedLayerId(
  selectedLayerId: string | null,
  selectedKind: unknown,
): string | null {
  return selectedLayerId && isComponentKind(selectedKind)
    ? selectedLayerId
    : null;
}

function closestTarget(
  target: EventTarget | null,
): { closest: (selector: string) => unknown } | null {
  if (
    target &&
    typeof target === "object" &&
    "closest" in target &&
    typeof (target as { closest?: unknown }).closest === "function"
  ) {
    return target as { closest: (selector: string) => unknown };
  }

  return null;
}

export function shouldDeselectOnPointerDown(event: {
  button: number;
  target: EventTarget | null;
}): boolean {
  if (event.button !== 0) {
    return false;
  }

  const target = closestTarget(event.target);

  if (!target?.closest(CANVAS_ROOT)) {
    return false;
  }

  return target.closest(INTERACTIVE) === null;
}

export function shouldDeselectOnKeyDown(event: {
  altKey: boolean;
  ctrlKey: boolean;
  defaultPrevented: boolean;
  isComposing: boolean;
  key: string;
  metaKey: boolean;
  repeat: boolean;
  target: EventTarget | null;
}): boolean {
  if (
    event.key !== "Enter" ||
    event.repeat ||
    event.isComposing ||
    event.defaultPrevented ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey
  ) {
    return false;
  }

  const target = closestTarget(event.target);

  return target?.closest(KEY_BLOCKERS) == null;
}
