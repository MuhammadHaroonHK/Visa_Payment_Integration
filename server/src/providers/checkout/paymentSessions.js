import { env } from '../../config/env.js'

function clientOrigin() {
  return env.CLIENT_ORIGIN.replace(/\/+$/, '')
}

function checkoutLocale(locale) {
  return locale === 'ar-SA' ? 'ar' : 'en-GB'
}

function allocateMinor(total, weights) {
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0)

  if (!weightTotal || total <= 0) {
    return weights.map(() => 0)
  }

  let allocated = 0

  return weights.map((weight, index) => {
    if (index === weights.length - 1) {
      return total - allocated
    }

    const share = Math.floor((total * weight) / weightTotal)
    allocated += share
    return share
  })
}

function buildPaymentItems(order) {
  const grossAmounts = order.items.map(
    (item) => item.unitPriceMinor * item.quantity,
  )
  const discounts = allocateMinor(order.totals.discountMinor, grossAmounts)
  const taxableAmounts = grossAmounts.map(
    (gross, index) => gross - discounts[index],
  )
  const taxes = allocateMinor(order.totals.taxMinor, taxableAmounts)

  const items = order.items.map((item, index) => ({
    reference: item.reference,
    name: item.name,
    quantity: item.quantity,
    unit_price: item.unitPriceMinor,
    total_amount: taxableAmounts[index],
    discount_amount: discounts[index],
    tax_amount: taxes[index],
  }))

  if (order.totals.shippingMinor > 0) {
    items.push({
      reference: 'SHIPPING',
      name: order.shipping.label,
      quantity: 1,
      unit_price: order.totals.shippingMinor,
      total_amount: order.totals.shippingMinor,
      discount_amount: 0,
      tax_amount: 0,
    })
  }

  return items
}

export function buildPaymentSessionPayload({ payment, order, method }) {
  const resultUrl = `${clientOrigin()}/payment/${payment.publicId}/result`

  const payload = {
    amount: payment.amountMinor,
    currency: payment.currency,
    reference: payment.orderReference,
    display_name: 'Sahla',
    description: `Order ${payment.orderReference}`,
    payment_type: 'Regular',
    billing: {
      address: {
        country: order.country ?? 'SA',
      },
    },
    customer: {
      name: payment.customer.fullName,
      email: payment.customer.email,
    },
    items: buildPaymentItems(order),
    success_url: resultUrl,
    failure_url: resultUrl,
    enabled_payment_methods: [method.providerMethod],
    capture: true,
    locale: checkoutLocale(order.locale),
    metadata: {
      local_payment_id: payment.publicId,
      local_payment_token: payment.verificationToken,
      order_reference: payment.orderReference,
    },
  }

  if (method.providerMethod === 'card') {
    // The live Payment Sessions API requires a boolean here. The published
    // schema mentions the strings "true"/"false", but sending a string returns
    // the 3ds_* validation errors.
    payload['3ds'] = { enabled: true }
  }

  if (env.CHECKOUT_PROCESSING_CHANNEL_ID) {
    payload.processing_channel_id = env.CHECKOUT_PROCESSING_CHANNEL_ID
  }

  return payload
}
