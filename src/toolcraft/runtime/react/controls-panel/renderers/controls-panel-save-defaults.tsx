"use client";
import { Button, FieldError, PanelActions } from "@/toolcraft/ui";
import type { ToolcraftState } from "../../../state/types";
import { useVersions } from "../../versions/versions-context";

/** The local app explicitly replaces source-default authoring with saved revisions. */
export function SaveAppDefaults(_props: { getState: () => ToolcraftState }) {
  const versions = useVersions();
  if (!versions) return null;
  return <>
    <PanelActions columns={1}>
      <Button type="button" variant="outline" loading={versions.busy}
        disabled={!versions.ready} onClick={versions.save}>Save State</Button>
    </PanelActions>
    {versions.error ? <FieldError role="alert">{versions.error}</FieldError> : null}
  </>;
}
