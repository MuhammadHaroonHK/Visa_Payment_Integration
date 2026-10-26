export class ApiError extends Error {
  constructor(message, options = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = options.status ?? 500
    this.code = options.code ?? 'INTERNAL_ERROR'
    this.details = options.details ?? null
    this.expose = options.expose ?? this.status < 500
  }
}

export function isApiError(error) {
  return error instanceof ApiError
}

export function notFoundError(message = 'The requested resource was not found.') {
  return new ApiError(message, {
    status: 404,
    code: 'NOT_FOUND',
  })
}

export function validationError(message, details = null) {
  return new ApiError(message, {
    status: 400,
    code: 'VALIDATION_ERROR',
    details,
  })
}
