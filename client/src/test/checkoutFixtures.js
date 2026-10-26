const items = [
  {
    id: 'riwaq-esp-01',
    productId: 'riwaq-esp-01',
    reference: 'RIWAQ-ESP-01',
    name: 'Riwāq Home Espresso Machine',
    description: 'Brushed steel · 1.2 L · Saudi plug',
    quantity: 1,
    unitPriceMinor: 129900,
    lineTotalMinor: 129900,
  },
]

export const testTotals = {
  currency: 'SAR',
  quantity: 1,
  subtotalMinor: 129900,
  discountMinor: 10000,
  taxableBaseMinor: 119900,
  taxMinor: 17985,
  taxRate: 0.15,
  shippingMinor: 0,
  totalMinor: 137885,
  items,
}

export const testOrder = {
  id: 'ord_test_1',
  reference: 'ORD-2026-1042',
  status: 'open',
  currency: 'SAR',
  locale: 'en-SA',
  country: 'SA',
  items,
  discount: {
    code: 'WELCOME100',
    label: 'Welcome offer',
    amountMinor: 10000,
  },
  tax: {
    label: 'VAT (15%)',
    rate: 0.15,
    amountMinor: 17985,
  },
  shipping: {
    label: 'Delivery',
    detail: 'Standard · 2–4 business days',
    amountMinor: 0,
  },
  totals: testTotals,
  createdAt: '2026-10-26T08:00:00.000Z',
  updatedAt: '2026-10-26T08:00:00.000Z',
}

export const testMethods = [
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
]

export const testMeta = {
  provider: 'checkout',
  environment: 'sandbox',
  providerConnected: true,
  providerConfigured: true,
  publicKey: 'pk_test_public',
  applePayEnabled: true,
  cardSchemes: ['visa', 'mastercard', 'mada'],
  configSource: 'server',
  verifiedAt: null,
}

export const testCheckoutData = {
  order: testOrder,
  totals: testTotals,
  methods: testMethods,
  meta: testMeta,
}

const baseAttempt = {
  id: 'pmt_test_1',
  mode: 'sandbox',
  environment: 'sandbox',
  provider: 'checkout',
  providerLabel: 'Checkout.com Flow',
  providerReady: true,
  status: 'REQUIRES_ACTION',
  orderId: testOrder.id,
  orderReference: testOrder.reference,
  amountMinor: 137885,
  currency: 'SAR',
  methodId: 'card',
  methodName: 'Cards',
  methodAvailability: 'available',
  method: testMethods[0],
  customer: {
    fullName: 'Layla Al-Harbi',
  },
  flow: {
    connected: true,
    publicKey: 'pk_test_public',
    environment: 'sandbox',
    component: 'card',
    cardSchemes: ['visa', 'mastercard', 'mada'],
    session: {
      id: 'ps_test_1',
      payment_session_token: 'pst_test_1',
      payment_session_secret: 'pss_test_1',
      amount: 137885,
      currency: 'SAR',
    },
  },
  verification: {
    source: 'none',
    verifiedAt: null,
  },
  providerStatus: null,
  failureCode: null,
  order: testOrder,
  totals: testTotals,
  createdAt: '2026-10-26T08:00:00.000Z',
  updatedAt: '2026-10-26T08:00:00.000Z',
}

export function makeAttempt(overrides = {}) {
  return {
    ...baseAttempt,
    ...overrides,
    flow:
      overrides.flow === undefined ? baseAttempt.flow : overrides.flow,
    verification: overrides.verification ?? baseAttempt.verification,
    order: overrides.order ?? baseAttempt.order,
    totals: overrides.totals ?? baseAttempt.totals,
  }
}
