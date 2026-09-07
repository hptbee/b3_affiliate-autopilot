import { describe, expect, it } from 'vitest';
import { mapShopeeError } from './errors.js';

describe('mapShopeeError', () => {
  it('maps invalid signature to authentication', () => {
    expect(mapShopeeError(10020, 'Invalid Signature').kind).toBe('authentication');
    expect(mapShopeeError(10035, 'No API access').kind).toBe('authentication');
  });

  it('maps rate limit', () => {
    const error = mapShopeeError(10030, 'Rate limit exceeded');
    expect(error.kind).toBe('rate_limit');
    expect(error.statusCode).toBe(429);
  });

  it('maps invalid params', () => {
    expect(mapShopeeError(11001, 'Params Error').kind).toBe('invalid');
  });

  it('maps unknown codes', () => {
    expect(mapShopeeError(99999, '???').kind).toBe('unknown');
  });
});
