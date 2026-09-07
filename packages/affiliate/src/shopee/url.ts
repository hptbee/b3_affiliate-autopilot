/** Parse Shopee VN product URLs. Short links (s.shopee.vn / shope.ee) are not resolved. */
export function parseShopeeItemId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const itemMatch = parsed.pathname.match(/-i\.(\d+)\.(\d+)/i);
    if (itemMatch?.[2]) return itemMatch[2];
    const productMatch = parsed.pathname.match(/\/product\/(\d+)\/(\d+)/i);
    if (productMatch?.[2]) return productMatch[2];
    return null;
  } catch {
    return null;
  }
}
