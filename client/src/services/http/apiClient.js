import axios from 'axios'
import { ApiError } from '../ApiError.js'

/**
 * HTTP client for this application's API. Only public, non-secret values belong
 * in Vite environment variables. The Checkout.com secret key is server-only.
 */
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 15000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const payload = error.response?.data
    const safeError = payload?.error ?? {}

    return Promise.reject(
      new ApiError(
        safeError.message ?? 'The payment service could not be reached.',
        {
          code: safeError.code ?? 'NETWORK_ERROR',
          status: error.response?.status ?? 0,
          details: safeError.details ?? null,
        },
      ),
    )
  },
)
