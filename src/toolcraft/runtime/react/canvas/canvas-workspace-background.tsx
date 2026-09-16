"use client";

import {
  CanvasDashedGridPattern,
  CanvasDotPattern,
  CanvasTicksGridPattern,
} from "@/toolcraft/ui";
import { toolcraftCanvasWorkspaceBackgroundTarget } from "../../schema/runtime-targets";
import { useToolcraftValue } from "../app-shell/use-toolcraft";
import { useCanvasViewportTransform } from "./canvas-viewport-world";

function WorkspaceDots(): React.JSX.Element {
  const { offsetX, offsetY, zoom } = useCanvasViewportTransform();
  return <CanvasDotPattern offset={{ x: offsetX, y: offsetY }} scale={zoom / 100} />;
}

function WorkspaceDashed(): React.JSX.Element {
  const { offsetX, offsetY, zoom } = useCanvasViewportTransform();
  return <CanvasDashedGridPattern offset={{ x: offsetX, y: offsetY }} scale={zoom / 100} />;
}

function WorkspaceTicks(): React.JSX.Element {
  const { offsetX, offsetY, zoom } = useCanvasViewportTransform();
  return <CanvasTicksGridPattern offset={{ x: offsetX, y: offsetY }} scale={zoom / 100} />;
}

export function CanvasWorkspaceBackground(): React.JSX.Element | null {
  const mode = useToolcraftValue(toolcraftCanvasWorkspaceBackgroundTarget);

  switch (mode) {
    case "dots":
      return <WorkspaceDots />;
    case "dashed":
      return <WorkspaceDashed />;
    case "ticks":
      return <WorkspaceTicks />;
    default:
      return null;
  }
}
