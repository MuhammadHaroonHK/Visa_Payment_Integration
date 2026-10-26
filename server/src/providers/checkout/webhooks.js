import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from '../../config/env.js'
import { ApiError } from '../../domain/errors.js'

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) return false

  return timingSafeEqual(leftBuffer, rightBuffer)
}

export function verifyCheckoutWebhook({ rawBody, signature, authorization }) {
  if (!env.CHECKOUT_WEBHOOK_SIGNATURE_KEY) {
    throw new ApiError('The webhook signing key is not configured.', {
      status: 503,
      code: 'WEBHOOK_NOT_CONFIGURED',
    })
  }

  if (!rawBody?.length || !signature) {
    throw new ApiError('The webhook signature is missing.', {
      status: 401,
      code: 'INVALID_WEBHOOK_SIGNATURE',
    })
  }

  if (
    env.CHECKOUT_WEBHOOK_AUTH_KEY &&
    !safeEqual(authorization ?? '', env.CHECKOUT_WEBHOOK_AUTH_KEY)
  ) {
    throw new ApiError('The webhook authorization is invalid.', {
      status: 401,
      code: 'INVALID_WEBHOOK_SIGNATURE',
    })
  }

  const expected = createHmac('sha256', env.CHECKOUT_WEBHOOK_SIGNATURE_KEY)
    .update(rawBody)
    .digest()

  let received

  try {
    received = Buffer.from(signature.trim(), 'hex')
  } catch {
    received = Buffer.alloc(0)
  }

  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new ApiError('The webhook signature is invalid.', {
      status: 401,
      code: 'INVALID_WEBHOOK_SIGNATURE',
    })
  }
}
