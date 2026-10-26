import { useEffect, useRef, useState } from 'react'
import { Spinner } from '../ui/Spinner.jsx'
import { Alert } from '../ui/Alert.jsx'
import { checkoutService } from '../../services/checkoutService.js'

const SCRIPT_URL =
  'https://checkout-web-components.checkout.com/index.js'

let scriptPromise = null

function loadCheckoutScript() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('The browser environment is unavailable.'))
  }

  if (window.CheckoutWebComponents) {
    return Promise.resolve(window.CheckoutWebComponents)
  }

  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.dataset.checkoutWebComponents = 'true'
    script.addEventListener(
      'load',
      () => {
        if (window.CheckoutWebComponents) {
          resolve(window.CheckoutWebComponents)
        } else {
          scriptPromise = null
          reject(new Error('Checkout.com Flow did not initialise.'))
        }
      },
      { once: true },
    )
    script.addEventListener(
      'error',
      () => {
        script.remove()
        scriptPromise = null
        reject(
          new Error(
            'Checkout.com Flow could not be loaded. Check your connection and try again.',
          ),
        )
      },
      { once: true },
    )
    document.head.appendChild(script)
  })

  return scriptPromise
}

function flowEnvironment(environment) {
  return environment === 'live' ? 'production' : 'sandbox'
}

function flowLocale(locale) {
  return locale === 'ar-SA' ? 'ar' : 'en-GB'
}

const APPLE_PAY_SCHEMES = new Set([
  'american_express',
  'cartes_bancaires',
  'china_union_pay',
  'discover',
  'jcb',
  'mada',
  'mastercard',
  'visa',
])

function componentOptions(cardSchemes) {
  const schemes = cardSchemes?.length
    ? cardSchemes
    : ['visa', 'mastercard', 'mada']
  const applePaySchemes = schemes.filter((scheme) =>
    APPLE_PAY_SCHEMES.has(scheme),
  )

  return {
    flow: {
      acceptedCardSchemes: schemes,
      expandFirstPaymentMethod: true,
    },
    card: {
      acceptedCardSchemes: schemes,
      displayCardholderName: 'bottom',
    },
    applepay: {
      ...(applePaySchemes.length
        ? { acceptedCardSchemes: applePaySchemes }
        : {}),
      buttonColor: 'black',
      buttonType: 'plain',
    },
  }
}

export function CheckoutFlow({
  payment,
  onVerified,
  onVerificationError,
}) {
  const containerRef = useRef(null)
  const onVerifiedRef = useRef(onVerified)
  const onVerificationErrorRef = useRef(onVerificationError)
  const [state, setState] = useState({
    status: 'loading',
    message: null,
  })

  useEffect(() => {
    onVerifiedRef.current = onVerified
  }, [onVerified])

  useEffect(() => {
    onVerificationErrorRef.current = onVerificationError
  }, [onVerificationError])

  const session = payment.flow?.session
  const publicKey = payment.flow?.publicKey
  const componentName =
    payment.flow?.component === 'applepay' ? 'applepay' : 'card'
  const environment = payment.flow?.environment
  const cardSchemes = payment.flow?.cardSchemes

  useEffect(() => {
    let cancelled = false
    let component = null

    async function mountFlow() {
      if (!session || !publicKey) {
        setState({
          status: 'unavailable',
          message:
            'The server did not return a usable Checkout.com Payment Session. Return to checkout and try again.',
        })
        return
      }

      setState({ status: 'loading', message: null })

      try {
        const CheckoutWebComponents = await loadCheckoutScript()

        if (cancelled) return

        const checkout = await CheckoutWebComponents({
          publicKey,
          environment: flowEnvironment(environment),
          locale: flowLocale(payment.order?.locale),
          paymentSession: session,
          componentOptions: componentOptions(cardSchemes),
          onError: (_component, error) => {
            if (cancelled) return
            setState({
              status: 'error',
              message:
                error?.message ??
                'Checkout.com Flow reported an error. Please try again.',
            })
          },
          onPaymentCompleted: async (_component, paymentResponse) => {
            if (cancelled) return

            if (!paymentResponse?.id) {
              setState({
                status: 'error',
                message:
                  'Checkout.com did not return a payment reference. The payment status could not be verified.',
              })
              return
            }

            setState({ status: 'confirming', message: null })

            try {
              const result = await checkoutService.verifyPayment(
                payment.id,
                paymentResponse.id,
              )

              if (!cancelled) {
                onVerifiedRef.current?.(result)
              }
            } catch (error) {
              if (cancelled) return

              if (onVerificationErrorRef.current) {
                onVerificationErrorRef.current(paymentResponse.id, error)
              } else {
                setState({
                  status: 'error',
                  message:
                    error?.message ??
                    'The payment status could not be verified by the server.',
                })
              }
            }
          },
        })

        if (cancelled) return

        component = checkout.create(componentName, {
          onReady: () => {
            if (!cancelled) setState({ status: 'ready', message: null })
          },
          onError: (_component, error) => {
            if (cancelled) return
            setState({
              status: 'error',
              message:
                error?.message ??
                'Checkout.com Flow reported an error. Please try again.',
            })
          },
        })

        const available = await component.isAvailable()

        if (cancelled) return

        if (!available) {
          setState({
            status: 'unavailable',
            message:
              componentName === 'applepay'
                ? 'Apple Pay is not available on this device or browser. Choose Cards to pay with a card instead.'
                : 'The card payment form is not available for this payment session. Return to checkout and try again.',
          })
          return
        }

        component.mount(containerRef.current)
        setState({ status: 'ready', message: null })
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'error',
            message:
              error?.message ??
              'Checkout.com Flow could not be loaded. Please try again.',
          })
        }
      }
    }

    mountFlow()

    return () => {
      cancelled = true
      try {
        component?.unmount?.()
      } catch {
        // The provider component may already be unmounted by a redirect.
      }
    }
  }, [
    session,
    publicKey,
    componentName,
    environment,
    cardSchemes,
    payment.id,
    payment.order?.locale,
  ])

  return (
    <div aria-busy={state.status === 'loading' || state.status === 'confirming'}>
      {state.status === 'loading' ? (
        <div className="mt-5 flex items-center gap-2 rounded-control border border-line bg-canvas px-4 py-3 text-sm text-muted">
          <Spinner label="Loading Checkout.com Flow" />
          Connecting to Checkout.com…
        </div>
      ) : null}

      {state.status === 'confirming' ? (
        <div className="mt-5 flex items-center gap-2 rounded-control border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <Spinner label="Confirming payment" />
          Confirming the payment with the server…
        </div>
      ) : null}

      {state.status === 'unavailable' || state.status === 'error' ? (
        <Alert
          tone={state.status === 'error' ? 'danger' : 'warning'}
          title={
            state.status === 'error'
              ? 'Checkout.com Flow could not continue'
              : 'Payment method unavailable'
          }
          role={state.status === 'error' ? 'alert' : undefined}
          className="mt-5"
        >
          {state.message}
        </Alert>
      ) : null}

      <div
        ref={containerRef}
        className={state.status === 'error' || state.status === 'unavailable'
          ? 'hidden'
          : 'mt-5 min-h-24'}
      />
    </div>
  )
}
