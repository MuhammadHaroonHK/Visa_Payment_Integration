import { checkoutCardSchemes, env } from '../config/env.js'

const FINAL_STATUSES = new Set([
  'CAPTURED',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
  'REFUNDED',
])

function toPlain(document) {
  return document?.toObject ? document.toObject() : document
}

function asIsoString(value) {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : value
}

export function serializeOrder(orderDocument) {
  const order = toPlain(orderDocument)

  if (!order) return null

  const items = order.items.map((item) => ({
    id: item.productId,
    productId: item.productId,
    reference: item.reference,
    name: item.name,
    description: item.description,
    quantity: item.quantity,
    unitPriceMinor: item.unitPriceMinor,
    lineTotalMinor: item.lineTotalMinor,
  }))

  const totals = {
    currency: order.totals.currency,
    quantity: order.totals.quantity,
    subtotalMinor: order.totals.subtotalMinor,
    discountMinor: order.totals.discountMinor,
    taxableBaseMinor: order.totals.taxableBaseMinor,
    taxMinor: order.totals.taxMinor,
    taxRate: order.totals.taxRate,
    shippingMinor: order.totals.shippingMinor,
    totalMinor: order.totals.totalMinor,
    items,
  }

  return {
    id: order.publicId,
    reference: order.reference,
    status: order.status,
    currency: order.currency,
    locale: order.locale,
    country: order.country,
    items,
    discount: order.discount
      ? {
          code: order.discount.code,
          label: order.discount.label,
          amountMinor: order.discount.amountMinor,
        }
      : null,
    tax: {
      label: order.tax.label,
      rate: order.tax.rate,
      amountMinor: order.tax.amountMinor,
    },
    shipping: {
      label: order.shipping.label,
      detail: order.shipping.detail,
      amountMinor: order.shipping.amountMinor,
    },
    totals,
    createdAt: asIsoString(order.createdAt),
    updatedAt: asIsoString(order.updatedAt),
  }
}

function providerLabel(payment) {
  if (payment.provider === 'checkout') {
    return payment.providerSessionId || payment.providerPaymentId
      ? 'Checkout.com Flow'
      : 'Checkout.com Flow (not connected)'
  }

  return 'Not connected'
}

function serializeFlow(payment) {
  if (!payment.providerSessionId || !payment.providerSessionPayload) {
    return null
  }

  const sessionClosed =
    FINAL_STATUSES.has(payment.status) || Boolean(payment.providerPaymentId)

  return {
    connected: true,
    publicKey: env.CHECKOUT_PUBLIC_KEY ?? null,
    environment: payment.mode,
    component: payment.method.flowComponent ?? 'flow',
    cardSchemes: checkoutCardSchemes(),
    session: sessionClosed ? null : payment.providerSessionPayload,
  }
}

export function serializePayment(paymentDocument, orderDocument = null) {
  const payment = toPlain(paymentDocument)
  const relation = orderDocument ?? payment?.order
  const order =
    relation && relation.items ? serializeOrder(relation) : null

  if (!payment) return null

  return {
    id: payment.publicId,
    mode: payment.mode,
    environment: payment.mode,
    provider: payment.provider,
    providerLabel: providerLabel(payment),
    providerReady: Boolean(
      payment.providerSessionId || payment.providerPaymentId,
    ),
    status: payment.status,
    orderId: order?.id ?? null,
    orderReference: payment.orderReference,
    amountMinor: payment.amountMinor,
    currency: payment.currency,
    methodId: payment.methodId,
    methodName: payment.methodName,
    methodAvailability: payment.method.availability,
    method: {
      id: payment.method.id,
      name: payment.method.name,
      availability: payment.method.availability,
      description: payment.method.description,
      requirement: payment.method.requirement,
      detail: payment.method.detail,
      docsUrl: payment.method.docsUrl,
      providerLabel: payment.method.providerLabel,
      providerMethod: payment.method.providerMethod,
      flowComponent: payment.method.flowComponent,
    },
    customer: {
      fullName: payment.customer.fullName,
    },
    flow: serializeFlow(payment),
    verification: {
      source: payment.verificationSource,
      verifiedAt: asIsoString(payment.verifiedAt),
    },
    providerStatus: payment.providerStatus ?? null,
    failureCode: payment.failureCode ?? null,
    order,
    totals: order?.totals ?? null,
    createdAt: asIsoString(payment.createdAt),
    updatedAt: asIsoString(payment.updatedAt),
  }
}
