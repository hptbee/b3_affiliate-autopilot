import { describe, expect, it } from 'vitest';
import {
  assertContentContainsAffiliateUrl,
  contentContainsAffiliateUrl,
  ensureAffiliateUrlInFields,
} from '../domain/affiliate-link-validation.js';
import { ConflictError } from '../types/errors.js';

describe('affiliate link validation', () => {
  it('detects affiliate URL in title or body', () => {
    expect(
      contentContainsAffiliateUrl('Buy now', 'Check https://shope.ee/abc', 'https://shope.ee/abc'),
    ).toBe(true);
    expect(contentContainsAffiliateUrl('No link here', 'Body only', 'https://shope.ee/abc')).toBe(
      false,
    );
  });

  it('appends affiliate URL when missing from generated fields', () => {
    const result = ensureAffiliateUrlInFields(
      { title: 'Hook', body: 'Caption without link' },
      'https://shope.ee/abc',
    );
    expect(result.body).toContain('https://shope.ee/abc');
  });

  it('throws when asserting missing affiliate URL', () => {
    expect(() =>
      assertContentContainsAffiliateUrl(
        { title: 'Hook', body: 'No link' },
        'https://shope.ee/abc',
      ),
    ).toThrow(ConflictError);
  });
});
