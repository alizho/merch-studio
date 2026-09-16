# Saved versions panel

Request: replace “Save State as Default” with “Save State” and show saved states in a separate chronological panel.

Status: user explicitly authorized direct bundled-framework edits. Implemented browser-local IndexedDB revision storage and independent binary copies, replacing the initial host-backed approach; no source repository required.

## Behavior

- A separate collapsible Versions panel lists saved states chronologically, newest first, with a version number and timestamp.
- Save State captures a complete immutable workspace revision: both garment faces and their component records, layers, imported artwork, garment settings, and the existing workspace snapshot fields.
- Saving leaves the current editor open, does not reload it, and does not overwrite app-defaults.json or change Reset semantics.
- Each entry has a Restore action. Restoring first preserves the current draft as a recovery checkpoint, then atomically restores the selected snapshot. Saved revisions remain immutable.
- A subsequent save creates a new entry, recording its parent revision; it never overwrites the restored entry or removes later versions.
- Versions survive reload. Resource bytes referenced by any revision must survive deletion from the current workspace.
- Start with browser-local history using runtime source-resource capture and validated snapshot codecs. Cloud sync and collaborative merging are outside this request.

## Owners and implementation

The user authorized changes directly in this repository's bundled runtime.

1. Runtime VersionsProvider owns capture and restore; VersionsPanel reuses panel and button primitives.
2. IndexedDB stores immutable snapshots and independent content-addressed resource bytes in one atomic transaction. Existing workspace resource cleanup cannot remove revision copies.
3. Restore validates the snapshot and resource digests, hydrates media through the source coordinator, saves a recovery checkpoint, and replaces workspace state through the store. Concurrent draft edits abort restoration.
4. Save State replaces the source-default authoring action. Source defaults remain unchanged.
5. History is local to this browser and application identity. No cloud sync, source host, or separate source checkout is required.

## Focused verification

- Unit: immutable revisions, parent identity, concurrent/stale saves, atomic failed saves/restores, snapshot validation, and resource retention across revisions.
- Browser: save A with front/back artwork; edit and save B; restore A; verify both faces, layers and uploads; restore B; reload and restore again; prove the draft recovery checkpoint and absence of an app reload on Save.
- Check that Reset defaults remain unchanged and old uploaded bytes remain recoverable after removing them from the active draft.
- Run source module tests and app acceptance for save/restore only. No performance measurements are requested.

## Inspected constraints

- AGENTS.md forbids edits to the generated src/toolcraft copy and requires changing the monorepo owner and regenerating.
- SaveAppDefaults lives in src/toolcraft/runtime/react/controls-panel/renderers/controls-panel-save-defaults.tsx.
- The host authoring context currently exposes only save(defaults, resources).
- The panel catalog currently contains only layers and the animation timeline; there is no product-owned separate-panel port.
- Existing default-resource cleanup is scoped to the latest defaults snapshot, so simply reusing that save endpoint would endanger prior revision resources.
