import { describe, expect, it } from "vitest";

import { isComponentKind } from "../state/components";
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
