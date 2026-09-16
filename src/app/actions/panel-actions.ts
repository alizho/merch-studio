/**
 * Product panel actions.
 *
 * Add text is the remaining local command; library tiles stamp marks
 * themselves. Export is runtime-owned and never reaches this handler.
 */

import type { ToolcraftPanelActionHandler } from "@/toolcraft/runtime/react";

import { placeText } from "./place-component";

export const onPanelAction: ToolcraftPanelActionHandler = ({
  action,
  dispatch,
  state,
}) => {
  if (action.value !== "component.addText") {
    return;
  }

  placeText(dispatch, state.values as Record<string, unknown>);
};
