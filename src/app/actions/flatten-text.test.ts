import { expect, it, vi } from "vitest";

import type { ToolcraftCommand } from "@/toolcraft/runtime";

import { DEFAULT_TYPOGRAPHY } from "../design/tokens";
import { TARGETS, type ComponentMap, type ComponentRecord } from "../state/components";

vi.mock("../renderer/measure", () => ({
  measureContext: () => ({}),
}));

vi.mock("../renderer/artwork", () => ({
  measureText: () => ({ height: 36, width: 140 }),
  rasterizeTextFill: () => ({
    height: 36,
    image: {
      convertToBlob: async () =>
        new Blob([Uint8Array.from([137, 80, 78, 71])], { type: "image/png" }),
    },
    resourceRef: "flattened-text",
    width: 140,
  }),
}));

vi.mock("../renderer/embedded-rasters", () => ({
  rememberEmbeddedRaster: () => undefined,
}));

const { flattenedImageRecord, flattenSelectedText } = await import("./flatten-text");

const textRecord: ComponentRecord = {
  backgroundRemoval: false,
  centerX: 120,
  centerY: 80,
  effectAmount: 8,
  effectAscii: false,
  effectBlackPoint: 0,
  effectBlur: 0,
  effectCharset: " .:;=+*#%@@",
  effectDither: "bayer",
  effectGamma: 1,
  effectInkHex: "#111111",
  effectInkId: "ink",
  effectPixelate: false,
  effectRecolor: false,
  effectWhitePoint: 255,
  height: 40,
  inkHex: "#111111",
  inkId: "ink",
  kind: "text",
  rotation: 12,
  text: "Studio",
  treatment: "print",
  typography: { ...DEFAULT_TYPOGRAPHY },
  view: "front",
  width: 200,
};

it("flattens selected text into an image component for effects", async () => {
  const converted = flattenedImageRecord(textRecord, "data:image/png;base64,QQ==", {
    height: 36,
    width: 140,
  });

  expect(converted.kind).toBe("image");
  expect(converted.rasterDataUrl).toBe("data:image/png;base64,QQ==");
  expect(converted.text).toBeUndefined();
  expect(converted.centerX).toBe(120);
  expect(converted.rotation).toBe(12);

  const commands: ToolcraftCommand[] = [];
  const values: Record<string, unknown> = {
    [TARGETS.components]: { "layer-text": textRecord },
  };

  await flattenSelectedText(
    (command) => {
      commands.push(command);
    },
    { selectedLayerId: "layer-text", values },
  );

  const write = commands.find(
    (command) =>
      command.type === "controls.setValue" &&
      command.target === TARGETS.components,
  );

  expect(write?.type).toBe("controls.setValue");
  if (write?.type !== "controls.setValue") {
    throw new Error("Expected a components value write.");
  }

  const map = write.value as ComponentMap;
  const flattened = map["layer-text"];

  expect(flattened?.kind).toBe("image");
  expect(flattened?.rasterDataUrl?.startsWith("data:image/png")).toBe(true);
  expect(flattened?.centerX).toBe(120);
  expect(
    commands.some(
      (command) =>
        command.type === "controls.setValue" &&
        command.target === TARGETS.selectedKind &&
        command.value === "image",
    ),
  ).toBe(true);
});
