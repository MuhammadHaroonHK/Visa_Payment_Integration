import {
  COUNTRY,
  CURRENCY,
  LOCALE,
  SHIPPING_DETAIL,
  SHIPPING_LABEL,
  SHIPPING_MINOR,
  TAX_LABEL,
  VAT_RATE,
  productsById,
  promotionsByCode,
} from '../data/catalog.js'
import { ApiError, notFoundError } from '../domain/errors.js'
import { calculateOrderTotals } from '../domain/pricing.js'
import { serializeOrder } from '../domain/serializers.js'
import { Counter } from '../models/Counter.js'
import { Order } from '../models/Order.js'

function resolveItems(inputItems) {
  return inputItems.map(({ productId, quantity }) => {
    const product = productsById.get(productId)

    if (!product) {
      throw new ApiError('One of the order items is not available.', {
        status: 422,
        code: 'INVALID_PRODUCT',
        details: { productId },
      })
    }

    return {
      productId: product.id,
      reference: product.reference,
      name: product.name,
      description: product.description,
      quantity,
      unitPriceMinor: product.unitPriceMinor,
    }
  })
}

function resolveDiscount(promotionCode, subtotalMinor) {
  if (!promotionCode) return null

  const normalizedCode = promotionCode.trim().toUpperCase()
  const promotion = promotionsByCode.get(normalizedCode)

  if (!promotion) {
    throw new ApiError('The promotion code is not valid.', {
      status: 422,
      code: 'INVALID_PROMOTION',
    })
  }

  if (subtotalMinor < promotion.minimumSubtotalMinor) {
    throw new ApiError('The order does not meet the promotion requirements.', {
      status: 422,
      code: 'PROMOTION_NOT_ELIGIBLE',
    })
  }

  return {
    code: promotion.code,
    label: promotion.label,
    amountMinor: promotion.amountMinor,
  }
}

function priceOrder({ inputItems, promotionCode }) {
  const resolvedItems = resolveItems(inputItems)
  const subtotalMinor = resolvedItems.reduce(
    (total, item) => total + item.unitPriceMinor * item.quantity,
    0,
  )
  const discount = resolveDiscount(promotionCode, subtotalMinor)
  const calculated = calculateOrderTotals({
    items: resolvedItems,
    discountAmountMinor: discount?.amountMinor ?? 0,
    taxRate: VAT_RATE,
    shippingMinor: SHIPPING_MINOR,
    currency: CURRENCY,
  })

  return {
    items: calculated.items,
    discount,
    tax: {
      label: TAX_LABEL,
      rate: VAT_RATE,
      amountMinor: calculated.taxMinor,
    },
    shipping: {
      label: SHIPPING_LABEL,
      detail: SHIPPING_DETAIL,
      amountMinor: SHIPPING_MINOR,
    },
    totals: {
      currency: calculated.currency,
      quantity: calculated.quantity,
      subtotalMinor: calculated.subtotalMinor,
      discountMinor: calculated.discountMinor,
      taxableBaseMinor: calculated.taxableBaseMinor,
      taxMinor: calculated.taxMinor,
      taxRate: calculated.taxRate,
      shippingMinor: calculated.shippingMinor,
      totalMinor: calculated.totalMinor,
    },
  }
}

async function nextOrderReference() {
  const year = new Date().getUTCFullYear()
  const counter = await Counter.findOneAndUpdate(
    { _id: 'order_reference' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: false },
  )

  return `ORD-${year}-${String(counter.seq).padStart(4, '0')}`
}

export async function createOrder(input) {
  const priced = priceOrder({
    inputItems: input.items,
    promotionCode: input.promotionCode,
  })

  const order = await Order.create({
    reference: await nextOrderReference(),
    status: 'open',
    currency: CURRENCY,
    locale: input.locale ?? LOCALE,
    country: COUNTRY,
    items: priced.items,
    discount: priced.discount ?? undefined,
    tax: priced.tax,
    shipping: priced.shipping,
    totals: priced.totals,
  })

  const serialized = serializeOrder(order)

  return {
    order: serialized,
    totals: serialized.totals,
  }
}

export async function getOrderByPublicId(orderId) {
  const order = await Order.findOne({ publicId: orderId })

  if (!order) {
    throw notFoundError('The order could not be found.')
  }

  const serialized = serializeOrder(order)

  return {
    order: serialized,
    totals: serialized.totals,
  }
}

export async function getOrderDocumentByPublicId(orderId) {
  const order = await Order.findOne({ publicId: orderId })

  if (!order) {
    throw notFoundError('The order could not be found.')
  }

  return order
}

export function assertOrderIsOpen(order) {
  if (order.status !== 'open') {
    throw new ApiError('This order is no longer open for payment.', {
      status: 409,
      code: 'ORDER_NOT_PAYABLE',
      details: { status: order.status },
    })
  }
}

/**
 * Re-runs the server catalogue and tax rules against the stored line items.
 * A changed catalogue price is a conflict, never a silent client-side amount.
 */
export function repriceOrder(order) {
  const priced = priceOrder({
    inputItems: order.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    })),
    promotionCode: order.discount?.code ?? null,
  })

  const stored = order.totals
  const changed =
    stored.subtotalMinor !== priced.totals.subtotalMinor ||
    stored.discountMinor !== priced.totals.discountMinor ||
    stored.taxMinor !== priced.totals.taxMinor ||
    stored.shippingMinor !== priced.totals.shippingMinor ||
    stored.totalMinor !== priced.totals.totalMinor ||
    stored.currency !== priced.totals.currency

  if (changed) {
    throw new ApiError(
      'The order total changed. Reload the checkout before starting payment.',
      {
        status: 409,
        code: 'ORDER_AMOUNT_CHANGED',
      },
    )
  }

  return priced
}

export async function markOrderPaid(orderId) {
  const updated = await Order.findOneAndUpdate(
    { _id: orderId, status: 'open' },
    { $set: { status: 'paid', paidAt: new Date() } },
    { new: true },
  )

  return updated ?? Order.findById(orderId)
}
