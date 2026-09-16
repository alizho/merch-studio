/**
 * Image loading shared by the live preview and the PNG export.
 *
 * Decoded images are cached by URL and kept outside React state, so panning,
 * dragging, or re-rendering never re-decodes the garment art. The media
 * registry lets the export path reach imported artwork that the preview has
 * already decoded, without repeating the runtime's resource resolution.
 */

import * as React from "react";

const imagesByUrl = new Map<string, ImageBitmap>();
const pendingByUrl = new Map<string, Promise<void>>();
const mediaImagesById = new Map<string, ImageBitmap>();

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
        imagesByUrl.set(url, await createImageBitmap(await response.blob()));
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
  const [, setRevision] = React.useState(0);

  React.useEffect(() => {
    let active = true;

    for (const url of urls) {
      if (imagesByUrl.has(url)) {
        continue;
      }

      void loadImage(url).then(() => {
        if (active) {
          setRevision((revision) => revision + 1);
        }
      });
    }

    return () => {
      active = false;
    };
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
  }, [key, imagesByUrl.size]);
}

export function registerMediaImage(mediaId: string, image: ImageBitmap): void {
  mediaImagesById.set(mediaId, image);
}

export function forgetMediaImage(mediaId: string): void {
  mediaImagesById.delete(mediaId);
}

export function getMediaImages(): ReadonlyMap<string, CanvasImageSource> {
  return mediaImagesById;
}

/**
 * Loads imported artwork by runtime media id, keeping the registry the export
 * path reads from in sync with whatever the preview currently shows.
 */
export function useMediaImages(
  sources: ReadonlyMap<string, string>,
): ReadonlyMap<string, CanvasImageSource> {
  const key = [...sources.entries()].map(([id, url]) => `${id}:${url}`).join("|");
  const [, setRevision] = React.useState(0);

  React.useEffect(() => {
    let active = true;

    for (const [mediaId, url] of sources) {
      const loaded = imagesByUrl.get(url);

      if (loaded) {
        registerMediaImage(mediaId, loaded);
        continue;
      }

      void loadImage(url).then(() => {
        const decoded = imagesByUrl.get(url);

        if (!active || !decoded) {
          return;
        }

        registerMediaImage(mediaId, decoded);
        setRevision((revision) => revision + 1);
      });
    }

    for (const mediaId of [...mediaImagesById.keys()]) {
      if (!sources.has(mediaId)) {
        forgetMediaImage(mediaId);
      }
    }

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return React.useMemo(() => {
    const resolved = new Map<string, CanvasImageSource>();

    for (const [mediaId, url] of sources) {
      const image = imagesByUrl.get(url);

      if (image) {
        resolved.set(mediaId, image);
      }
    }

    return resolved;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, imagesByUrl.size]);
}
