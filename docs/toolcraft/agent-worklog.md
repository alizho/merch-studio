# Toolcraft App Agent Worklog

## Status

Mode: product

Active change: branded-workspace-frame

This is a merch design studio. Later entries stay compact. Detailed requests and results belong in `docs/agent-journal/changes`; text command attempts live in `.toolcraft/journal/runs`.

## Decision Trail

### Merch Studio product

- Request: Build an internal apparel prototyping tool with garment views, colorways, placed artwork, and image export.
- Task type: first product delivery
- User-visible result: A t-shirt or hoodie mockup with placeable marks, type, and imports, plus print/embroidery treatment and PNG export.
- Source/reference checked: Infisical merch request and local Toolcraft contracts. No motion reference.
- Reference inputs: None
- Docs/contracts read: workflow.md, runtime-boundary.md, control-selection.md, layout.md, schema-reference.md, component-rules.md, decision-contract.md, acceptance-testing.md, setup-export.md, media-upload.md
- Contract rules applied: runtime-shell-required, canvas-no-app-ui, interaction-surface-ownership, layers-enabled-behavior, controls-product-coverage, output-export-required, persistence-policy-explicit
- View interaction intent: non-spatial; the garment is a flat Canvas 2D mockup with no model to orbit.
- Interaction ownership: canvas owns spatial select/transform/delete; panel owns text, type, and ink.
- Decision: Keep placement on the garment and property edits in the Selected section, with layers for order and visibility.
- Alternatives rejected: Panel-only placement, fontPicker (cannot load Alliance No.2 locally), locking the camera from a still frame.
- State/output mapping: garment.* drives the blank; design.components plus selectedLayer.* drive placed artwork and per-layer finish; rasterFrameRenderer draws PNG export.
- Performance intent: ordinary-product-work
- Verification: Product schema, canvas handles, and selected-entity panel controls are live in the merch studio.
- Risks: Copied runtime theme edits in src/styles.css still fail integrity until regenerated.

### Chrome Theme: Infisical Design System

- Entry type: focused
- Change ID: infisical-chrome-theme
- Request: use `design.md` (Infisical design system) to guide how the UI looks, and add a light/dark toggle.
- Changed owner: `src/styles.css` (framework-owned theme layer), by explicit user decision after the constraint was presented.
- User-visible result: both themes now carry the Infisical tokens - binary `#ffffff`/`#111111` surfaces over `#f3f4f6`/`#000000`, opaque `#dcdcdc`/`#2a2a2a` hairlines, every radius at 0, Alliance No.2 with JetBrains Mono on the uppercase label role, and Volt (`#F7FE62`) confined to selection, the charged toggle knob, the checkbox stroke and `::selection`. The light/dark toggle already existed through `toolbar.theme`; the `dark:` variant now follows the runtime theme scope instead of the static `.dark` class on `<html>`, so it tracks the toggle.
- Verification: `npm run typecheck` and `npm run build` pass. Visual proof captured in both themes at 1440x900 covering panel chrome, segmented, toggle, select popup, inputs, image-picker selection and primary actions.
- Risks: `node scripts/check-toolcraft-integrity.mjs` now reports `modified src/styles.css`, so `npm run test` fails on that file until the theme moves into the upstream monorepo runtime and the app is regenerated. Alliance No.2 ships Regular only here, so its face claims weights 400-600 and semibold weights render at Regular rather than synthesizing a faux bold. `--destructive` stays the single `#8a1208` red from the reference in both themes, which is low-contrast on the dark surface.

### Canvas selection commit

