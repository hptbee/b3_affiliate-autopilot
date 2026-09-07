import { describe, expect, it } from 'vitest';
import { buildSvgCover, svgToArrayBuffer } from './svg-cover.js';

describe('buildSvgCover', () => {
  it('renders escaped headline and subtitle', () => {
    const svg = buildSvgCover({
      headline: 'Deal & Save',
      subtitle: 'Best earbuds <2026>',
      backgroundColor: '#111111',
      textColor: '#FFFFFF',
    });
    expect(svg).toContain('Deal &amp; Save');
    expect(svg).toContain('Best earbuds &lt;2026&gt;');
    expect(svg).toContain('fill="#111111"');
    expect(svg.startsWith('<?xml')).toBe(true);
  });

  it('produces a non-empty array buffer', () => {
    const buffer = svgToArrayBuffer(
      buildSvgCover({
        headline: 'Hook',
        subtitle: 'Caption',
        backgroundColor: '#000000',
        textColor: '#FFFFFF',
      }),
    );
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});
