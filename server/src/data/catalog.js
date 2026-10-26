export const CURRENCY = 'SAR'
export const LOCALE = 'en-SA'
export const COUNTRY = 'SA'
export const VAT_RATE = 0.15
export const SHIPPING_MINOR = 0
export const SHIPPING_LABEL = 'Delivery'
export const SHIPPING_DETAIL = 'Standard · 2–4 business days'
export const TAX_LABEL = 'VAT (15%)'

export const products = Object.freeze([
  Object.freeze({
    id: 'riwaq-esp-01',
    reference: 'RIWAQ-ESP-01',
    name: 'Riwāq Home Espresso Machine',
    description: 'Brushed steel · 1.2 L · Saudi plug',
    unitPriceMinor: 129900,
    currency: CURRENCY,
  }),
])

export const productsById = new Map(
  products.map((product) => [product.id, product]),
)

export const promotions = Object.freeze([
  Object.freeze({
    code: 'WELCOME100',
    label: 'Welcome offer',
    amountMinor: 10000,
    minimumSubtotalMinor: 100000,
  }),
])

export const promotionsByCode = new Map(
  promotions.map((promotion) => [promotion.code, promotion]),
)
