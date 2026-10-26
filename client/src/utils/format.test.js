import { describe, expect, it } from 'vitest'
import { formatCurrency, formatDateTime } from './format.js'

describe('format helpers', () => {
  it('formats minor units as SAR', () => {
    expect(formatCurrency(137885)).toMatch(/SAR\s1,378\.85/)
  })

  it('formats timestamps in Riyadh time', () => {
    const formatted = formatDateTime('2026-10-25T08:30:00.000Z')

    expect(formatted).toContain('2026')
    expect(formatted.length).toBeGreaterThan(10)
  })

  it('returns a safe fallback for invalid dates', () => {
    expect(formatDateTime('not-a-date')).toBe('Unknown')
  })
})
