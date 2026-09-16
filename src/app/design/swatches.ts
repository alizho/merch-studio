/**
 * Mark tiles for the library picker.
 *
 * Tiles are inline SVG data URIs rather than image files, so the preview is
 * generated from the same path data the canvas draws and cannot drift from it.
 * Corners stay sharp, per the brand's shape rule.
 */

import { MARKS } from "../library/marks";

function dataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export type PickerItem = {
  alt: string;
  src: string;
  value: string;
};

/** Mark tiles preview on a dark ground, since the marks ship as black art. */
export const MARK_ITEMS: readonly PickerItem[] = MARKS.map((mark) => {
  const pad = 8;
  const scale = Math.min(
    (64 - pad * 2) / mark.width,
    (64 - pad * 2) / mark.height,
  );
  const width = mark.width * scale;
  const height = mark.height * scale;

  return {
    alt: mark.label,
    src: dataUri(
      `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">` +
        `<rect width="64" height="64" fill="#171717"/>` +
        `<g transform="translate(${(64 - width) / 2} ${(64 - height) / 2}) scale(${scale})">` +
        `<path d="${mark.d}" fill="#F7FE62"/></g></svg>`,
    ),
    value: mark.id,
  };
});
