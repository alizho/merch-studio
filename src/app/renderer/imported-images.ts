"use client";

/**
 * Decoded imported artwork, shared by the live preview and the PNG export.
 *
 * Everything is keyed by the asset's content-addressed `resourceRef`, never by
 * media id or presentation URL. The runtime recycles media ids after deletes
 * and can briefly keep an old blob URL under a recycled id, so either key can
 * resolve to a previously uploaded image. Downloaded bytes are also checked
 * against the sha256 in the ref before they are trusted.
 *
 * SVG cannot go through `createImageBitmap`, so it is rasterized separately
 * (see `svg-raster.ts`).
 *
 * Rotation and flips from the uploader's transform actions are baked into an
 * oriented copy, so downstream drawing, sizing, and background removal all see
 * the image the way the user does.
 */

import * as React from "react";
import type {
  ToolcraftImageAsset,
  ToolcraftMediaAsset,
} from "@/toolcraft/runtime";
import { useToolcraftMediaPresentationUrls } from "@/toolcraft/runtime/react";

import {
  isImageAsset,
  normalizeRotation,
  orientSize,
  type DecodedImageSize,
} from "../state/image-components";
import { decodeSvg, isSvgType } from "./svg-raster";

export type ImportedImage = DecodedImageSize &
  Readonly<{ image: CanvasImageSource }>;

const SHA256_REF = /^media:image:sha256:([0-9a-f]{64})$/;

const decodedByRef = new Map<string, ImageBitmap>();
const pendingByRef = new Map<string, Promise<void>>();
/** `ref + url` pairs that failed, so a dead or mismatched URL is not refetched. */
const rejectedSources = new Set<string>();
const orientedByKey = new Map<string, ImportedImage>();

let storeVersion = 0;
const listeners = new Set<() => void>();

function notify(): void {
  storeVersion += 1;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getVersion(): number {
  return storeVersion;
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;

  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));

  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function loadImportedImage(
  resourceRef: string,
  url: string,
  mimeType: string,
): void {
  const sourceKey = `${resourceRef}\n${url}`;

  if (
    decodedByRef.has(resourceRef) ||
    pendingByRef.has(resourceRef) ||
    rejectedSources.has(sourceKey)
  ) {
    return;
  }

  const request = (async () => {
    try {
      const response = await fetch(url);

      if (!response.ok) throw new Error(`Could not fetch ${resourceRef}`);

      const blob = await response.blob();
      const expected = SHA256_REF.exec(resourceRef)?.[1];

      if (expected) {
        const actual = await sha256Hex(await blob.arrayBuffer());

        if (actual !== null && actual !== expected) {
          throw new Error(`Stale presentation URL for ${resourceRef}`);
        }
      }

      decodedByRef.set(
        resourceRef,
        isSvgType(blob.type) || isSvgType(mimeType)
          ? await decodeSvg(blob)
          : await createImageBitmap(blob, { imageOrientation: "from-image" }),
      );
    } catch {
      rejectedSources.add(sourceKey);
    } finally {
      pendingByRef.delete(resourceRef);
      // Also on failure, so the loader retries once the runtime publishes the
      // asset's current URL.
      notify();
    }
  })();

  pendingByRef.set(resourceRef, request);
}

function createOrientedSurface(
  width: number,
  height: number,
): {
  canvas: CanvasImageSource;
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
} {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);

    return { canvas, ctx: canvas.getContext("2d") };
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  return { canvas, ctx: canvas.getContext("2d") };
}

/** The asset's decoded pixels with its rotate/flip transform applied. */
function getOrientedImage(asset: ToolcraftImageAsset): ImportedImage | undefined {
  const bitmap = decodedByRef.get(asset.resourceRef);

  if (!bitmap) return undefined;

  const rotation = normalizeRotation(asset.transform?.rotationDeg);
  const flipX = asset.transform?.flipHorizontal === true;
  const flipY = asset.transform?.flipVertical === true;
  const key = `${asset.resourceRef}|${rotation}|${flipX ? 1 : 0}|${flipY ? 1 : 0}`;
  const cached = orientedByKey.get(key);

  if (cached) return cached;

  const size = orientSize(bitmap, asset.transform);
  let image: CanvasImageSource = bitmap;

  if (rotation !== 0 || flipX || flipY) {
    const surface = createOrientedSurface(size.width, size.height);

    if (!surface.ctx) return undefined;

    // Same order as the runtime's uploader preview: flip in image space, then
    // rotate about the center.
    surface.ctx.translate(size.width / 2, size.height / 2);
    surface.ctx.rotate((rotation * Math.PI) / 180);
    surface.ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    surface.ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
    image = surface.canvas;
  }

  const oriented: ImportedImage = {
    height: size.height,
    image,
    resourceRef: asset.resourceRef,
    width: size.width,
  };

  orientedByKey.set(key, oriented);

  return oriented;
}

/** Resolves whatever is decoded for these assets, keyed by media id. */
export function resolveImportedImages(
  mediaAssets: readonly ToolcraftMediaAsset[],
): ReadonlyMap<string, ImportedImage> {
  const resolved = new Map<string, ImportedImage>();

  for (const asset of mediaAssets) {
    if (!isImageAsset(asset)) continue;

    const oriented = getOrientedImage(asset);

    if (oriented) resolved.set(asset.id, oriented);
  }

  return resolved;
}

/** Drops pixels no current asset uses; undo re-decodes them if they return. */
function pruneImportedImages(assets: readonly ToolcraftImageAsset[]): void {
  const liveRefs = new Set(assets.map((asset) => asset.resourceRef));

  for (const ref of decodedByRef.keys()) {
    if (!liveRefs.has(ref)) decodedByRef.delete(ref);
  }

  for (const [key, oriented] of orientedByKey) {
    if (!liveRefs.has(oriented.resourceRef)) orientedByKey.delete(key);
  }
}

/**
 * Decodes the image assets' current presentation URLs and returns their
 * oriented pixels by media id, re-rendering as each decode lands.
 */
export function useImportedImages(
  mediaAssets: readonly ToolcraftMediaAsset[],
): ReadonlyMap<string, ImportedImage> {
  const imageAssets = React.useMemo(
    () => mediaAssets.filter(isImageAsset),
    [mediaAssets],
  );
  const urls = useToolcraftMediaPresentationUrls(imageAssets);
  const version = React.useSyncExternalStore(subscribe, getVersion, getVersion);

  React.useEffect(() => {
    for (const asset of imageAssets) {
      const url = urls.get(asset.id);

      if (url) loadImportedImage(asset.resourceRef, url, asset.mimeType);
    }
  }, [imageAssets, urls, version]);

  React.useEffect(() => {
    pruneImportedImages(imageAssets);
  }, [imageAssets]);

  return React.useMemo(
    () => resolveImportedImages(imageAssets),
    // `version` stands in for the decoded store this reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [imageAssets, version],
  );
}
