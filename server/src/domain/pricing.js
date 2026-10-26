/**
 * Pure server-side pricing. The browser never supplies prices, discounts, tax
 * or totals to the payment-session endpoint.
 */
export function calculateOrderTotals({
  items,
  discountAmountMinor = 0,
  taxRate,
  shippingMinor = 0,
  currency,
}) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('An order must contain at least one item.')
  }

  const pricedItems = items.map((item) => {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new Error('Item quantities must be positive integers.')
    }

    if (
      !Number.isInteger(item.unitPriceMinor) ||
      item.unitPriceMinor < 0
    ) {
      throw new Error(
        'Item prices must be non-negative integers in minor units.',
      )
    }

    return {
      ...item,
      lineTotalMinor: item.unitPriceMinor * item.quantity,
    }
  })

  const quantity = pricedItems.reduce(
    (total, item) => total + item.quantity,
    0,
  )
  const subtotalMinor = pricedItems.reduce(
    (total, item) => total + item.lineTotalMinor,
    0,
  )

  if (
    !Number.isInteger(discountAmountMinor) ||
    discountAmountMinor < 0
  ) {
    throw new Error('Discount must be a non-negative integer in minor units.')
  }

  const discountMinor = Math.min(discountAmountMinor, subtotalMinor)
  const taxableBaseMinor = subtotalMinor - discountMinor

  if (typeof taxRate !== 'number' || taxRate < 0 || taxRate > 1) {
    throw new Error('Tax rate must be between 0 and 1.')
  }

  if (!Number.isInteger(shippingMinor) || shippingMinor < 0) {
    throw new Error('Shipping must be a non-negative integer in minor units.')
  }

  const taxMinor = Math.round(taxableBaseMinor * taxRate)

  return {
    currency,
    quantity,
    subtotalMinor,
    discountMinor,
    taxableBaseMinor,
    taxMinor,
    taxRate,
    shippingMinor,
    totalMinor: taxableBaseMinor + taxMinor + shippingMinor,
    items: pricedItems,
  }
}
