import type {
  ToolcraftComponentAcceptance,
  ToolcraftControlSectionInventoryEntry,
  ToolcraftProductReadiness,
  ToolcraftTransferMode,
} from "./acceptance/types";
import { appSchema } from "./app-schema";
import {
  garmentColorwayControlType,
  inkColorwayControlType,
} from "./controls/colorway-control-types";
import { libraryStampControlType } from "./controls/library-stamp-control-types";

const persistenceSlices =
  appSchema.persistence.storage === "localStorage"
    ? appSchema.persistence.include
    : [];

export const appTransferMode: ToolcraftTransferMode = {
  animationIntent: { mode: "none" },
  mode: "new-toolcraft-app",
  referenceInputs: [],
};

export const appProductReadiness: ToolcraftProductReadiness = {
  exportIntent: {
    image: { mode: "toolcraft-default" },
    svg: { mode: "not-requested" },
    video: { mode: "not-requested" },
  },
  /**
   * Direct manipulation belongs on the canvas because placement is spatial and
   * the artwork is the feedback. The panel owns exact values, colors, and text,
   * which a drag cannot express. The two surfaces carry different capabilities
   * rather than two copies of one operation.
   */
  interactionOwnership: [
    {
      alternative: {
        reason:
          "A panel list would name components but could not express which one the pointer is over on the garment.",
        surface: "panel",
      },
      capability: "spatial-selection",
      evidence: {
        detail:
          "Placement is spatial, so selecting the artwork under the pointer is the discoverable path and the layers panel remains the structured list.",
        source: "usability-analysis",
      },
      id: "component.select",
      reason:
        "Selection happens on the artwork itself, where the user is already looking.",
      surface: "canvas",
      target: "design.components",
    },
    {
      alternative: {
        reason:
          "Typing coordinates cannot show the design against the garment while it moves.",
        surface: "panel",
      },
      capability: "direct-spatial-edit",
      evidence: {
        detail:
          "The user asked for draggable, resizable, rotatable components, which is direct manipulation of position, scale, and angle.",
        source: "user-request",
      },
      id: "component.transform",
      reason:
        "Position, scale, and angle are judged against the garment, so the gesture owns them.",
      surface: "canvas",
      target: "design.components",
    },
    {
      alternative: {
        reason:
          "The runtime layers panel keeps the structured list path for removal; the canvas node is the direct one on the artwork itself.",
        surface: "panel",
      },
      capability: "command",
      evidence: {
        detail:
        "The user asked for a delete control at the top right of the component selection, on the canvas, occupying the top-right selection knob.",
        source: "user-request",
      },
      id: "component.delete",
      reason:
        "Removing the artwork you are looking at should not require finding it in a list.",
      surface: "canvas",
      target: "design.components",
    },
    {
      alternative: {
        reason:
          "The rotate gesture cannot land an exact angle or be driven from the keyboard.",
        surface: "canvas",
      },
      capability: "precise-value-entry",
      evidence: {
        detail:
          "The gesture and the numeric field are different capabilities: one is coarse and spatial, the other exact and keyboard reachable.",
        source: "usability-analysis",
      },
      id: "component.rotation.value",
      reason: "An exact angle is a value, not a gesture.",
      selectionScope: {
        mode: "selected-entity",
        selectionInteractionId: "component.select",
      },
      surface: "panel",
      target: "selectedLayer.rotation",
    },
    {
      alternative: {
        reason:
          "Canvas chrome for a constrained swatch set would duplicate a panel control without adding spatial meaning.",
        surface: "canvas",
      },
      capability: "property-edit",
      evidence: {
        detail:
          "Ink is a constrained token choice with no spatial component, so it belongs beside the other garment tokens.",
        source: "usability-analysis",
      },
      id: "component.ink",
      reason: "Ink is a token choice, not a position.",
      selectionScope: {
        mode: "selected-entity",
        selectionInteractionId: "component.select",
      },
      surface: "panel",
      target: "selectedLayer.ink",
    },
    {
      alternative: {
        reason:
          "A global finish would restitch every component when only one layer should change.",
        surface: "canvas",
      },
      capability: "property-edit",
      evidence: {
        detail:
          "Print versus stitch is a per-layer finish with no spatial component, so it belongs with the other selected-layer properties.",
        source: "user-request",
      },
      id: "component.treatment",
      reason: "Finish applies to the selected layer only.",
      selectionScope: {
        mode: "selected-entity",
        selectionInteractionId: "component.select",
      },
      surface: "panel",
      target: "selectedLayer.treatment",
    },
    {
      alternative: {
        reason:
          "Background cleanup is a reversible image property, not spatial canvas manipulation.",
        surface: "canvas",
      },
      capability: "property-edit",
      evidence: {
        detail:
          "The user explicitly requested the ability to remove backgrounds from added images.",
        source: "user-request",
      },
      id: "component.background-removal",
      reason:
        "The selected-image switch keeps cleanup discoverable and applies it only to that artwork layer.",
      selectionScope: {
        mode: "selected-entity",
        selectionInteractionId: "component.select",
      },
      surface: "panel",
      target: "selectedLayer.cutout",
    },
    {
      alternative: {
        reason:
          "Dropping a mark onto the garment would hide which library tile was chosen and duplicate the catalog already in the panel.",
        surface: "canvas",
      },
      capability: "command",
      evidence: {
        detail:
          "Clicking a component in the library should automatically add it to the canvas.",
        source: "user-request",
      },
      id: "component.place.library",
      reason:
        "The image library is a catalog of stamps; clicking a tile is the add command.",
      surface: "panel",
      target: "library.mark",
    },
    {
      alternative: {
        reason:
          "In-canvas text editing would rebuild a text input over product output.",
        surface: "canvas",
      },
      capability: "property-edit",
      evidence: {
        detail:
          "Content and typography are textual settings the runtime already owns as schema controls.",
        source: "usability-analysis",
      },
      id: "component.text",
      reason: "Text content and typography are panel values.",
      selectionScope: {
        mode: "selected-entity",
        selectionInteractionId: "component.select",
      },
      surface: "panel",
      target: "selectedLayer.text",
    },
    {
      alternative: {
        reason:
          "Flattening on the canvas would hide that type becomes pixels and would duplicate the Effects workflow.",
        surface: "canvas",
      },
      capability: "command",
      evidence: {
        detail:
          "Add ability to flatten the text so that it can go through the same treatment for effects as other images.",
        source: "user-request",
      },
      id: "component.flatten",
      reason:
        "Flatten is a one-shot convert-to-pixels command next to the type settings it replaces.",
      selectionScope: {
        mode: "selected-entity",
        selectionInteractionId: "component.select",
      },
      surface: "panel",
      target: "component.flatten",
    },
  ],
  mode: "product",
  productName: "Merch Studio",
  productSummary:
    "An internal tool for prototyping apparel designs: pick a garment and colorway, place marks, type, and imported artwork inside the print area, and finish each layer as screen print or embroidery.",
  requestedBehavior:
    "Flip a t-shirt or hoodie between front and back, apply a curated garment colorway, place aspect-correct text, library marks, and distinct imported artwork, remove flat image backgrounds, undo and redo every edit, keep the design across reloads, and switch the selected layer between a print and an embroidery treatment.",
  viewInteraction: {
    mode: "non-spatial",
    reason:
      "The artwork editor stays planar. Front/back switching and pointer proximity add transient CSS depth to two Canvas 2D faces; there is no editable model or camera pose.",
  },
};

