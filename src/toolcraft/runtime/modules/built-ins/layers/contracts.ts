import type { ToolcraftLayer, ToolcraftLayerDraft, ToolcraftMediaAsset } from "../../../state/types";

export type ToolcraftLayerEdit = {
  layers: ToolcraftLayer[];
  mediaAssets: ToolcraftMediaAsset[];
  selectedLayerIds: string[];
  values: Record<string, unknown>;
  label: string;
};

export type ToolcraftLayersCommand =
  | ({ type: "layers.applyEdit" } & ToolcraftLayerEdit)
  | { insertIndex?: number; layer?: ToolcraftLayerDraft; type: "layers.add" }
  | { layerId: string; type: "layers.delete" }
  | {
      layerIds: string[];
      parentGroupId: string | null;
      type: "layers.moveToGroup";
    }
  | { layerId: string | null; additive?: boolean; type: "layers.select" }
  | { layerId: string; name: string; type: "layers.rename" }
  | { layerId: string; type: "layers.toggleCollapsed" }
  | { layerId: string; type: "layers.toggleVisibility" }
  | {
      layers: ToolcraftLayer[];
      selectedLayerId?: string | null;
      type: "layers.reorder";
    };
