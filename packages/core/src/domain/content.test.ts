import { describe, expect, it } from 'vitest';
import { mapAffiliateDraftToContentFields } from '../domain/content.js';

describe('mapAffiliateDraftToContentFields', () => {
  it('packs hook into title and structured copy into body', () => {
    const result = mapAffiliateDraftToContentFields({
      hook: 'Opening hook',
      script: 'Main script',
      caption: 'Post caption',
      cta: 'Shop: https://shope.ee/x',
      hashtags: ['deal', 'sale'],
      videoScenePlan: 'Scene 1: unbox',
    });

    expect(result.title).toBe('Opening hook');
    expect(result.body).toContain('Main script');
    expect(result.body).toContain('https://shope.ee/x');
    expect(result.body).toContain('deal sale');
    expect(result.body).toContain('Scene 1: unbox');
  });
});
