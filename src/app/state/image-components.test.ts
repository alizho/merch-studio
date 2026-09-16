import { describe, expect, it } from "vitest";
import type { ToolcraftImageAsset } from "@/toolcraft/runtime";

import type { ComponentMap } from "./components";
import {
  getAspectCorrectedSize,
  getImportedImagePlacement,
  orientSize,
  raisePlacedLayers,
  reconcileImageComponents,
  type DecodedImageSize,
} from "./image-components";

const printArea = { height: 400, width: 300, x: 100, y: 200 } as const;

function imageAsset(
  overrides: Partial<ToolcraftImageAsset> & { id: string; layerId: string },
): ToolcraftImageAsset {
  return {
    assetKind: "image",
    fileName: "art.png",
    lifecycle: "ready",
    mimeType: "image/png",
    position: { x: 0, y: 0 },
    resourceRef: `media:image:sha256:${overrides.id}`,
    size: { height: 100, unit: "px", width: 100 },
    sourceSize: { height: 500, unit: "px", width: 1000 },
    ...overrides,
  } as ToolcraftImageAsset;
}

function reconcile(
  components: ComponentMap,
  assets: readonly ToolcraftImageAsset[],
  decoded: ReadonlyMap<string, DecodedImageSize> = new Map(),
) {
  return (
    reconcileImageComponents({
      components,
      decoded,
      layerIds: new Set(assets.map((asset) => asset.layerId)),
      mediaAssets: assets,
      placement: printArea,
      restoredLayerIds: new Set(assets.map((asset) => asset.layerId)),
      treatment: "print",
    })?.components ?? null
  );
}

describe("getImportedImagePlacement", () => {
  it("preserves a landscape aspect ratio while fitting the print area", () => {
    expect(
      getImportedImagePlacement({ height: 500, width: 1000 }, printArea),
    ).toEqual({ centerX: 250, centerY: 400, height: 105, width: 210 });
  });

  it("contains a portrait image by both print-area dimensions", () => {
    const frame = getImportedImagePlacement(
      { height: 1200, width: 400 },
      printArea,
    );

    expect(frame.height).toBe(280);
    expect(frame.width).toBe(93);
  });
});

describe("orientSize", () => {
  it("swaps dimensions only for quarter turns", () => {
    const size = { height: 500, width: 1000 };

    expect(orientSize(size, { rotationDeg: 90 })).toEqual({ height: 1000, width: 500 });
    expect(orientSize(size, { rotationDeg: 180 })).toEqual(size);
    expect(orientSize(size, { flipHorizontal: true })).toEqual(size);
  });
});

describe("getAspectCorrectedSize", () => {
  it("corrects a square fallback box to the decoded ratio", () => {
    const corrected = getAspectCorrectedSize(
      { height: 200, width: 200 },
      { height: 1000, width: 2000 },
    );

    expect(corrected!.width / corrected!.height).toBeCloseTo(2, 1);
  });

  it("corrects a swapped orientation", () => {
    const corrected = getAspectCorrectedSize(
      { height: 100, width: 300 },
      { height: 3000, width: 1000 },
    );

    expect(corrected!.height / corrected!.width).toBeCloseTo(3, 1);
  });

  it("is idempotent, including for small odd ratios", () => {
    for (const decoded of [
      { height: 10, width: 23 },
      { height: 1000, width: 2000 },
      { height: 7, width: 200 },
    ]) {
      const corrected = getAspectCorrectedSize({ height: 50, width: 50 }, decoded);

      expect(getAspectCorrectedSize(corrected!, decoded)).toBeNull();
    }
  });

  it("tolerates rounding from a uniform resize of a narrow image", () => {
    // 3:1 image scaled uniformly with per-axis rounding.
    expect(
      getAspectCorrectedSize({ height: 33, width: 101 }, { height: 100, width: 300 }),
    ).toBeNull();
  });
});

