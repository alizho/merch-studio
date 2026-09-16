import { expect, it } from "vitest";

import { componentIdsForView, readComponentRecord, readComponents, TARGETS } from "./components";

it("hydrates a missing finish from the legacy garment treatment", () => {
  const record = readComponentRecord(
    {
      centerX: 10,
      centerY: 20,
      height: 40,
      inkHex: "#FF6B3D",
      inkId: "ink",
      kind: "mark",
      markId: "wordmark",
      rotation: 0,
      width: 80,
    },
    "embroidery",
  );

  expect(record?.treatment).toBe("embroidery");
});

it("keeps an authored layer finish instead of the legacy garment value", () => {
  const components = readComponents({
    [TARGETS.treatment]: "embroidery",
    [TARGETS.components]: {
      "layer-a": {
        centerX: 10,
        centerY: 20,
        height: 40,
        inkHex: "#FF6B3D",
        inkId: "ink",
        kind: "mark",
        markId: "wordmark",
        rotation: 0,
        treatment: "print",
        width: 80,
      },
    },
  });

  expect(components["layer-a"]?.treatment).toBe("print");
});


it("keeps front and back artwork isolated through saved records and visible ordering", () => {
  const components = readComponents({
    [TARGETS.components]: JSON.parse(JSON.stringify({
      legacy: { kind: "text", text: "OLD" },
      front: { kind: "text", text: "FRONT", view: "front" },
      back: { kind: "text", text: "BACK", view: "back" },
    })),
  });
  expect(components.legacy.view).toBe("front");
  expect(componentIdsForView(components, ["back", "front", "legacy", "missing"], "front")).toEqual(["front", "legacy"]);
  expect(componentIdsForView(components, ["back", "front", "legacy"], "back")).toEqual(["back"]);
  expect(componentIdsForView(components, ["front"], "back")).toEqual([]);
});
