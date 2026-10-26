import { describe, expect, it } from 'vitest'
import {
  getAvailability,
  isMethodActionable,
  paymentMethods,
} from './paymentMethods.js'

describe('payment method configuration', () => {
  it('exposes the available and unavailable states', () => {
    expect(getAvailability({ availability: 'available' }).canProceed).toBe(
      true,
    )
    expect(getAvailability({ availability: 'unavailable' }).canProceed).toBe(
      false,
    )
  })

  it('falls back to unavailable for unknown configuration', () => {
    expect(getAvailability({ availability: 'mystery' }).key).toBe(
      'unavailable',
    )
    expect(isMethodActionable({ availability: 'mystery' })).toBe(false)
  })

  it('lists Cards and Apple Pay exactly once', () => {
    expect(paymentMethods.map((method) => method.name)).toEqual([
      'Cards',
      'Apple Pay',
    ])
    expect(paymentMethods.map((method) => method.id)).toEqual([
      'card',
      'apple_pay',
    ])
  })

  it('uses the card and applepay Flow components', () => {
    expect(
      Object.fromEntries(
        paymentMethods.map((method) => [
          method.id,
          method.flowComponent,
        ]),
      ),
    ).toEqual({
      card: 'card',
      apple_pay: 'applepay',
    })
  })

  it('does not let a disabled method proceed', () => {
    expect(
      isMethodActionable({ availability: 'available', selectable: false }),
    ).toBe(false)
  })
})