export const appAcceptance: readonly ToolcraftComponentAcceptance[] = [
  {
    automated: true,
    automatedTestName:
      "resolves each garment type to its own artwork and print area",
    browser: false,
    componentType: "segmented",
    evidence: "product-output",
    expectedObservable:
      "Choosing Hoodie draws the hoodie artwork, masks components to the hoodie silhouette, and lands new artwork above the pocket seam.",
    fixture: "garment art for both types",
    id: "garment.type",
    kind: "control",
    optionCoverage: "each-visible-item",
    target: "garment.type",
    userAction: "Choose T-shirt, then Hoodie.",
  },
  {
    automated: true,
    automatedTestName: "keeps front and back artwork isolated through saved records and visible ordering",
    browser: {
      budget: "standard",
      file: "e2e/product-garment-flip.spec.ts",
      testName: "browser: garment flips between retained faces and tilts on hover",
    },
    componentType: "segmented",
    evidence: "product-output",
    expectedObservable:
      "Choosing Back rotates the retained plane to upright back artwork; Front returns it. Pointer proximity tilts the garment subtly, leaving artwork editing planar; reduced motion disables both movements. Each face renders only its own assigned elements, and switching sides clears hidden selection.",
    fixture: "garment art for both views",
    id: "garment.view",
    kind: "control",
    optionCoverage: "each-visible-item",
    target: "garment.view",
    userAction: "Choose Front, then Back.",
  },
  {
    automated: true,
    automatedTestName:
      "resolves every garment colorway, and the custom dye, to one hex",
    browser: false,
    builtInFitCheck: {
      capabilities: ["custom-value-model", "custom-visualization"],
      checkedBuiltIns: ["imagePicker", "palette", "color", "segmented", "select"],
      closestBuiltIn: "imagePicker",
      productObservable:
        "Choosing a stock square dyes the garment to that colorway; choosing the custom square dyes it to the hex the color control holds, and that hex stays visible inside the custom square.",
      whyInsufficient:
        "ImagePicker's value is membership in a fixed item list, so it cannot hand off to an arbitrary color, and the color control has no curated stock list to hand off from. This value is one dye: a stock colorway id or the custom id that defers to a hex, and the row has to show the live custom hex to say which dye is active.",
    },
    componentType: garmentColorwayControlType,
    customControlCoverage: [
      "built-in-gap",
      "kit-primitives",
      "minimal-ui",
      "product-output",
      "runtime-state",
    ],
    evidence: "rendered-pixels",
    expectedObservable:
      "Each colorway multiplies its hex through the garment shading, so the garment changes color while keeping its folds.",
    fixture: "eight stock garment colorways and one custom dye",
    id: "garment.color",
    kind: "control",
    optionCoverage: "each-visible-item",
    target: "garment.color",
    userAction: "Choose each colorway square, then the custom square.",
  },
  {
    automated: true,
    automatedTestName: "dyes the garment to a custom hex outside the stock list",
    browser: false,
    componentType: "color",
    evidence: "rendered-pixels",
    expectedObservable:
      "Editing the custom dye retints the garment to that hex, still through the garment's baked shading.",
    fixture: "the custom colorway selected",
    id: "garment.customColor",
    kind: "control",
    target: "garment.customColor",
    userAction:
      "Choose the custom square, then type a hex code or pick a color from the picker.",
  },
  {
    automated: true,
    automatedTestName:
      "places each library mark onto the garment when its tile is clicked",
    browser: false,
    builtInFitCheck: {
      capabilities: ["custom-interaction"],
      checkedBuiltIns: ["imagePicker", "actions"],
      closestBuiltIn: "imagePicker",
      productObservable:
        "Clicking a library tile adds that mark to the print area, including a second click on the tile that is already selected.",
      whyInsufficient:
        "ImagePicker commits a stored selection and treats a second click on the same tile as a no-op, so it cannot stamp another copy of the visible mark. The library must place a component on every tile click.",
    },
    componentType: libraryStampControlType,
    customControlCoverage: [
      "built-in-gap",
      "kit-primitives",
      "minimal-ui",
      "product-output",
      "runtime-state",
    ],
    evidence: "command-side-effect",
    expectedObservable:
      "Each library tile places that mark, drawn from its path data, centered on the garment's placement anchor.",
    fixture: "three official Infisical marks",
    id: "library.mark",
    interactionId: "component.place.library",
    kind: "control",
    optionCoverage: "each-visible-item",
    target: "library.mark",
    userAction: "Click each mark tile in the image library.",
  },
  {
    automated: true,
    automatedTestName: "places a text component into the print area",
    browser: false,
    componentType: "actions",
    evidence: "command-side-effect",
    expectedObservable:
      "Add text creates a layer and a text component record centered on the garment's placement anchor.",
    fixture: "empty design",
    id: "component.place",
    kind: "control",
    target: "component.place",
    userAction: "Press Add text.",
  },
  {
    automated: true,
    automatedTestName:
      "flattens selected text into an image component for effects",
    browser: false,
    componentType: "actions",
    evidence: "command-side-effect",
    expectedObservable:
      "Flatten converts the selected text layer into pixels that keep placement and can take Pixelate, Recolor, and ASCII.",
    fixture: "one selected text component",
    id: "component.flatten",
    interactionId: "component.flatten",
    kind: "control",
    target: "component.flatten",
    userAction: "Select text and press Flatten.",
  },
  {
    automated: true,
    automatedTestName: "adopts an imported image asset as a component record",
    browser: false,
    componentType: "fileDrop",
    evidence: "media-lifecycle",
    expectedObservable:
      "Each imported image becomes its own component, preserves its intrinsic aspect ratio, uses its own source pixels, and carries that layer's treatment.",
    fixture: "two imported PNGs with different dimensions and pixels",
    id: "media.sources",
    kind: "control",
    mediaLifecycleCoverage: ["upload", "remove", "reset"],
    target: "media.sources",
    userAction: "Import an image, then remove it and reset.",
  },
  {
    automated: true,
    automatedTestName:
      "removes only the edge-connected background from selected artwork",
    browser: false,
    componentType: "switch",
    evidence: "rendered-pixels",
    expectedObservable:
      "Remove background clears the selected imported image's flat outer backdrop while keeping enclosed artwork and other image layers unchanged.",
    fixture: "two imported images, one with a flat outer background",
    id: "selected.cutout",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    selectionScopeCoverage: "two-entity-isolation",
    target: "selectedLayer.cutout",
    userAction: "Select an imported image and turn on Cutout image.",
  },
  {
    automated: true,
    automatedTestName: "dithers selected artwork to ink or empty cells",
    browser: false,
    componentType: "segmented",
    evidence: "rendered-pixels",
    expectedObservable:
      "With Pixelate on, Bayer, F-S, and Random each render the selected image or mark as 1-bit ink or empty cells with no in-between tones, leaving other layers unchanged.",
    fixture: "two placed marks",
    id: "selected.effectDither",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    optionCoverage: "each-visible-item",
    selectionScopeCoverage: "two-entity-isolation",
    target: "selectedLayer.effectDither",
    userAction: "Select a mark, turn on Pixelate, and choose Bayer, F-S, then Random.",
  },
  {
    automated: true,
    automatedTestName:
      "resolves both treatments on the selected layer and gives embroidery room to thicken",
    browser: false,
    componentType: "segmented",
    evidence: "rendered-pixels",
    expectedObservable:
      "Print renders clean flat ink on the selected layer; Stitch thickens that layer and adds satin stitching with a border and relief, leaving other layers unchanged.",
    fixture: "two placed marks",
    id: "selected.treatment",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    optionCoverage: "each-visible-item",
    selectionScopeCoverage: "two-entity-isolation",
    target: "selectedLayer.treatment",
    userAction: "Select a component and choose Print, then Stitch.",
  },
  {
    automated: true,
    automatedTestName: "writes selected text through to its component record",
    browser: false,
    componentType: "text",
    evidence: "product-output",
    expectedObservable:
      "Editing the text field changes the words rendered on the garment for the selected component only.",
    fixture: "two text components",
    id: "selected.text",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    selectionScopeCoverage: "two-entity-isolation",
    target: "selectedLayer.text",
    userAction: "Select a text component and edit its text.",
  },
  {
    automated: true,
    automatedTestName: "applies each face to the selected component typography",
    browser: false,
    componentType: "select",
    evidence: "product-output",
    expectedObservable:
      "Alliance No.2, Inter, and JetBrains Mono each render the garment text in that face.",
    fixture: "two text components",
    id: "selected.face",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    optionCoverage: "each-visible-item",
    selectionScopeCoverage: "two-entity-isolation",
    target: "selectedLayer.face",
    userAction: "Select a text component and choose each face.",
  },
  {
    automated: true,
    automatedTestName: "applies type size to the selected component typography",
    browser: false,
    componentType: "slider",
    evidence: "product-output",
    expectedObservable:
      "Dragging Size changes the rendered type size of the selected component while it moves.",
    fixture: "two text components",
    id: "selected.size",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    selectionScopeCoverage: "two-entity-isolation",
    target: "selectedLayer.size",
    userAction: "Select a text component and drag Size.",
  },
  {
    automated: true,
    automatedTestName: "applies text case to the selected component typography",
    browser: false,
    componentType: "segmented",
    evidence: "product-output",
    expectedObservable:
      "Choosing AA renders the selected component's text in capitals.",
    fixture: "two text components",
    id: "selected.case",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    optionCoverage: "each-visible-item",
    selectionScopeCoverage: "two-entity-isolation",
    target: "selectedLayer.case",
    userAction: "Select a text component and choose Aa, then AA.",
  },
  {
    automated: true,
    automatedTestName: "converts tracking steps into em letter spacing",
    browser: false,
    componentType: "slider",
    evidence: "product-output",
    expectedObservable:
      "Dragging Tracking widens or tightens the rendered letter spacing of the selected component.",
    fixture: "two text components",
    id: "selected.tracking",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    selectionScopeCoverage: "two-entity-isolation",
    target: "selectedLayer.tracking",
    userAction: "Select a text component and drag Tracking.",
  },
  {
    automated: true,
    automatedTestName: "writes rotation through to its component record",
    browser: false,
    componentType: "slider",
    evidence: "product-output",
    expectedObservable:
      "Dragging Rotation turns the selected component on the garment while it moves.",
    fixture: "two placed marks",
    id: "selected.rotation",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    selectionScopeCoverage: "two-entity-isolation",
    target: "selectedLayer.rotation",
    userAction: "Select a component and drag Rotation.",
  },
  {
    automated: true,
    automatedTestName:
      "resolves every ink colorway, and a custom ink, for a placed component",
    browser: false,
    builtInFitCheck: {
      capabilities: ["custom-value-model", "custom-visualization"],
      checkedBuiltIns: ["imagePicker", "palette", "color", "segmented", "select"],
      closestBuiltIn: "imagePicker",
      productObservable:
        "Choosing a stock square recolors the selected component's artwork; choosing the custom square recolors it to the component's own custom hex, which stays visible inside that square.",
      whyInsufficient:
        "ImagePicker's value is membership in a fixed item list and cannot hand off to an arbitrary color, while the color control carries no curated ink list. One component's ink is a single value that is either a stock ink id or the custom id backed by that component's own hex, and the row shows the live hex so the active ink is readable without opening the picker.",
    },
    componentType: inkColorwayControlType,
    customControlCoverage: [
      "built-in-gap",
      "kit-primitives",
      "minimal-ui",
      "product-output",
      "runtime-state",
    ],
    evidence: "rendered-pixels",
    expectedObservable:
      "Each ink square recolors the selected component's artwork, and imported artwork keeps its own colors under Print.",
    fixture: "two placed marks",
    id: "selected.ink",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    optionCoverage: "each-visible-item",
    selectionScopeCoverage: "two-entity-isolation",
    target: "selectedLayer.ink",
    userAction: "Select a component and choose each ink square.",
  },
  {
    automated: true,
    automatedTestName: "gives each component its own custom ink hex",
    browser: false,
    componentType: "color",
    evidence: "rendered-pixels",
    expectedObservable:
      "Editing the custom ink recolors only the selected component's artwork; a second component keeps the ink it already had.",
    fixture: "two placed marks, one on a custom ink",
    id: "selected.inkColor",
    kind: "control",
    layerCoverage: "selected-layer-controls",
    selectionScopeCoverage: "two-entity-isolation",
    target: "selectedLayer.inkColor",
    userAction:
      "Select a component, choose the custom ink square, then type a hex code.",
  },
  {
    automated: true,
    automatedTestName: "keeps component order matching the layers panel",
    browser: false,
    componentType: "layers",
    evidence: "product-output",
    expectedObservable:
      "Reordering layers changes which component draws in front on the garment.",
    fixture: "two overlapping components",
    id: "layers.reorder",
    kind: "runtime",
    layerCoverage: "reorder",
    target: "design.components",
    userAction: "Drag one layer above another in the Layers panel.",
  },
  {
    automated: true,
    automatedTestName: "hides a component when its layer is hidden",
    browser: false,
    componentType: "layers",
    evidence: "product-output",
    expectedObservable:
      "Hiding a layer removes its component from the garment and from export.",
    fixture: "two components",
    id: "layers.visibility",
    kind: "runtime",
    layerCoverage: "visibility",
    target: "design.components",
    userAction: "Toggle a layer's visibility.",
  },
  {
    automated: true,
    automatedTestName: "moves a component with the canvas drag handle",
    browser: false,
    canvasHandle: {
      outputObservable:
        "The component follows the pointer, is masked to the garment silhouette, and stays on the artboard.",
      testId: "merch-handles",
      writesTarget: "design.components",
    },
    componentType: "canvas-handle",
    evidence: "product-output",
    expectedObservable:
      "Dragging a component moves it anywhere on the garment as one history entry, cut off at the garment edge rather than at a box.",
    fixture: "one placed mark",
    id: "handle.move",
    interactionId: "component.transform",
    kind: "canvas-handle",
    target: "design.components",
    userAction: "Drag a placed component across the garment.",
  },
  {
    automated: true,
    automatedTestName: "scales a component with the canvas resize handle",
    browser: false,
    canvasHandle: {
      outputObservable:
        "The component grows or shrinks about its own center.",
      testId: "merch-handles",
      writesTarget: "design.components",
    },
    componentType: "canvas-handle",
    evidence: "product-output",
    expectedObservable:
      "Dragging a corner scales the component, and scaling text changes its type size.",
    fixture: "one placed mark",
    id: "handle.resize",
    interactionId: "component.transform",
    kind: "canvas-handle",
    target: "design.components",
    userAction: "Drag a corner handle of a selected component.",
  },
  {
    automated: true,
    automatedTestName: "rotates a component with the canvas rotate handle",
    browser: false,
    canvasHandle: {
      outputObservable:
        "The component turns about its center and snaps to 15 degrees with Shift.",
      testId: "merch-handles",
      writesTarget: "design.components",
    },
    componentType: "canvas-handle",
    evidence: "product-output",
    expectedObservable:
      "Dragging the rotate handle turns the component as one history entry.",
    fixture: "one placed mark",
    id: "handle.rotate",
    interactionId: "component.transform",
    kind: "canvas-handle",
    target: "design.components",
    userAction: "Drag the rotate handle above a selected component.",
  },
  {
    automated: true,
    automatedTestName: "removes a component through the canvas delete node",
    browser: false,
    canvasHandle: {
      outputObservable:
        "The component leaves the garment and its layer leaves the panel.",
      testId: "merch-handles",
      writesTarget: "design.components",
    },
    componentType: "canvas-handle",
    evidence: "command-side-effect",
    expectedObservable:
      "Pressing the delete node removes the selected component, and undo brings it back with its properties.",
    fixture: "one placed mark",
    id: "handle.delete",
    interactionId: "component.delete",
    kind: "canvas-handle",
    target: "design.components",
    userAction:
      "Select a component and press the X that replaces the top-right resize knob.",
  },
  {
    automated: true,
    automatedTestName:
      "clears canvas selection chrome with Enter or an empty-canvas click",
    browser: false,
    canvasHandle: {
      outputObservable:
        "The selection frame and nodes leave the garment while the component stays in place.",
      testId: "merch-handles",
      writesTarget: "design.components",
    },
    componentType: "canvas-handle",
    evidence: "command-side-effect",
    expectedObservable:
      "Pressing Enter or clicking empty canvas hides the selection chrome without deleting the component.",
    fixture: "one selected mark",
    id: "handle.deselect",
    interactionId: "component.select",
    kind: "canvas-handle",
    target: "design.components",
    userAction:
      "Select a component, then press Enter or click empty canvas away from it.",
  },
  {
    automated: true,
    automatedTestName:
      "declares production reload coverage for the design schema",
    browser: {
      budget: "extended-io",
      file: "e2e/app-persistence.spec.ts",
      testName:
        "browser: app restores exact canvas, values, and panel workspace slices after reload",
    },
    componentType: "persistence",
    evidence: "persistence-state",
    expectedObservable:
      "Canvas size and zoom, their runtime values, and the moved and collapsed Controls workspace remain visibly restored after a real browser reload.",
    fixture: "persisted design workspace",
    id: "persistence.reload",
    kind: "runtime",
    persistenceCoverage: "reload",
    persistenceSlices,
    target: "canvas.size.width",
    userAction:
      "Edit Canvas width and zoom, move and collapse Controls, wait for persistence, and reload the page.",
  },
];

