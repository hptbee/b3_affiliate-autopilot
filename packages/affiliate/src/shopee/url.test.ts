import { describe, expect, it } from 'vitest';
import { parseShopeeItemId } from './url.js';

describe('parseShopeeItemId', () => {
  it('parses i.shopId.itemId URLs', () => {
    expect(
      parseShopeeItemId(
        'https://shopee.vn/Apple-Iphone-11-128GB-Local-Set-i.52377417.6309028319',
      ),
    ).toBe('6309028319');
  });

  it('parses /product/shopId/itemId URLs', () => {
    expect(parseShopeeItemId('https://shopee.vn/product/68475578/27971600849')).toBe('27971600849');
  });

  it('returns null for short links and junk', () => {
    expect(parseShopeeItemId('https://shope.ee/abc')).toBeNull();
    expect(parseShopeeItemId('not a url')).toBeNull();
  });
});