- Entry type: focused
- Change ID: canvas-selection-commit
- Request: when a component is selected, pressing enter or clicking anywhere in the canvas away from the component should unselect it.
- Changed owner: `src/app/canvas/design-canvas.tsx`, `src/app/canvas/handles.tsx`, `src/app/state/use-selection-sync.ts`
- User-visible result: selection chrome commits on Enter or an empty-canvas click. The component stays on the garment; the frame, nodes, and Selected panel hide until the artwork is clicked again.
- Verification: unit test `clears canvas selection chrome with Enter or an empty-canvas click`; live canvas check of select, Enter, empty-canvas click, and re-select.
- Risks: runtime `layers.select` cannot clear `selectedLayerId`, so the layers list may still highlight the last layer while the canvas looks unselected. Dropdown Enter is ignored so Face/Ink menus still confirm.

### Canvas selection style

- Entry type: focused
- Change ID: canvas-selection-style
- Request: remove the black stroke behind the dashed selection border, reduce the anchor size, and keep selection chrome a constant screen size while canvas zoom changes.
- Changed owner: `src/app/canvas/design-canvas.tsx`, `src/app/canvas/handles.tsx`, `src/app/canvas/selection-chrome.ts`, `src/app/canvas/selection.test.ts`
- User-visible result: the selection frame now uses one Volt dashed stroke with no dark underlay. Visible anchors are 12 screen pixels and all selection chrome dimensions remain constant through canvas zoom; 24-pixel invisible targets preserve handle usability.
- Verification: focused selection metric unit test passed; live zoom comparison confirmed 12-pixel anchors and one Volt polygon.
- Risks: the protected feature receipt is unavailable until its dependency-authority preflight supports the installed dependency layout/Node version; the focused unit, type, and live browser checks passed.

### Optimized shirt asset

- Entry type: focused
- Change ID: optimized-shirt-asset
- Request: create an optimized derivative of `public/garments/3d/t-shirt_3d_model_free.glb` with reduced geometry and front/back print surfaces, without integrating it into the app.
- Changed owner: `public/garments/3d/t-shirt_3d_model_free.optimized.glb`; the source GLB remains unchanged.
- User-visible result: created a separate 743,960-byte GLB containing an 18,000-triangle shirt plus named `PrintSurface_Front` and `PrintSurface_Back` meshes (1,296 triangles each), with clean rectangular 0–1 UV maps projected onto the garment curvature. The 7,610,528-byte source remains unchanged.
- Verification tier: Tier 1
- Reason: one new, currently unreferenced product asset; no schema, runtime, renderer, controls, export, or application behavior changes.
- Run: GLB structural inspection passed; Toolcraft production decoder reported no decode diagnostics; realtime topology analysis found 20,592 triangles, 15,429 vertices, and a 105,875,352-byte estimated peak below the 268,435,456-byte ceiling; front/back names and exact 0–1 UV bounds passed; host-embedded +Z/−Z visual inspection confirmed clean, curved print zones on the intended sides.
- Skip: app feature, delivery, export, persistence, and performance gates because the derivative is not yet connected to the application.
- Risks: realtime topology analysis remains at `warning` because the source garment contains split seams/disconnected components and non-manifold vertices; there are no fatal diagnostics, out-of-range indices, unused vertices, or resource-limit failures. App integration remains intentionally unimplemented.

### Components panel

- Entry type: focused
- Change ID: components-panel
- Request: artwork should be called components; library should be under components (image library); clicking on a component in the library should automatically add to the canvas; under components should be add image, text, etc.
- Changed owner: `src/app/app-schema.ts`, `src/app/controls/library-stamp-control.tsx`, `src/app/actions/place-component.ts`
- User-visible result: One Components section with Image library tiles that stamp on click, Add image, and Add text.
- builtInFitCheck: ImagePicker stores a selection and ignores a second click on the same tile, so a custom stamp grid reuses public ImagePicker chrome and dispatches place commands on every click.
- Visual map: public `ImagePicker` owns tile chrome, hover, focus, and selected outline; product geometry is only the existing mark preview SVGs inside those tiles.
- Verification: unit tests `places each library mark onto the garment when its tile is clicked` and `places a text component into the print area`; host-embedded browser check of the Components section.
- Risks: Runtime still splits mixed standalone/grouped sections unless Components is authored `layout: "standalone"`.