// Product entries use the same explicit stable section IDs as appSchema.
export const appControlSectionInventory: readonly ToolcraftControlSectionInventoryEntry[] =
  [
    {
      entity: "Garment",
      entityId: "garment",
      finiteSelectors: [
        {
          reason:
            "The garment type changes the artwork and print area it owns, not the visibility of other controls.",
          role: "parameter",
          target: "garment.type",
        },
        {
          reason:
            "The view changes which side of the same garment is drawn, and owns that outcome alone.",
          role: "parameter",
          target: "garment.view",
        },
        {
          reason:
            "The colorway tints the garment and affects nothing else in the panel.",
          role: "parameter",
          target: "garment.color",
        },
      ],
      groupingReason:
        "Garment type, view, colorway, and the custom dye describe the blank being printed, so they reset and read as one decision.",
      id: "garment",
      targets: [
        "garment.type",
        "garment.view",
        "garment.color",
        "garment.customColor",
      ],
      title: "Garment",
    },
    {
      entity: "Components",
      entityId: "components",
      finiteSelectors: [],
      groupingReason:
        "Choosing a library mark, adding text, and adding an image are the one task of getting components onto the garment.",
      id: "components",
      targets: ["library.mark", "media.sources", "component.place"],
      title: "Components",
    },
    {
      entity: "Selected component",
      entityId: "component",
      finiteSelectors: [
        {
          reason:
            "Background removal changes only the selected image's rendered pixels.",
          role: "parameter",
          target: "selectedLayer.cutout",
        },
        {
          reason:
            "The face changes the rendered typeface of the selected text and owns that outcome.",
          role: "parameter",
          target: "selectedLayer.face",
        },
        {
          reason:
            "Case changes the rendered capitalization of the selected text and owns that outcome.",
          role: "parameter",
          target: "selectedLayer.case",
        },
        {
          reason:
            "Ink recolors the selected component and owns that outcome.",
          role: "parameter",
          target: "selectedLayer.ink",
        },
        {
          reason:
            "Finish changes how the selected layer renders and owns that outcome.",
          role: "parameter",
          target: "selectedLayer.treatment",
        },
      ],
      groupingReason:
        "Every control here edits whichever component is selected, so they share one reset scope and disappear together when nothing is selected.",
      id: "component",
      targets: [
        "selectedLayer.cutout",
        "selectedLayer.text",
        "selectedLayer.face",
        "selectedLayer.size",
        "selectedLayer.case",
        "selectedLayer.tracking",
        "component.flatten",
        "selectedLayer.rotation",
        "selectedLayer.ink",
        "selectedLayer.inkColor",
        "selectedLayer.treatment",
      ],
      title: "Selected",
    },
    {
      entity: "Selected component effects",
      entityId: "componentEffects",
      finiteSelectors: [
        {
          affectedTargets: [],
          reason:
            "Pixelate reveals Bayer, F-S, and Random dither modes for the 1-bit kernel.",
          role: "branch",
          target: "selectedLayer.effectPixelate",
        },
        {
          reason:
            "Dither mode changes the 1-bit pattern and owns that outcome.",
          role: "parameter",
          target: "selectedLayer.effectDither",
        },
        {
          reason:
            "Recolor replaces the selected image's pixels with a duotone in the effect ink and owns that outcome.",
          role: "parameter",
          target: "selectedLayer.effectRecolor",
        },
        {
          reason:
            "ASCII replaces the selected image's pixels with monospace glyphs and owns that outcome.",
          role: "parameter",
          target: "selectedLayer.effectAscii",
        },
        {
          reason:
            "The effect ink recolors Recolor and ASCII output and owns that outcome.",
          role: "parameter",
          target: "selectedLayer.effectInk",
        },
      ],
      groupingReason:
        "Pixelate, Recolor, and ASCII each replace the selected image or library mark's pixels before it is treated and can combine freely, so they share one reset scope separate from finish and cutout.",
      id: "effects",
      targets: [
        "selectedLayer.effectPixelate",
        "selectedLayer.effectDither",
        "selectedLayer.effectRecolor",
        "selectedLayer.effectAscii",
        "selectedLayer.effectInk",
        "selectedLayer.effectInkColor",
        "selectedLayer.effectAmount",
        "selectedLayer.effectCharset",
      ],
      title: "Effects",
    },
  ];
