/**
 * Custom control type registrations for the colorway swatch rows.
 *
 * Kept apart from the renderer so the schema can name a control type without
 * pulling the panel's React tree into the schema module.
 */

import { defineToolcraftCustomControlType } from "@/toolcraft/runtime";

export const garmentColorwayControlType =
  defineToolcraftCustomControlType("garmentColorway");

export const inkColorwayControlType =
  defineToolcraftCustomControlType("inkColorway");
