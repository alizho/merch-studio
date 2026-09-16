# Toolcraft App Agent Worklog

## Status

Mode: product

Active change: canvas-selection-style

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
- State/output mapping: garment.* and treatment drive the blank; design.components plus selectedLayer.* drive placed artwork; rasterFrameRenderer draws PNG export.
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
- Verification tier: Tier 1
- Reason: localized product-owned canvas overlay styling and zoom geometry; product rendering, export, controls, and runtime ownership are unchanged.
- Run: focused selection metric unit test passed (2 tests); typecheck passed; manual in-app browser comparison at 64% and 104% measured 12-pixel anchors at both zoom levels, one `#F7FE62` polygon, and no underlay polygon. `npm run test:feature -- handle.resize` was attempted but its protected dependency-authority preflight failed before app startup while inspecting ordinary package-manager symlinks under `node_modules/vite-node`, including a Node 26 stack overflow.
- Skip: aggregate delivery, export, persistence, and performance checks because this later edit does not change those paths.
- Risks: the protected feature receipt is unavailable until its dependency-authority preflight supports the installed dependency layout/Node version; the focused unit, type, and live browser checks passed.

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

- Decision: Canvas owns spatial select, transform, and delete; the panel owns text, type, ink, and exact rotation.
- Reason: Placement is judged against the garment; token and text values are not spatial.
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

- Decision: Garment, Treatment, Artwork, and Selected sections; Selected is hidden when canvas chrome is committed.
- Reason: Controls group by the blank, the finish, adding artwork, and editing the active component.
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
