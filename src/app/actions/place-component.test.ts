import { expect, it } from "vitest";

import type { ToolcraftCommand } from "@/toolcraft/runtime";

import { MARKS } from "../library/marks";
import { TARGETS, type ComponentMap } from "../state/components";
import { placeMark, placeText } from "./place-component";

function emptyValues(): Record<string, unknown> {
  return {
    [TARGETS.components]: {},
    [TARGETS.garmentType]: "tee",
    [TARGETS.garmentView]: "front",
  };
}

function dispatchedCommands(
  run: (dispatch: (command: ToolcraftCommand) => void) => void,
): ToolcraftCommand[] {
  const commands: ToolcraftCommand[] = [];
  run((command) => {
    commands.push(command);
  });
  return commands;
}

function placedRecord(commands: readonly ToolcraftCommand[]) {
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
  const records = Object.values(map);
  expect(records).toHaveLength(1);
  return records[0];
}

it("places each library mark onto the garment when its tile is clicked", () => {
  for (const mark of MARKS) {
    const commands = dispatchedCommands((dispatch) => {
      placeMark(dispatch, emptyValues(), mark.id);
    });

    expect(commands[0]).toMatchObject({
      layer: { name: mark.label, visible: true },
      type: "layers.add",
    });

    const record = placedRecord(commands);
    expect(record.kind).toBe("mark");
    expect(record.markId).toBe(mark.id);
    expect(record.treatment).toBe("print");
    expect(record.centerX).toBeGreaterThan(0);
    expect(record.centerY).toBeGreaterThan(0);
  }
});

it("places a text component into the print area", () => {
  const commands = dispatchedCommands((dispatch) => {
    placeText(dispatch, emptyValues());
  });

  expect(commands[0]).toMatchObject({
    layer: { name: "Text", visible: true },
    type: "layers.add",
  });

  const record = placedRecord(commands);
  expect(record.kind).toBe("text");
  expect(record.text).toBe("Text");
  expect(record.treatment).toBe("print");
});

it("inherits the selected layer finish onto a newly placed mark", () => {
  const commands = dispatchedCommands((dispatch) => {
    placeMark(dispatch, {
      ...emptyValues(),
      [TARGETS.selectedTreatment]: "embroidery",
    });
  });

  expect(placedRecord(commands).treatment).toBe("embroidery");
});


it("assigns new marks and text to the garment side active at placement", () => {
  for (const view of ["front", "back"]) {
    for (const place of [placeMark, placeText]) {
      const commands = dispatchedCommands((dispatch) => place(dispatch, {
        ...emptyValues(), [TARGETS.garmentView]: view,
      }));
      expect(placedRecord(commands).view).toBe(view);
    }
  }
});
