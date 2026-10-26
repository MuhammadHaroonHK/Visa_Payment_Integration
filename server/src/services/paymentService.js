import { env } from '../config/env.js'
import {
  getPaymentMethodForServer,
  methodSnapshot,
} from '../domain/paymentMethods.js'
import { ApiError, notFoundError } from '../domain/errors.js'
import { serializePayment } from '../domain/serializers.js'
import { Payment } from '../models/Payment.js'
import {
  CheckoutApiError,
  createPaymentSession,
  getPayment as getCheckoutPayment,
} from '../providers/checkout/client.js'
import {
  assertProviderPaymentMatches,
  isFinalPaymentStatus,
  isSuccessfulPayment,
  mapCheckoutStatus,
} from '../providers/checkout/payments.js'
import { buildPaymentSessionPayload } from '../providers/checkout/paymentSessions.js'
import {
  assertOrderIsOpen,
  getOrderDocumentByPublicId,
  markOrderPaid,
  repriceOrder,
} from './orderService.js'

const VERIFICATION_BLOCKING_STATUSES = [
  'CREATED',
  'PENDING',
  'REQUIRES_ACTION',
  'UNKNOWN',
]

function serializeWithOrder(payment) {
  return serializePayment(payment, payment.order)
}

async function recordUncertainVerification(payment, providerPaymentId) {
  if (
    !providerPaymentId ||
    !VERIFICATION_BLOCKING_STATUSES.includes(payment.status)
  ) {
    return
  }

  // A browser callback is enough to prove that the customer reached the
  // provider, even if the follow-up lookup fails. Keep the attempt blocked for
  // a later retry or webhook instead of allowing a second payment.
  await Payment.updateOne(
    {
      _id: payment._id,
      status: { $in: VERIFICATION_BLOCKING_STATUSES },
    },
    {
      $set: {
        providerPaymentId,
        status: 'UNKNOWN',
        failureCode: 'VERIFICATION_PENDING',
        lastProviderSyncAt: new Date(),
      },
    },
  )
}

async function findPayment(publicId) {
  const payment = await Payment.findOne({ publicId }).populate('order')

  if (!payment) {
    throw notFoundError('The payment could not be found.')
  }

  return payment
}

function toProviderApiError(error) {
  if (!(error instanceof CheckoutApiError)) return error

  return new ApiError(error.message, {
    status: error.status === 503 ? 503 : 502,
    code: error.code === 'CHECKOUT_NOT_CONFIGURED'
      ? 'PROVIDER_NOT_CONFIGURED'
      : 'PROVIDER_ERROR',
    expose: true,
    details:
      error.providerRequestId || error.providerStatus
        ? {
            ...(error.providerRequestId
              ? { providerRequestId: error.providerRequestId }
              : {}),
            ...(error.providerStatus
              ? { providerStatus: error.providerStatus }
              : {}),
          }
        : null,
  })
}

export async function createPayment({ orderId, methodId, customer }) {
  const order = await getOrderDocumentByPublicId(orderId)

  assertOrderIsOpen(order)

  const inProgressPayment = await Payment.findOne({
    order: order._id,
    status: { $in: ['PENDING', 'AUTHORIZED', 'UNKNOWN'] },
  })
    .sort({ createdAt: -1 })
    .select('publicId status')

  if (inProgressPayment) {
    throw new ApiError(
      'A payment for this order is still in progress. Wait for the provider result before starting another payment.',
      {
        status: 409,
        code: 'ORDER_PAYMENT_IN_PROGRESS',
        details: {
          paymentId: inProgressPayment.publicId,
          status: inProgressPayment.status,
        },
      },
    )
  }

  const method = getPaymentMethodForServer(methodId)

  if (!method) {
    throw new ApiError('This payment method is not available.', {
      status: 422,
      code: 'PAYMENT_METHOD_UNAVAILABLE',
    })
  }

  if (!method.selectable) {
    throw new ApiError(
      `${method.name} is not available for this configuration.`,
      {
        status: 422,
        code: 'PAYMENT_METHOD_UNAVAILABLE',
      },
    )
  }

  const priced = repriceOrder(order)
  const mode = env.CHECKOUT_ENVIRONMENT === 'production' ? 'live' : 'sandbox'

  const payment = await Payment.create({
    order: order._id,
    orderReference: order.reference,
    amountMinor: priced.totals.totalMinor,
    currency: priced.totals.currency,
    methodId: method.id,
    methodName: method.name,
    method: methodSnapshot(method),
    customer: {
      fullName: customer.fullName,
      email: customer.email,
    },
    provider: 'checkout',
    mode,
    status: 'CREATED',
    verificationSource: 'none',
  })

  order.latestPayment = payment._id
  await order.save()

  try {
    const providerSession = await createPaymentSession(
      buildPaymentSessionPayload({ payment, order, method }),
    )

    payment.providerSessionId = providerSession.id
    payment.providerSessionPayload = providerSession
    payment.status = 'REQUIRES_ACTION'
    await payment.save()
  } catch (error) {
    payment.status = 'FAILED'
    payment.failureCode = error.code ?? 'PROVIDER_SESSION_FAILED'
    await payment.save()
    throw toProviderApiError(error)
  }

  return {
    payment: serializePayment(payment, order),
  }
}

export async function getPayment(publicId) {
  const payment = await findPayment(publicId)

  return {
    payment: serializeWithOrder(payment),
  }
}

async function applyProviderPayment(payment, providerPayment, source) {
  assertProviderPaymentMatches(payment, providerPayment)

  const nextStatus =
    providerPayment.approved === false
      ? 'FAILED'
      : mapCheckoutStatus(providerPayment.status)

  if (isFinalPaymentStatus(payment.status) && payment.status !== nextStatus) {
    return payment
  }

  payment.providerPaymentId = providerPayment.id
  payment.providerStatus = providerPayment.status ?? null
  payment.status = nextStatus
  payment.verificationSource = source
  payment.verifiedAt = new Date()
  payment.lastProviderSyncAt = new Date()
  payment.failureCode =
    nextStatus === 'FAILED' ? (providerPayment.status ?? 'DECLINED') : null

  await payment.save()

  if (isSuccessfulPayment(providerPayment)) {
    await markOrderPaid(payment.order?._id ?? payment.order)
  }

  return payment
}

export async function verifyPayment(publicId, providerPaymentId = null) {
  const payment = await findPayment(publicId)
  const paymentId = providerPaymentId ?? payment.providerPaymentId

  if (!paymentId) {
    return {
      payment: serializeWithOrder(payment),
      verification: {
        verified: false,
        source: payment.verificationSource,
        verifiedAt: payment.verifiedAt
          ? payment.verifiedAt.toISOString()
          : null,
        reason: 'provider_payment_pending',
      },
    }
  }

  let providerPayment

  try {
    providerPayment = await getCheckoutPayment(paymentId)
    await applyProviderPayment(payment, providerPayment, 'provider')
  } catch (error) {
    await recordUncertainVerification(payment, paymentId)
    throw toProviderApiError(error)
  }

  const updated = await findPayment(publicId)

  return {
    payment: serializeWithOrder(updated),
    verification: {
      verified: true,
      source: 'provider',
      verifiedAt: updated.verifiedAt
        ? updated.verifiedAt.toISOString()
        : null,
      reason: null,
    },
  }
}

export async function applyWebhookProviderPayment(payment, providerPayment) {
  await applyProviderPayment(payment, providerPayment, 'webhook')
  return findPayment(payment.publicId)
}
