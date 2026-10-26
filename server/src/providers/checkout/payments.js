import { ApiError } from '../../domain/errors.js'

const STATUS_MAP = Object.freeze({
  Pending: 'PENDING',
  Authorized: 'AUTHORIZED',
  'Card Verified': 'AUTHORIZED',
  Captured: 'CAPTURED',
  Paid: 'SUCCEEDED',
  Declined: 'FAILED',
  Canceled: 'CANCELLED',
  Expired: 'EXPIRED',
  Voided: 'CANCELLED',
  Refunded: 'REFUNDED',
  'Partially Refunded': 'REFUNDED',
})

const SUCCESS_STATUSES = new Set(['CAPTURED', 'SUCCEEDED'])

export function mapCheckoutStatus(providerStatus) {
  return STATUS_MAP[providerStatus] ?? 'UNKNOWN'
}

export function isSuccessfulPayment(providerPayment) {
  return (
    providerPayment?.approved !== false &&
    SUCCESS_STATUSES.has(mapCheckoutStatus(providerPayment?.status))
  )
}

export function isFinalPaymentStatus(status) {
  return [
    'CAPTURED',
    'SUCCEEDED',
    'FAILED',
    'CANCELLED',
    'EXPIRED',
    'REFUNDED',
  ].includes(status)
}

export function assertProviderPaymentMatches(payment, providerPayment) {
  const metadata = providerPayment?.metadata ?? {}
  const amountsMatch = providerPayment?.amount === payment.amountMinor
  const currenciesMatch =
    String(providerPayment?.currency ?? '').toUpperCase() ===
    payment.currency.toUpperCase()
  const referencesMatch =
    providerPayment?.reference === payment.orderReference
  const localIdMatches = metadata.local_payment_id === payment.publicId
  const tokenMatches = metadata.local_payment_token === payment.verificationToken

  if (
    !amountsMatch ||
    !currenciesMatch ||
    !referencesMatch ||
    !localIdMatches ||
    !tokenMatches
  ) {
    throw new ApiError(
      'The provider payment does not match this checkout attempt.',
      {
        status: 409,
        code: 'PROVIDER_PAYMENT_MISMATCH',
      },
    )
  }
}
