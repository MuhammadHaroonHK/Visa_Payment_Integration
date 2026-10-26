import { ZodError } from 'zod'
import { env } from '../config/env.js'
import { ApiError } from '../domain/errors.js'

function sendError(response, requestId, status, code, message, details = null) {
  response.status(status).json({
    error: {
      code,
      message,
      details,
      requestId,
    },
  })
}

export function notFoundHandler(request, response) {
  sendError(
    response,
    request.id,
    404,
    'NOT_FOUND',
    'The requested resource was not found.',
  )
}

export function errorHandler(error, request, response, next) {
  if (response.headersSent) {
    next(error)
    return
  }

  response.set('Cache-Control', 'no-store')

  if (error instanceof ZodError) {
    sendError(
      response,
      request.id,
      400,
      'VALIDATION_ERROR',
      'The request contains invalid fields.',
      error.issues.map((issue) => ({
        path: issue.path.join('.'),
        code: issue.code,
        message: issue.message,
      })),
    )
    return
  }

  if (error?.type === 'entity.parse.failed') {
    sendError(
      response,
      request.id,
      400,
      'INVALID_JSON',
      'The request body is not valid JSON.',
    )
    return
  }

  if (error instanceof ApiError) {
    sendError(
      response,
      request.id,
      error.status,
      error.code,
      error.expose ? error.message : 'An unexpected error occurred.',
      error.expose ? error.details : null,
    )
    return
  }

  if (error?.code === 11000) {
    sendError(
      response,
      request.id,
      409,
      'CONFLICT',
      'The request conflicts with an existing record.',
    )
    return
  }

  if (error?.name === 'CastError') {
    sendError(
      response,
      request.id,
      400,
      'INVALID_IDENTIFIER',
      'The supplied identifier is not valid.',
    )
    return
  }

  if (!env.IS_TEST) {
    console.error(`request_id=${request.id}`, error)
  }

  sendError(
    response,
    request.id,
    500,
    'INTERNAL_ERROR',
    'An unexpected error occurred. Use the request ID when contacting support.',
  )
}
