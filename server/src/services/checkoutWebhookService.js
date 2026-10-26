import { createHash } from 'node:crypto'
import { ApiError } from '../domain/errors.js'
import { Payment } from '../models/Payment.js'
import { WebhookEvent } from '../models/WebhookEvent.js'
import { getPayment as getCheckoutPayment } from '../providers/checkout/client.js'
import { applyWebhookProviderPayment } from './paymentService.js'

const PAYMENT_EVENTS = new Set([
  'payment_approved',
  'payment_capture_declined',
  'payment_capture_pending',
  'payment_captured',
  'payment_canceled',
  'payment_declined',
  'payment_expired',
  'payment_pending',
  'payment_refunded',
  'payment_voided',
])

export async function receiveCheckoutWebhook(payload) {
  if (!payload?.id || !payload?.type || !payload?.data?.id) {
    throw new ApiError('The webhook payload is incomplete.', {
      status: 400,
      code: 'INVALID_WEBHOOK_PAYLOAD',
    })
  }

  const metadata = payload.data.metadata ?? {}
  const payloadHash = createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')

  try {
    const event = await WebhookEvent.create({
      eventId: payload.id,
      type: payload.type,
      providerPaymentId: payload.data.id,
      providerSessionId: metadata.cko_payment_session_id ?? null,
      localPaymentId: metadata.local_payment_id ?? null,
      payloadHash,
      payload,
    })

    return { event, duplicate: false }
  } catch (error) {
    if (error?.code !== 11000) throw error

    const event = await WebhookEvent.findOne({ eventId: payload.id })
    return { event, duplicate: true }
  }
}

async function findPaymentForEvent(event) {
  if (event.localPaymentId) {
    const payment = await Payment.findOne({ publicId: event.localPaymentId })
    if (payment) return payment
  }

  if (event.providerSessionId) {
    const payment = await Payment.findOne({
      providerSessionId: event.providerSessionId,
    })
    if (payment) return payment
  }

  if (event.providerPaymentId) {
    return Payment.findOne({ providerPaymentId: event.providerPaymentId })
  }

  return null
}

async function finishEvent(event, status, lastError = null) {
  // Use an update instead of save so a concurrent cleanup or retention job
  // cannot turn a completed attempt into an unhandled DocumentNotFoundError.
  await WebhookEvent.updateOne(
    { _id: event._id },
    {
      $set: {
        status,
        processedAt: new Date(),
        lastError,
      },
    },
  )
}

export async function processCheckoutWebhookEvent(eventId) {
  const event = await WebhookEvent.findOneAndUpdate(
    { eventId, status: { $in: ['received', 'failed'] } },
    { $set: { status: 'processing' }, $inc: { attempts: 1 } },
    { new: true },
  )

  if (!event) return

  try {
    if (!PAYMENT_EVENTS.has(event.type)) {
      await finishEvent(event, 'ignored')
      return
    }

    const providerPayment = await getCheckoutPayment(event.providerPaymentId)
    const payment =
      (await findPaymentForEvent(event)) ??
      (await Payment.findOne({
        publicId: providerPayment?.metadata?.local_payment_id,
      }))

    if (!payment) {
      await finishEvent(event, 'ignored')
      return
    }

    await applyWebhookProviderPayment(payment, providerPayment)
    await finishEvent(event, 'processed')
  } catch (error) {
    await finishEvent(
      event,
      'failed',
      error?.code ?? error?.name ?? 'WEBHOOK_PROCESSING_FAILED',
    )
  }
}

export function scheduleCheckoutWebhookProcessing(eventId) {
  setImmediate(() => {
    void processCheckoutWebhookEvent(eventId).catch((error) => {
      console.error('Checkout webhook processing failed.', {
        eventId,
        error: error?.message ?? error,
      })
    })
  })
}

export async function reprocessPendingCheckoutWebhooks(limit = 20) {
  // A process that crashed mid-handler can leave an event in "processing".
  // Return stale claims to the retry queue without touching a live claim.
  await WebhookEvent.updateMany(
    {
      status: 'processing',
      updatedAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) },
    },
    { $set: { status: 'failed' } },
  )

  const events = await WebhookEvent.find({
    status: { $in: ['received', 'failed'] },
    attempts: { $lt: 5 },
  })
    .sort({ createdAt: 1 })
    .limit(limit)
    .select('eventId')

  for (const event of events) {
    await processCheckoutWebhookEvent(event.eventId)
  }
}
