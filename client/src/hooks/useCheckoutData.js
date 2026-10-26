import { useCallback, useEffect, useState } from 'react'
import { checkoutService } from '../services/checkoutService.js'

export function useCheckoutData() {
  const [state, setState] = useState({
    status: 'loading',
    data: null,
    error: null,
  })
  const [requestKey, setRequestKey] = useState(0)

  useEffect(() => {
    let isCurrent = true

    async function load() {
      try {
        const data = await checkoutService.getCheckoutData()

        if (isCurrent) {
          setState({ status: 'ready', data, error: null })
        }
      } catch (error) {
        if (isCurrent) {
          setState({
            status: 'error',
            data: null,
            error,
          })
        }
      }
    }

    load()

    return () => {
      isCurrent = false
    }
  }, [requestKey])

  const retry = useCallback(() => {
    setState({ status: 'loading', data: null, error: null })
    setRequestKey((value) => value + 1)
  }, [])

  return { ...state, retry }
}
