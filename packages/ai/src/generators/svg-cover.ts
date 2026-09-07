import type { CoverImageSpec } from '../prompts/cover-image.js';

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function buildSvgCover(spec: CoverImageSpec): string {
  const headline = escapeXml(spec.headline);
  const subtitle = escapeXml(spec.subtitle);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080" role="img">
  <rect width="1080" height="1080" fill="${spec.backgroundColor}" />
  <text x="80" y="420" fill="${spec.textColor}" font-family="Arial, Helvetica, sans-serif" font-size="64" font-weight="700">${headline}</text>
  <text x="80" y="520" fill="${spec.textColor}" font-family="Arial, Helvetica, sans-serif" font-size="36">${subtitle}</text>
</svg>`;
}

export function svgToArrayBuffer(svg: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(svg);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