describe("reconcileImageComponents", () => {
  it("places a new import from its declared source size", () => {
    const asset = imageAsset({ id: "media-1", layerId: "layer-1" });
    const next = reconcile({}, [asset]);

    expect(next?.["layer-1"]).toMatchObject({
      height: 105,
      kind: "image",
      mediaId: "media-1",
      resourceRef: asset.resourceRef,
      width: 210,
    });
  });

  it("prefers decoded pixels over a wrong declared size", () => {
    const asset = imageAsset({
      id: "media-1",
      layerId: "layer-1",
      sourceSize: { height: 800, unit: "px", width: 800 },
    });
    const next = reconcile(
      {},
      [asset],
      new Map([["media-1", { height: 500, resourceRef: asset.resourceRef, width: 1000 }]]),
    );

    expect(next?.["layer-1"]?.width).toBe(210);
    expect(next?.["layer-1"]?.height).toBe(105);
  });

  it("replaces a stale record when a recycled id holds a different upload", () => {
    const previous = imageAsset({ id: "media-2", layerId: "layer-2", resourceRef: "old" });
    const placed = reconcile({}, [previous])!;
    const moved = {
      ...placed,
      "layer-2": { ...placed["layer-2"]!, centerX: 999, width: 40 },
    };
    const recycled = imageAsset({ id: "media-2", layerId: "layer-2", resourceRef: "new" });
    const next = reconcile(moved, [recycled]);

    expect(next?.["layer-2"]).toMatchObject({
      centerX: 250,
      resourceRef: "new",
      width: 210,
    });
  });

  it("replaces a record that points at another media id", () => {
    const asset = imageAsset({ id: "media-3", layerId: "layer-2" });
    const stale = reconcile({}, [imageAsset({ id: "media-1", layerId: "layer-2" })])!;

    expect(reconcile(stale, [asset])?.["layer-2"]?.mediaId).toBe("media-3");
  });

  it("keeps a matching record's placement and ignores decoded pixels for other content", () => {
    const asset = imageAsset({ id: "media-1", layerId: "layer-1" });
    const placed = reconcile({}, [asset])!;
    const moved = { "layer-1": { ...placed["layer-1"]!, centerX: 42 } };

    expect(reconcile(moved, [asset])).toBeNull();
    expect(
      reconcile(
        moved,
        [asset],
        new Map([["media-1", { height: 2000, resourceRef: "other", width: 100 }]]),
      ),
    ).toBeNull();
  });

  it("stamps a legacy record without moving it", () => {
    const asset = imageAsset({ id: "media-1", layerId: "layer-1" });
    const placed = reconcile({}, [asset])!;
    const { resourceRef: _dropped, ...legacy } = placed["layer-1"]!;
    const next = reconcile({ "layer-1": { ...legacy, centerX: 7 } }, [asset]);

    expect(next?.["layer-1"]).toMatchObject({
      centerX: 7,
      resourceRef: asset.resourceRef,
    });
  });

  it("follows a quarter-turn transform once the rotated pixels decode", () => {
    const asset = imageAsset({ id: "media-1", layerId: "layer-1" });
    const placed = reconcile({}, [asset])!;
    const rotated = { ...asset, transform: { rotationDeg: 90 as const } };
    const next = reconcile(
      placed,
      [rotated],
      new Map([["media-1", { height: 1000, resourceRef: asset.resourceRef, width: 500 }]]),
    );

    expect(next?.["layer-1"]!.height).toBeGreaterThan(next!["layer-1"]!.width);
    expect(next?.["layer-1"]!.centerX).toBe(placed["layer-1"]!.centerX);
  });

  it("reports only freshly placed layers", () => {
    const kept = imageAsset({ id: "media-1", layerId: "layer-1" });
    const placed = reconcile({}, [kept])!;
    const legacy = { "layer-1": { ...placed["layer-1"]!, resourceRef: undefined } };
    const fresh = imageAsset({ id: "media-2", layerId: "layer-2" });
    const result = reconcileImageComponents({
      components: legacy,
      decoded: new Map(),
      layerIds: new Set(["layer-1", "layer-2"]),
      mediaAssets: [kept, fresh],
      placement: printArea,
      restoredLayerIds: new Set(["layer-1"]),
      treatment: "print",
    });

    expect(result?.placedLayerIds).toEqual(["layer-2"]);
  });

  it("does not let a new upload adopt an unstamped record on a recycled id", () => {
    const old = reconcile({}, [imageAsset({ id: "media-5", layerId: "layer-5" })])!;
    const { resourceRef: _dropped, ...unstamped } = old["layer-5"]!;
    const upload = imageAsset({ id: "media-5", layerId: "layer-5", resourceRef: "svg" });
    const result = reconcileImageComponents({
      components: { "layer-5": { ...unstamped, centerX: 3 } },
      decoded: new Map(),
      layerIds: new Set(["layer-5"]),
      mediaAssets: [upload],
      placement: printArea,
      restoredLayerIds: new Set(),
      treatment: "print",
    });

    expect(result?.placedLayerIds).toEqual(["layer-5"]);
    expect(result?.components["layer-5"]).toMatchObject({ centerX: 250, resourceRef: "svg" });
  });

  it("ignores assets whose layer is gone", () => {
    const asset = imageAsset({ id: "media-1", layerId: "layer-1" });

    expect(
      reconcileImageComponents({
        components: {},
        decoded: new Map(),
        layerIds: new Set(),
        mediaAssets: [asset],
        placement: printArea,
        restoredLayerIds: new Set(),
        treatment: "print",
      }),
    ).toBeNull();
  });
});

describe("raisePlacedLayers", () => {
  const layers = [{ id: "text" }, { id: "layer-1" }, { id: "layer-2" }, { id: "layer-3" }];

  it("moves new uploads to the front, latest first", () => {
    expect(raisePlacedLayers(layers, ["layer-2", "layer-3"])?.map((l) => l.id)).toEqual([
      "layer-3",
      "layer-2",
      "text",
      "layer-1",
    ]);
  });

  it("returns null when there is nothing to move", () => {
    expect(raisePlacedLayers(layers, [])).toBeNull();
    expect(raisePlacedLayers(layers, ["text"])).toBeNull();
  });
});
