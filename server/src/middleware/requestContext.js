import { randomUUID } from 'node:crypto'
import { env } from '../config/env.js'

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/

export function requestContext(request, response, next) {
  const suppliedId = request.get('X-Request-Id')
  const requestId =
    suppliedId && REQUEST_ID_PATTERN.test(suppliedId)
      ? suppliedId
      : randomUUID()

  request.id = requestId
  response.set('X-Request-Id', requestId)

  if (!env.IS_TEST) {
    const startedAt = Date.now()

    response.on('finish', () => {
      const duration = Date.now() - startedAt
      console.info(
        `${request.method} ${request.path} ${response.statusCode} ${duration}ms request_id=${requestId}`,
      )
    })
  }

  next()
}
