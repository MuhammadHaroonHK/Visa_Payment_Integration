/**
 * Formats an amount held in minor units (e.g. halalas for SAR).
 * The demo uses SAR only; Checkout.com also expects amounts in minor units.
 */
export function formatCurrency(amountMinor, currency = 'SAR', locale = 'en-SA') {
  const amount = Number(amountMinor) / 100

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDateTime(value, locale = 'en-SA') {
  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Unknown'
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Riyadh',
  }).format(date)
}

export function formatQuantity(quantity) {
  return new Intl.NumberFormat('en-SA').format(quantity)
}
