/**
 * Product panel actions.
 *
 * Add text and Flatten are local commands; library tiles stamp marks
 * themselves. Export is runtime-owned and never reaches this handler.
 */

import type { ToolcraftPanelActionHandler } from "@/toolcraft/runtime/react";

import { flattenSelectedText } from "./flatten-text";
import { placeText } from "./place-component";

export const onPanelAction: ToolcraftPanelActionHandler = ({
  action,
  dispatch,
  state,
}) => {
  if (action.value === "component.addText") {
    placeText(dispatch, state.values as Record<string, unknown>);
    return;
  }

  if (action.value === "component.flattenText") {
    return flattenSelectedText(dispatch, state);
  }
};
