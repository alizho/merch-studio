/**
 * Custom control type for the image library stamp grid.
 *
 * Kept apart from the renderer so the schema can name the type without pulling
 * the panel's React tree into the schema module.
 */

import { defineToolcraftCustomControlType } from "@/toolcraft/runtime";

export const libraryStampControlType =
  defineToolcraftCustomControlType("libraryStamp");
