import type { Content } from '../domain/content.js';
import { ConflictError } from '../types/errors.js';

export function contentContainsAffiliateUrl(
  title: string,
  body: string,
  affiliateUrl: string,
): boolean {
  const needle = affiliateUrl.trim().toLowerCase();
  if (!needle) return false;
  const haystack = `${title}\n${body}`.toLowerCase();
  return haystack.includes(needle);
}

export function assertContentContainsAffiliateUrl(
  content: Pick<Content, 'title' | 'body'>,
  affiliateUrl: string,
): void {
  if (!contentContainsAffiliateUrl(content.title, content.body, affiliateUrl)) {
    throw new ConflictError(
      'Content must include the expected affiliate URL before it can be approved or published',
      { affiliateUrl },
    );
  }
}

export function ensureAffiliateUrlInFields(
  fields: { title: string; body: string },
  affiliateUrl: string,
): { title: string; body: string } {
  if (contentContainsAffiliateUrl(fields.title, fields.body, affiliateUrl)) {
    return fields;
  }
  return {
    title: fields.title,
    body: `${fields.body.trim()}\n\n${affiliateUrl.trim()}`.trim(),
  };
}
