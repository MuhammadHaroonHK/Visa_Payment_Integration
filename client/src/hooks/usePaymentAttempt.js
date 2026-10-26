import { useEffect, useState } from 'react'
import { checkoutService } from '../services/checkoutService.js'

export function usePaymentAttempt(
  attemptId,
  { providerPaymentId = null, verifyStored = false } = {},
) {
  const [state, setState] = useState({
    status: 'loading',
    attempt: null,
    error: null,
  })

  useEffect(() => {
    let isCurrent = true

    async function load() {
      try {
        let attempt

        if (providerPaymentId || verifyStored) {
          try {
            attempt = (
              await checkoutService.verifyPayment(
                attemptId,
                providerPaymentId,
              )
            ).payment
          } catch (verificationError) {
            if (verificationError?.status !== 404) {
              throw verificationError
            }

            attempt = await checkoutService.getPaymentAttempt(attemptId)
          }
        } else {
          attempt = await checkoutService.getPaymentAttempt(attemptId)
        }

        if (!isCurrent) return

        if (!attempt) {
          setState({ status: 'not_found', attempt: null, error: null })
          return
        }

        setState({ status: 'ready', attempt, error: null })
      } catch (error) {
        if (isCurrent) {
          setState({
            status: error?.status === 404 ? 'not_found' : 'error',
            attempt: null,
            error,
          })
        }
      }
    }

    load()

    return () => {
      isCurrent = false
    }
  }, [attemptId, providerPaymentId, verifyStored])

  return state
}
