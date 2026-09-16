/**
 * Garment art loading shared by the live preview and the PNG export.
 *
 * Decoded images are cached by URL and kept outside React state, so panning,
 * dragging, or re-rendering never re-decodes the garment art. These URLs are
 * static files; imported artwork lives in `imported-images.ts`, keyed by
 * content rather than URL.
 */

import * as React from "react";

const imagesByUrl = new Map<string, ImageBitmap>();
const pendingByUrl = new Map<string, Promise<void>>();

/**
 * Bumped whenever a decode lands. Hooks subscribe to it instead of relying on
 * their own effect still being active when the decode resolves, which missed
 * decodes that finished while the URL set was changing.
 */
let cacheVersion = 0;
const cacheListeners = new Set<() => void>();

function notifyCacheChanged(): void {
  cacheVersion += 1;
  for (const listener of cacheListeners) listener();
}

function subscribeCache(listener: () => void): () => void {
  cacheListeners.add(listener);
  return () => cacheListeners.delete(listener);
}

function useCacheVersion(): number {
  return React.useSyncExternalStore(
    subscribeCache,
    () => cacheVersion,
    () => cacheVersion,
  );
}

export function getLoadedImage(url: string): ImageBitmap | undefined {
  return imagesByUrl.get(url);
}

/**
 * Decoding goes through `createImageBitmap`, so no DOM image element is
 * constructed and the result drops straight into an offscreen canvas.
 *
 * The decoded bitmap stays in the cache rather than travelling back through the
 * promise, and callers read it with `getLoadedImage`.
 */
export function loadImage(url: string): Promise<void> {
  if (imagesByUrl.has(url)) {
    return Promise.resolve();
  }

  const pending = pendingByUrl.get(url);

  if (pending) {
    return pending;
  }

  const request = (async () => {
    try {
      const response = await fetch(url);

      if (response.ok) {
        imagesByUrl.set(url, await createImageBitmap(await response.blob(), {
          imageOrientation: "from-image",
        }));
        notifyCacheChanged();
      }
    } catch {
      // A source that cannot be decoded simply stays absent from the cache.
    } finally {
      pendingByUrl.delete(url);
    }
  })();

  pendingByUrl.set(url, request);

  return request;
}

/** Loads a set of URLs, re-rendering the caller as each one becomes available. */
export function useImages(
  urls: readonly string[],
): ReadonlyMap<string, CanvasImageSource> {
  const key = urls.join("|");
  const version = useCacheVersion();

  React.useEffect(() => {
    for (const url of urls) {
      if (!imagesByUrl.has(url)) {
        void loadImage(url);
      }
    }
    // `key` is the stable identity of this URL set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return React.useMemo(() => {
    const resolved = new Map<string, CanvasImageSource>();

    for (const url of urls) {
      const image = imagesByUrl.get(url);

      if (image) {
        resolved.set(url, image);
      }
    }

    return resolved;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);
}
