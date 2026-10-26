export const INTERNAL_PAYMENT_STATUS = Object.freeze({
  CREATED: { label: 'Created', tone: 'neutral' },
  PENDING: { label: 'Pending', tone: 'warning' },
  REQUIRES_ACTION: { label: 'Requires action', tone: 'info' },
  AUTHORIZED: { label: 'Authorized', tone: 'info' },
  CAPTURED: { label: 'Captured', tone: 'positive' },
  SUCCEEDED: { label: 'Succeeded', tone: 'positive' },
  FAILED: { label: 'Failed', tone: 'danger' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
  EXPIRED: { label: 'Expired', tone: 'neutral' },
  REFUNDED: { label: 'Refunded', tone: 'neutral' },
  UNKNOWN: { label: 'Unknown', tone: 'warning' },
})

export const RESULT_VIEWS = Object.freeze({
  success: {
    key: 'success',
    title: 'Payment complete',
    eyebrow: 'Captured',
    tone: 'positive',
    icon: 'success',
    description:
      'Checkout.com confirmed that the payment was captured. The server verified the provider status before updating the order.',
    nextSteps: [
      'The payment is recorded against this order.',
      'The server marks the order paid only after a captured or paid provider status.',
      'A signed webhook can update the same payment if it arrives later.',
    ],
    actionLabel: 'Start a new order',
  },
  authorized: {
    key: 'authorized',
    title: 'Payment authorized',
    eyebrow: 'Authorized',
    tone: 'info',
    icon: 'pending',
    description:
      'The provider authorized the payment but has not confirmed a capture. The order is not fulfilled while only an authorization is recorded.',
    nextSteps: [
      'Wait for the captured status from Checkout.com.',
      'A signed webhook or a server verification updates the payment.',
      'Do not fulfil the order from the browser result alone.',
    ],
    actionLabel: 'Return to checkout',
  },
  pending: {
    key: 'pending',
    title: 'Payment pending',
    eyebrow: 'Pending',
    tone: 'warning',
    icon: 'pending',
    description:
      'Checkout.com has not returned a final captured result yet. The payment may still complete, so the order must not be fulfilled or retried.',
    nextSteps: [
      'The server checks the provider status endpoint.',
      'A signed webhook resolves the final state.',
      'No duplicate payment is created while waiting.',
    ],
    actionLabel: 'Return to checkout',
  },
  declined: {
    key: 'declined',
    title: 'Payment declined',
    eyebrow: 'Declined',
    tone: 'danger',
    icon: 'declined',
    description:
      'Checkout.com did not approve the payment. No capture was recorded and the application does not retry automatically.',
    nextSteps: [
      'No fulfilment is started.',
      'The customer can return and choose another method.',
      'Only a safe provider status is shown or logged.',
    ],
    actionLabel: 'Try checkout again',
  },
  cancelled: {
    key: 'cancelled',
    title: 'Payment cancelled',
    eyebrow: 'Cancelled',
    tone: 'neutral',
    icon: 'cancelled',
    description:
      'The payment was cancelled or expired before it completed. No payment was captured.',
    nextSteps: [
      'No capture was recorded.',
      'The cart remains available.',
      'No automatic retry is attempted.',
    ],
    actionLabel: 'Return to checkout',
  },
  refunded: {
    key: 'refunded',
    title: 'Payment refunded',
    eyebrow: 'Refunded',
    tone: 'neutral',
    icon: 'cancelled',
    description:
      'Checkout.com reported a refund for this payment. Refund handling is outside this checkout flow.',
    nextSteps: [
      'Check the Checkout.com dashboard for the refund detail.',
      'No new payment is created automatically.',
      'Contact support if the refund is unexpected.',
    ],
    actionLabel: 'Return to checkout',
  },
  error: {
    key: 'error',
    title: 'Status could not be verified',
    eyebrow: 'Error',
    tone: 'danger',
    icon: 'error',
    description:
      'The payment status could not be confirmed. Treat this attempt as unresolved until it is checked with the provider.',
    nextSteps: [
      'Do not retry the payment automatically.',
      'Check the Checkout.com dashboard and server logs.',
      'Use the safe reference when contacting support.',
    ],
    actionLabel: 'Return to checkout',
  },
})

const STATUS_RESULT_KEY = Object.freeze({
  AUTHORIZED: 'authorized',
  CAPTURED: 'success',
  SUCCEEDED: 'success',
  PENDING: 'pending',
  CREATED: 'pending',
  REQUIRES_ACTION: 'pending',
  FAILED: 'declined',
  CANCELLED: 'cancelled',
  EXPIRED: 'cancelled',
  REFUNDED: 'refunded',
  UNKNOWN: 'error',
})

export function getResultViewForStatus(status) {
  const key = STATUS_RESULT_KEY[status]
  return key ? RESULT_VIEWS[key] : null
}