### Selected layer finish

- Entry type: focused
- Change ID: selected-layer-finish
- Request: the Selected panel for the current selected layer should be a separate panel above layers; treatment (print/stitch) should apply only to a layer.
- Changed owner: `src/app/app-schema.ts`, `src/app/state/components.ts`, `src/app/renderer/compose.ts`
- User-visible result: Finish lives in the Selected inspector and writes `selectedLayer.treatment` onto that component only. Layers stay the left dock; Selected remains a dedicated Controls section that hides with no selection because the signed host has no second left inspector type.
- Verification: unit tests for placement inherit, legacy treatment hydration, and authored per-layer finish; host-embedded browser check of Selected Finish with two layers.
- Risks: Older workspaces without per-record finish still inherit the saved global `treatment` value once, then keep independent layer finishes.

## Decisions

### Renderer

- Decision: Canvas 2D product renderer draws the garment and components through `drawDesign`, shared with PNG export.
- Reason: The mockup is a flat composited image, not a spatial model or vector document.
- Evidence: `src/app/renderer/compose.ts`, `src/app/canvas/design-canvas.tsx`.

### View Interaction

- Decision: `non-spatial`.
- Reason: The garment is a flat mockup; there is no three-dimensional scene or model to orbit.
- Evidence: `appProductReadiness.viewInteraction` in `src/app/app-acceptance-data.ts`.

### Interaction Ownership

- Decision: Canvas owns spatial select, transform, and delete; the panel owns text, type, ink, finish, and exact rotation.
- Reason: Placement is judged against the garment; token, finish, and text values are not spatial.
- Evidence: `interactionOwnership` entries `component.select`, `component.transform`, `component.delete`, and selected-entity panel ids.

### Timeline

- Decision: No timeline.
- Reason: The studio is a still mockup with image export only.
- Evidence: `appTransferMode.animationIntent.mode: "none"` and no video export request.

### Layers

- Decision: Layers enabled for component order, visibility, and selection.
- Reason: Multiple placed marks, type, and imports are independently ordered and hidden.
- Evidence: `layersModule()` in `src/app/app-schema.ts` and layers acceptance rows.

### Controls

- Decision: Garment, Components, and Selected sections; Selected is hidden when canvas chrome is committed. Finish lives on the selected layer. Components keeps Image library, Add image, and Add text in one standalone section so fileDrop does not split away. Library tiles stamp a mark on every click.
- Reason: Controls group by the blank, adding components, and editing the active component.
- Evidence: `appControlSectionInventory` and `src/app/app-schema.ts`.

### Export

- Decision: Toolcraft-default PNG export; SVG and video not requested.
- Reason: The output is a raster mockup of the garment.
- Evidence: `productReadiness.exportIntent` and `imageExportModule()`.

### Performance

- Decision: No measured performance iteration; ordinary feature checks only.
- Reason: This pass changes selection chrome, not renderer workload.
- Evidence: Focused unit and browser checks on `handle.deselect`.

Canonical control values and selected-entity isolation must follow runtime representations and the declared selection owner. Render-scale-enabled products record functional `renderScaleCoverage`; prose never substitutes for asserted backing-quality proof.

## Evidence

- Source reviewed: neutral starter schema and local Toolcraft docs.
- Contract applied: product decisions belong to the generated app; platform development history is not copied into this template.

## Verification

Protected receipts own initial/performance proof. Later edits record focused checks and text journal run IDs. Failed attempts and their retries remain separate; no screenshots, videos or binary traces are required by the journal.

## Risks

- Risk: Replace neutral decisions before first product delivery. Historical source revisions or message references that are unknown must remain explicitly unknown.


### Garment plane flip

