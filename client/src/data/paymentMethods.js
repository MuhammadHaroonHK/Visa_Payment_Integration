/**
 * Client-side fallback catalogue.
 *
 * The API is authoritative for availability, mode and the Flow component. These
 * values are used only when rendering a method that the server already returned.
 */
export const PAYMENT_AVAILABILITY = Object.freeze({
  available: {
    key: 'available',
    label: 'Available',
    tone: 'positive',
    canProceed: true,
    description: 'Available through Checkout.com Flow.',
  },
  unavailable: {
    key: 'unavailable',
    label: 'Unavailable',
    tone: 'neutral',
    canProceed: false,
    description:
      'Not available for this merchant, currency or environment. The option cannot be selected.',
  },
})

export const paymentMethods = Object.freeze([
  {
    id: 'card',
    name: 'Cards',
    description: 'Pay with a Visa, Mastercard or Mada debit or credit card.',
    availability: 'available',
    mode: 'sandbox',
    flowComponent: 'card',
    providerMethod: 'card',
    providerLabel: 'Checkout.com Flow',
    requirement: 'Card details are entered inside Checkout.com Flow',
    detail:
      'Flow collects the card details and handles 3D Secure. The application never receives the full card number.',
    docsUrl:
      'https://www.checkout.com/docs/payments/add-payment-methods/card-payments',
    selectable: true,
    providerReady: true,
  },
  {
    id: 'apple_pay',
    name: 'Apple Pay',
    description: 'Pay with a card stored in your Apple Wallet.',
    availability: 'available',
    mode: 'sandbox',
    flowComponent: 'applepay',
    providerMethod: 'applepay',
    providerLabel: 'Checkout.com Flow',
    requirement: 'Requires Apple Pay on a supported device or browser',
    detail:
      'Apple Pay is presented by Checkout.com Flow. The domain must be onboarded with Checkout.com before Apple Pay can be used.',
    docsUrl:
      'https://www.checkout.com/docs/payments/add-payment-methods/apple-pay/web',
    selectable: true,
    providerReady: true,
  },
])

export function getPaymentMethod(methodId) {
  return paymentMethods.find((method) => method.id === methodId) ?? null
}

export function getAvailability(method) {
  return (
    PAYMENT_AVAILABILITY[method?.availability] ??
    PAYMENT_AVAILABILITY.unavailable
  )
}

export function isMethodActionable(method) {
  return Boolean(
    method &&
      method.selectable !== false &&
      getAvailability(method).canProceed,
  )
}
