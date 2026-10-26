import {
  checkoutCardSchemes,
  env,
  isCheckoutConfigured,
} from '../config/env.js'

const providerMode =
  env.CHECKOUT_ENVIRONMENT === 'production' ? 'live' : 'sandbox'

const applePayConfigured = Boolean(
  env.CHECKOUT_APPLE_PAY_ENABLED && env.CHECKOUT_APPLE_PAY_DOMAIN,
)

const methodDefinitions = Object.freeze([
  Object.freeze({
    id: 'card',
    name: 'Cards',
    description: 'Pay with a Visa, Mastercard or Mada debit or credit card.',
    availability: 'available',
    mode: providerMode,
    flowComponent: 'card',
    providerMethod: 'card',
    providerLabel: 'Checkout.com Flow',
    requirement: 'Card details are entered inside Checkout.com Flow',
    detail:
      'Flow collects the card details and handles 3D Secure. The application never receives the full card number.',
    docsUrl:
      'https://www.checkout.com/docs/payments/add-payment-methods/card-payments',
    alwaysSelectable: true,
  }),
  Object.freeze({
    id: 'apple_pay',
    name: 'Apple Pay',
    description: 'Pay with a card stored in your Apple Wallet.',
    availability: 'available',
    mode: providerMode,
    flowComponent: 'applepay',
    providerMethod: 'applepay',
    providerLabel: 'Checkout.com Flow',
    requirement: 'Requires Apple Pay and a supported device or browser',
    detail:
      'Apple Pay is presented by Checkout.com Flow. The exact domain must be onboarded with Checkout.com before Apple Pay can be used.',
    docsUrl:
      'https://www.checkout.com/docs/payments/add-payment-methods/apple-pay/web',
    alwaysSelectable: applePayConfigured,
  }),
])

function withRuntimeState(method) {
  const checkoutReady = isCheckoutConfigured()
  const selectable = checkoutReady && method.alwaysSelectable

  return {
    ...method,
    availability: selectable ? 'available' : 'unavailable',
    mode: selectable ? method.mode : null,
    providerReady: selectable,
    selectable,
  }
}

export function listPaymentMethods() {
  return methodDefinitions.map((method) => {
    const runtimeMethod = withRuntimeState(method)
    const { alwaysSelectable: _alwaysSelectable, ...publicMethod } =
      runtimeMethod

    return publicMethod
  })
}

export function getPaymentMethodForServer(methodId) {
  const method = methodDefinitions.find((candidate) => candidate.id === methodId)

  return method ? withRuntimeState(method) : null
}

export function methodSnapshot(method) {
  return {
    id: method.id,
    name: method.name,
    availability: method.availability,
    description: method.description,
    requirement: method.requirement,
    detail: method.detail,
    docsUrl: method.docsUrl,
    providerLabel: method.providerLabel,
    providerMethod: method.providerMethod,
    flowComponent: method.flowComponent,
  }
}

export function paymentMethodsMeta() {
  const checkoutReady = isCheckoutConfigured()

  return {
    provider: 'checkout',
    environment: env.CHECKOUT_ENVIRONMENT,
    providerConnected: checkoutReady,
    providerConfigured: checkoutReady,
    publicKey: checkoutReady ? env.CHECKOUT_PUBLIC_KEY : null,
    applePayEnabled: checkoutReady && applePayConfigured,
    cardSchemes: checkoutCardSchemes(),
    configSource: 'server',
    verifiedAt: null,
  }
}
