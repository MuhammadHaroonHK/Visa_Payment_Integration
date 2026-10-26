export class ApiError extends Error {
  constructor(message, options = {}) {
    super(message)
    this.name = 'ApiError'
    this.code = options.code ?? 'UNEXPECTED_ERROR'
    this.status = options.status ?? 500
    this.details = options.details ?? null
  }
}
