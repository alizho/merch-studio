import { describe, expect, it } from "vitest";

import { componentCorners, TOP_RIGHT_CORNER_INDEX } from "./geometry";
import { isComponentKind } from "../state/components";
import { selectionChromeMetrics } from "./selection-chrome";
import {
  shouldDeselectOnKeyDown,
  shouldDeselectOnPointerDown,
  visibleSelectedLayerId,
} from "./selection";

class Node {
  constructor(
    private readonly attrs: Record<string, string> = {},
    private readonly parent: Node | null = null,
  ) {}

  closest(selector: string): Node | null {
    if (selector.split(",").some((part) => this.matches(part.trim()))) {
      return this;
    }

    return this.parent?.closest(selector) ?? null;
  }

  private matches(selector: string): boolean {
    const valued = /^\[([^=\]]+)="([^"]*)"\]$/.exec(selector);

    if (valued) {
      return this.attrs[valued[1]] === valued[2];
    }

    const bare = /^\[([^=\]]+)\]$/.exec(selector);

    return Boolean(bare && Object.hasOwn(this.attrs, bare[1]));
  }
}

function keyEvent(
  overrides: Partial<Parameters<typeof shouldDeselectOnKeyDown>[0]> = {},
): Parameters<typeof shouldDeselectOnKeyDown>[0] {
  return {
    altKey: false,
    ctrlKey: false,
    defaultPrevented: false,
    isComposing: false,
    key: "Enter",
    metaKey: false,
    repeat: false,
    target: new Node() as unknown as EventTarget,
    ...overrides,
  };
}

describe("canvas selection chrome", () => {
  it("keeps smaller selection chrome at a constant screen size across zoom", () => {
    const zoomLevels = [50, 100, 200];

    for (const zoom of zoomLevels) {
      const scale = zoom / 100;
      const metrics = selectionChromeMetrics(zoom);

      expect(metrics.nodeSize * scale).toBe(12);
      expect(metrics.hitTargetSize * scale).toBe(24);
      expect(metrics.strokeWidth * scale).toBe(1.5);
      expect(
        metrics.dash.split(" ").map((value) => Number(value) * scale),
      ).toEqual([8, 6]);
    }
  });

  it("places delete on the top-right corner instead of a fourth resize knob", () => {
    const corners = componentCorners(
      { centerX: 100, centerY: 80, rotation: 0 },
      { height: 20, width: 40 },
    );

    expect(corners[TOP_RIGHT_CORNER_INDEX]).toEqual({ x: 120, y: 70 });
    expect(
      corners.filter((_, index) => index !== TOP_RIGHT_CORNER_INDEX),
    ).toHaveLength(3);
  });

  it("clears canvas selection chrome with Enter or an empty-canvas click", () => {
    const canvas = new Node({ "data-slot": "toolcraft-runtime-canvas" });
    const empty = new Node({}, canvas);
    const handle = new Node({ "data-merch-interactive": "" }, canvas);
    const listbox = new Node({ role: "listbox" });

    expect(visibleSelectedLayerId("layer-1", "mark")).toBe("layer-1");
    expect(visibleSelectedLayerId("layer-1", "")).toBeNull();
    expect(isComponentKind("")).toBe(false);

    expect(
      shouldDeselectOnPointerDown({
        button: 0,
        target: empty as unknown as EventTarget,
      }),
    ).toBe(true);
    expect(
      shouldDeselectOnPointerDown({
        button: 0,
        target: handle as unknown as EventTarget,
      }),
    ).toBe(false);
    expect(
      shouldDeselectOnPointerDown({
        button: 0,
        target: new Node() as unknown as EventTarget,
      }),
    ).toBe(false);

    expect(shouldDeselectOnKeyDown(keyEvent())).toBe(true);
    expect(shouldDeselectOnKeyDown(keyEvent({ key: "Escape" }))).toBe(false);
    expect(shouldDeselectOnKeyDown(keyEvent({ repeat: true }))).toBe(false);
    expect(
      shouldDeselectOnKeyDown(
        keyEvent({ target: listbox as unknown as EventTarget }),
      ),
    ).toBe(false);
  });
});