- Entry type: focused
- Change ID: garment-plane-flip
- Request: i want to try mimicking a 3d effect for the garment in this project by having the front and back of a garment be flip sides on a plane, so that we can animate flipping between front and back, with slight tilt when hovering near the garment.
- Changed owner: product canvas presentation and garment.view acceptance.
- Decision: Two retained Canvas 2D faces on a CSS 3D plane; existing garment.view selects the face. Hover adds at most five degrees of presentation-only tilt. No new product settings or animation transport. Flat artwork editing and image export retain their existing coordinates and semantics.
- View interaction: non-spatial artwork editor with a transient CSS depth effect, not an editable model/camera. Panel owns front/back; canvas pointer proximity owns decorative tilt.
- Workload/lifecycle: exactly two fixed-size garment faces, decoded source cache shared with export; redraw only on scene/resources/font changes. Flip and tilt only composite transforms, never rerasterize pixels per animation frame. Pointer updates coalesce to one frame and stop on editing, drag, wheel, blur, reduced motion, or unmount.
- Verification tier: focused later feature edit.
- Reason: bounded preview presentation change; no state schema, media, persistence, or export mutation.
- Run: garment.view focused feature check plus dedicated flip/hover/reduced-motion browser assertions and manual embedded-browser inspection.
- Skip: aggregate delivery, build, full suite, export matrix and measured performance; unrelated to this preview-only change.
- Verification: 27 focused placement/component/import unit tests pass; TypeScript checking and diff whitespace checks pass. Embedded browser confirmed original front artwork absent on back, new BACK ONLY text absent on front and preserved on return/reload, and selecting the other face’s layer switches views. Temporary text removed after verification. Protected feature runner blocked before tests by installed dependency symlink inspection; direct focused Playwright blocked in framework reporter TypeScript transformation (declare class). No protected browser pass or measured performance claimed.
- Risks: existing performance configuration is still the neutral baseline; this pass does not claim performance certification or retrofit unrelated renderer contracts. The subsequent garment-side-isolation change assigns artwork to individual faces.

### Independent garment artwork sides

- Entry type: focused
- Change ID: garment-side-isolation
- Request: elements on the front should stay on the front; elements on the back should stay on the back.
- Changed owner: component records, placement/import reconciliation, selection synchronization, shared composition, canvas handles.
- Decision: persist each component's garment view with its existing record. Unassigned legacy records resolve to front. Both retained preview faces and export filter by that assignment; canvas handles only expose the current side. Selecting an opposite-side layer navigates to its owning side. Switching views clears hidden artwork editing.
- Verification tier: focused later edit.
- Run: side-isolation unit tests and focused browser proof covering creation, independent editing, switching, and reload.
- Skip: aggregate build/delivery/performance; no unrelated runtime changes.
- Verification: 27 focused placement/component/import unit tests pass; TypeScript checking and diff whitespace checks pass. Embedded browser confirmed original front artwork absent on back, new BACK ONLY text absent on front and preserved on return/reload, and selecting the other face’s layer switches views. Temporary text removed after verification. Protected feature runner blocked before tests by installed dependency symlink inspection; direct focused Playwright blocked in framework reporter TypeScript transformation (declare class). No protected browser pass or measured performance claimed.

### Saved versions panel investigation

- Entry type: focused investigation; implementation pending source project.
- Change ID: saved-versions-panel
- Request: separate version timeline panel and replace Save State as Default with Save State.
- Inspected owner: SaveAppDefaults, defaults authoring context, canonical module panel catalog, and core/setup-export.md snapshot/resource lifetime contract.
- Decision: use an opt-in runtime saved-versions module with immutable full-workspace snapshots and retained media resources. Keep image-animation transport separate. Concrete implementation and focused checks are in docs/plans/saved-versions.md.
- Blocker: this generated app has no separate-panel extension point or version-history host API; AGENTS.md prohibits editing its framework copy. Source Toolcraft checkout was not found in the nearby project/document/download directories. Requested its location from the user.
- Verification: read-only source inspection; no product implementation or tests for this request yet.


