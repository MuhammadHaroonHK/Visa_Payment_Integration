import { ApiError } from '../domain/errors.js'

function issueDetails(issues) {
  return issues.map((issue) => ({
    path: issue.path.join('.'),
    code: issue.code,
    message: issue.message,
  }))
}

/**
 * Validates and replaces request input with the parsed, stripped value. Routes
 * never read raw request fields for pricing or provider decisions.
 */
export function validate(schemas) {
  return (request, _response, next) => {
    try {
      request.validated = request.validated ?? {}

      for (const [source, schema] of Object.entries(schemas)) {
        const result = schema.safeParse(request[source])

        if (!result.success) {
          throw new ApiError('The request contains invalid fields.', {
            status: 400,
            code: 'VALIDATION_ERROR',
            details: issueDetails(result.error.issues),
          })
        }

        request.validated[source] = result.data
      }

      next()
    } catch (error) {
      next(error)
    }
  }
}
