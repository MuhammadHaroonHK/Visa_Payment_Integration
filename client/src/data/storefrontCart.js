/**
 * The storefront has a fixed cart in this demo. The server owns the catalogue,
 * prices, promotion, VAT and final total; the browser sends only these
 * identifiers and quantities.
 */
export const storefrontCart = Object.freeze({
  items: [{ productId: 'riwaq-esp-01', quantity: 1 }],
  promotionCode: 'WELCOME100',
  locale: 'en-SA',
  currency: 'SAR',
})
