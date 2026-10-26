import { describe, expect, it } from 'vitest'
import { calculateOrderTotals } from '../src/domain/pricing.js'
import { stableStringify } from '../src/utils/stableStringify.js'

const items = [
  {
    id: 'riwaq-esp-01',
    quantity: 1,
    unitPriceMinor: 129900,
  },
]

describe('server pricing', () => {
  it('calculates the demo VAT total in minor units', () => {
    const totals = calculateOrderTotals({
      items,
      discountAmountMinor: 10000,
      taxRate: 0.15,
      shippingMinor: 0,
      currency: 'SAR',
    })

    expect(totals).toMatchObject({
      currency: 'SAR',
      quantity: 1,
      subtotalMinor: 129900,
      discountMinor: 10000,
      taxableBaseMinor: 119900,
      taxMinor: 17985,
      shippingMinor: 0,
      totalMinor: 137885,
    })
    expect(totals.items[0].lineTotalMinor).toBe(129900)
  })

  it('caps a discount at the subtotal and rounds VAT', () => {
    const totals = calculateOrderTotals({
      items: [
        { id: 'sample', quantity: 3, unitPriceMinor: 333 },
        { id: 'second', quantity: 1, unitPriceMinor: 100 },
      ],
      discountAmountMinor: 99999,
      taxRate: 0.15,
      shippingMinor: 0,
      currency: 'SAR',
    })

    expect(totals.subtotalMinor).toBe(1099)
    expect(totals.discountMinor).toBe(1099)
    expect(totals.taxableBaseMinor).toBe(0)
    expect(totals.totalMinor).toBe(0)
  })

  it('rejects invalid quantities, prices and tax rates', () => {
    expect(() =>
      calculateOrderTotals({
        items: [{ id: 'x', quantity: 0, unitPriceMinor: 1 }],
        taxRate: 0.15,
        currency: 'SAR',
      }),
    ).toThrow(/quantities/)

    expect(() =>
      calculateOrderTotals({
        items: [{ id: 'x', quantity: 1, unitPriceMinor: -1 }],
        taxRate: 0.15,
        currency: 'SAR',
      }),
    ).toThrow(/prices/)

    expect(() =>
      calculateOrderTotals({
        items,
        taxRate: 1.5,
        currency: 'SAR',
      }),
    ).toThrow(/Tax rate/)
  })

  it('hashes logically identical JSON in a stable order', () => {
    expect(stableStringify({ b: 2, a: 1 })).toBe(
      stableStringify({ a: 1, b: 2 }),
    )
    expect(stableStringify({ a: undefined, b: 2 })).toBe('{"b":2}')
  })
})