### Local saved versions implementation

- Entry type: substantial feature, plan in docs/plans/saved-versions.md.
- Change ID: local-saved-versions
- Request authority: "Bypass the AGENTS.md rule and modify the code directly inside this repo if that's possible" followed by "continue".
- Decision: user-authorized edits to the bundled framework. Save State creates immutable browser-local revisions in IndexedDB, with separately copied, deduplicated binary resources. Versions panel lists and restores snapshots. Restore first captures a recovery checkpoint; app defaults are not modified. No source host, app reload, or animation timeline involved.
- Verification tier: focused save/restore feature and TypeScript checks; no aggregate integrity/delivery/performance gate. Signed integrity will intentionally report the authorized framework changes; do not rewrite its manifest.
- Run: focused repository atomicity and workspace restoration tests, manual embedded-browser save/edit/restore/reload checks.
- Verification: two focused IndexedDB/workspace unit tests passed; TypeScript and diff whitespace checks passed. Embedded browser verified Save State, editing, restore without navigation, recovery checkpoints, and history after reload. Focused Playwright e2e/product-versions.spec.ts passed (1 test): saved front/back text plus uploaded artwork, deleted the artwork, reloaded, restored the prior version, and matched the back canvas pixels exactly; front/back text remained isolated. Used --reporter=list because the existing protected reporter fails its TypeScript transform. Layer deletion used keyboard activation because the existing layer hover surface intercepts pointer clicks. No protected receipt or aggregate integrity pass claimed.

### Version deletion and panel placement

- Entry type: focused later edit.
- Change ID: versions-panel-controls
- Request: delete versions; draggable panel; collapse upward; default bottom-left with matching margins.
- Owners: version repository/context/panel. Continue authorized bundled-runtime edits.
- Decision: delete one snapshot and reclaim only unreferenced saved resources; reuse PanelHost drag/snap behavior with 10px bottom/left margins and preserve the header position while collapsing.
- Verification: focused repository deletion test and browser delete/reload, drag, collapse geometry checks; no aggregate gate.

- Result: three repository tests passed, including shared-resource retention and app-scoped deletion. Both focused browser tests passed: save/restore regression, deletion persisted after reload, 10px bottom-left placement, dragging, and unchanged header position on collapse. TypeScript and whitespace checks passed. Existing protected reporter limitation remains; used the diagnostic list reporter.

### Branded workspace frame

- Entry type: focused later edit.
- Change ID: branded-workspace-frame
- Request: theme-aware border around everything; logo and grey Alliance Merch Studio title in the upper-left. User selected whole workspace and compact 48px header.
- Owner: authorized local runtime app shell and panel viewport geometry.
- Decision: 48px header, 8px side/bottom frame, theme surface/foreground tokens, SVG mask for logo recoloring, existing Alliance font. Canvas and floating panels live in the inset workspace; snap bounds follow that workspace.
- Focused checks: browser frame geometry/theme/logo/title and panel placement; existing save/restore checks only if impacted. No aggregate gate.

- Result: embedded-browser visual check passed in light and dark modes. Adjusted Controls/Layers maximum heights to the inset workspace, preserving visible sticky export. Three focused browser checks passed (branding/theme/frame bounds, version restore, version deletion/drag/collapse). Diff whitespace clean. Diagnostic list reporter used; no aggregate certification claimed.

### Merch Studio wordmark alignment

- Entry type: focused visual refinement.
- Change ID: merch-studio-wordmark-alignment
- Request: enlarge Merch Studio and align it lower with the Infisical wordmark.
- Changed owner: workspace frame title typography.
- Result: increased the Alliance title from 14px to 18px with a 22px line height and a 2px optical downward adjustment.
- Focused checks: embedded-browser inspection confirmed the larger title and optical baseline alignment in the workspace header; no aggregate gate.
