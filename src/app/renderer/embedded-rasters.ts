/**
 * Flattened type pixels, keyed by the PNG data URL stored on the component.
 *
 * Imports go through runtime media; flattened type stays on the record so it
 * does not allocate a second layer. Decode is cached the same way imported
 * images are, so preview and export share one bitmap.
 */

import * as React from "react";

import type { ImportedImage } from "./imported-images";

const rasters = new Map<string, ImportedImage>();
const pending = new Map<string, Promise<void>>();
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

export function rememberEmbeddedRaster(
  dataUrl: string,
  image: CanvasImageSource,
  width: number,
  height: number,
): ImportedImage {
  const raster: ImportedImage = {
    height,
    image,
    resourceRef: dataUrl,
    width,
  };

  rasters.set(dataUrl, raster);
  notify();

  return raster;
}

export function getEmbeddedRaster(dataUrl: string): ImportedImage | undefined {
  return rasters.get(dataUrl);
}

function decodeEmbeddedRaster(dataUrl: string): void {
  if (rasters.has(dataUrl) || pending.has(dataUrl)) {
    return;
  }

  const request = (async () => {
    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);
      rememberEmbeddedRaster(dataUrl, bitmap, bitmap.width, bitmap.height);
    } catch {
      pending.delete(dataUrl);
      notify();
    } finally {
      pending.delete(dataUrl);
    }
  })();

  pending.set(dataUrl, request);
}

export async function ensureEmbeddedRasters(
  dataUrls: readonly string[],
): Promise<void> {
  for (const dataUrl of dataUrls) {
    decodeEmbeddedRaster(dataUrl);
  }

  await Promise.all(
    dataUrls.map((dataUrl) => pending.get(dataUrl) ?? Promise.resolve()),
  );
}

export function collectRasterDataUrls(
  components: Readonly<Record<string, { rasterDataUrl?: string }>>,
): string[] {
  const urls: string[] = [];

  for (const record of Object.values(components)) {
    if (record.rasterDataUrl && !urls.includes(record.rasterDataUrl)) {
      urls.push(record.rasterDataUrl);
    }
  }

  return urls;
}

/** Decodes flattened-type rasters and re-renders as each one lands. */
export function useEmbeddedRasters(dataUrls: readonly string[]): number {
  const version = React.useSyncExternalStore(subscribe, getVersion, getVersion);

  React.useEffect(() => {
    for (const dataUrl of dataUrls) {
      decodeEmbeddedRaster(dataUrl);
    }
  }, [dataUrls, version]);

  return version;
}
