"use client";
import * as React from "react";
import { Button, PanelSurface, PanelContentSurface, FieldDescription, FieldError } from "@/toolcraft/ui";
import { CaretDownIcon, CaretUpIcon, TrashIcon } from "@phosphor-icons/react";
import { PanelHost } from "../panel-host/panel-host";
import { useVersions } from "./versions-context";

export function VersionsPanel() {
  const versions = useVersions();
  const [collapsed, setCollapsed] = React.useState(false);
  const surface = React.useRef<HTMLDivElement>(null);
  const [expandedHeight, setExpandedHeight] = React.useState<number>();
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const toggle = () => {
    if (!collapsed) setExpandedHeight(surface.current?.getBoundingClientRect().height);
    setCollapsed(!collapsed);
  };
  if (!versions) return null;
  return <PanelHost panelType="layers" panelId="versions" position={position}
    onPositionChange={setPosition} snap={{ edges: ["left", "right", "bottom"], margin: 10 }}
    style={{ top: "auto", bottom: 10, left: 10, height: collapsed ? expandedHeight : undefined }}>
    <PanelSurface ref={surface}
    className="flex max-h-[40vh] w-[240px] flex-col overflow-hidden p-0"
    data-toolcraft-versions-panel=""
    aria-label="Versions"
  >
    <div data-panel-drag-handle className="flex h-9 shrink-0 cursor-grab touch-none items-center justify-between px-3 text-xs">
      <span className="font-medium">Versions</span>
      <Button variant="ghost" size="icon-sm"
        aria-label={collapsed ? "Expand Versions" : "Collapse Versions"}
        aria-expanded={!collapsed} onClick={toggle}>
        {collapsed ? <CaretDownIcon /> : <CaretUpIcon />}
      </Button>
    </div>
    {!collapsed && <PanelContentSurface className="min-h-0 overflow-y-auto">
      <div className="px-3 pb-2"><FieldDescription>Saved in this browser</FieldDescription></div>
      {versions.error && <div className="px-3 pb-2"><FieldError role="alert">{versions.error}</FieldError></div>}
      {versions.message && <div className="px-3 pb-2"><FieldDescription role="status">{versions.message}</FieldDescription></div>}
      <ol aria-label="Saved versions" className="flex flex-col gap-1 p-1">
        {versions.versions.map((version) => <li key={version.id} className="flex items-center justify-between gap-2 px-2 py-2">
          <div className="min-w-0"><div className="text-xs font-medium">{version.name}</div>
            <time className="text-[10px] opacity-60" dateTime={new Date(version.createdAt).toISOString()}>
              {new Date(version.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" })}
            </time>
          </div>
          <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" disabled={versions.busy} aria-label={`Restore ${version.name}`} onClick={() => versions.restore(version)}>Restore</Button>
          <Button variant="ghost" size="icon-sm" disabled={versions.busy} aria-label={`Delete ${version.name}`} onClick={() => versions.remove(version)}><TrashIcon /></Button>
          </div>
        </li>)}
        {versions.versions.length === 0 && <li className="px-2 pb-3 text-xs opacity-60">{versions.ready ? "Save a state to start your history." : "Loading versions…"}</li>}
      </ol>
    </PanelContentSurface>}
  </PanelSurface></PanelHost>;
}
