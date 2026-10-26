import { createHash } from 'node:crypto'
import { Idempotency } from '../models/Idempotency.js'
import { ApiError } from '../domain/errors.js'
import { stableStringify } from '../utils/stableStringify.js'

const TTL_MS = 24 * 60 * 60 * 1000

function hashRequest(payload) {
  return createHash('sha256').update(stableStringify(payload)).digest('hex')
}

async function readExisting({ key, scope, requestHash }) {
  const existing = await Idempotency.findOne({ key, scope }).lean()

  if (!existing) return null

  if (existing.requestHash !== requestHash) {
    throw new ApiError(
      'This idempotency key was already used with a different request.',
      {
        status: 409,
        code: 'IDEMPOTENCY_KEY_REUSED',
      },
    )
  }

  if (existing.status === 'pending') {
    throw new ApiError(
      'A request with this idempotency key is still being processed.',
      {
        status: 409,
        code: 'IDEMPOTENCY_IN_PROGRESS',
      },
    )
  }

  return existing.response
}

/**
 * Persists the first response for a key. Callers should validate input before
 * entering this helper so malformed requests cannot reserve a key.
 */
export async function withIdempotency({
  key,
  scope,
  payload,
  handler,
}) {
  if (!key) {
    return handler()
  }

  const requestHash = hashRequest(payload)
  const existing = await readExisting({ key, scope, requestHash })

  if (existing) return existing

  try {
    await Idempotency.create({
      key,
      scope,
      requestHash,
      status: 'pending',
      expiresAt: new Date(Date.now() + TTL_MS),
    })
  } catch (error) {
    if (error?.code === 11000) {
      const raced = await readExisting({ key, scope, requestHash })
      if (raced) return raced
    }

    throw error
  }

  try {
    const response = await handler()

    await Idempotency.updateOne(
      { key, scope },
      {
        $set: {
          status: 'completed',
          response,
          expiresAt: new Date(Date.now() + TTL_MS),
        },
      },
    )

    return response
  } catch (error) {
    // A failed request can be retried. The payment flow records provider
    // session IDs on the local payment so a retry cannot silently fulfil a
    // different attempt.
    await Idempotency.deleteOne({ key, scope, status: 'pending' })
    throw error
  }
}

export function idempotencyKeyMiddleware(request, _response, next) {
  const rawKey = request.get('Idempotency-Key')

  if (rawKey === undefined) {
    request.idempotencyKey = null
    next()
    return
  }

  const key = rawKey.trim()

  if (!/^[\x21-\x7e]{8,200}$/.test(key)) {
    next(
      new ApiError(
        'Idempotency-Key must contain 8 to 200 printable characters.',
        {
          status: 400,
          code: 'INVALID_IDEMPOTENCY_KEY',
        },
      ),
    )
    return
  }

  request.idempotencyKey = key
  next()
}
