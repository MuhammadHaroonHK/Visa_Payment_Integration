import { act, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderApp } from '../test/renderApp.jsx'
import {
  makeAttempt,
  testMethods,
} from '../test/checkoutFixtures.js'

const mocks = vi.hoisted(() => ({
  getCheckoutData: vi.fn(),
  createPaymentSession: vi.fn(),
  getPaymentAttempt: vi.fn(),
  verifyPayment: vi.fn(),
}))

vi.mock('../services/checkoutService.js', () => ({
  checkoutService: mocks,
}))

let checkoutConfig
let component
let create

function installCheckoutWebComponents({ available = true } = {}) {
  component = {
    isAvailable: vi.fn().mockResolvedValue(available),
    mount: vi.fn(),
    unmount: vi.fn(),
  }
  create = vi.fn(() => component)
  window.CheckoutWebComponents = vi.fn(async (config) => {
    checkoutConfig = config
    return { create }
  })
}

describe('PaymentStepPage and PaymentResultPage', () => {
  beforeEach(() => {
    mocks.getPaymentAttempt.mockResolvedValue(makeAttempt())
    mocks.verifyPayment.mockResolvedValue({
      payment: makeAttempt({
        status: 'CAPTURED',
        providerStatus: 'Captured',
        verification: {
          source: 'provider',
          verifiedAt: '2026-10-26T08:05:00.000Z',
        },
        flow: {
          ...makeAttempt().flow,
          session: null,
        },
      }),
    })
    installCheckoutWebComponents()
  })

  afterEach(() => {
    delete window.CheckoutWebComponents
    checkoutConfig = null
    component = null
    create = null
  })

  it('mounts the Checkout.com card component with the Payment Session', async () => {
    renderApp('/payment/pmt_test_1')

    expect(
      await screen.findByRole(
        'heading',
        { name: 'Complete your payment', level: 1 },
        { timeout: 3000 },
      ),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Cards').length).toBeGreaterThan(0)
    expect(screen.queryByText('Demo simulation only')).not.toBeInTheDocument()

    await waitFor(() => {
      expect(window.CheckoutWebComponents).toHaveBeenCalledWith(
        expect.objectContaining({
          publicKey: 'pk_test_public',
          environment: 'sandbox',
          paymentSession: expect.objectContaining({ id: 'ps_test_1' }),
          componentOptions: expect.objectContaining({
            card: expect.objectContaining({
              acceptedCardSchemes: ['visa', 'mastercard', 'mada'],
            }),
          }),
        }),
      )
    })

    expect(create).toHaveBeenCalledWith('card', expect.any(Object))
    expect(component.mount).toHaveBeenCalledWith(expect.any(HTMLElement))
  })

  it('mounts the Apple Pay component for an Apple Pay attempt', async () => {
    mocks.getPaymentAttempt.mockResolvedValue(
      makeAttempt({
        methodId: 'apple_pay',
        methodName: 'Apple Pay',
        method: testMethods[1],
        flow: {
          ...makeAttempt().flow,
          component: 'applepay',
        },
      }),
    )

    renderApp('/payment/pmt_test_1')

    await screen.findByText('Apple Pay is presented by Checkout.com Flow.')
    await waitFor(() => {
      expect(create).toHaveBeenCalledWith('applepay', expect.any(Object))
    })
    expect(window.CheckoutWebComponents).toHaveBeenCalledWith(
      expect.objectContaining({
        componentOptions: expect.objectContaining({
          applepay: expect.objectContaining({
            acceptedCardSchemes: ['visa', 'mastercard', 'mada'],
          }),
        }),
      }),
    )
  })

  it('shows an unavailable message when Apple Pay cannot render', async () => {
    installCheckoutWebComponents({ available: false })
    mocks.getPaymentAttempt.mockResolvedValue(
      makeAttempt({
        methodId: 'apple_pay',
        methodName: 'Apple Pay',
        method: testMethods[1],
        flow: {
          ...makeAttempt().flow,
          component: 'applepay',
        },
      }),
    )

    renderApp('/payment/pmt_test_1')

    expect(
      await screen.findByText(
        /Apple Pay is not available on this device or browser/,
      ),
    ).toBeInTheDocument()
    expect(component.mount).not.toHaveBeenCalled()
  })

  it('verifies the synchronous provider result and opens the result page', async () => {
    mocks.getPaymentAttempt
      .mockResolvedValueOnce(makeAttempt())
      .mockResolvedValueOnce(
        makeAttempt({
          status: 'CAPTURED',
          providerStatus: 'Captured',
          verification: {
            source: 'provider',
            verifiedAt: '2026-10-26T08:05:00.000Z',
          },
          flow: {
            ...makeAttempt().flow,
            session: null,
          },
        }),
      )

    renderApp('/payment/pmt_test_1')

    await waitFor(() => {
      expect(checkoutConfig).toBeTruthy()
    })

    await act(async () => {
      await checkoutConfig.onPaymentCompleted({}, { id: 'pay_test_1' })
    })

    await waitFor(() => {
      expect(mocks.verifyPayment).toHaveBeenCalledWith(
        'pmt_test_1',
        'pay_test_1',
      )
    })

    expect(
      await screen.findByRole('heading', {
        name: 'Payment complete',
        level: 1,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('Server-verified result.')).toBeInTheDocument()
  })

  it('opens a safe retry when synchronous verification fails', async () => {
    mocks.verifyPayment.mockRejectedValue({
      status: 502,
      message: 'Checkout.com could not complete the request.',
    })

    renderApp('/payment/pmt_test_1')

    await waitFor(() => {
      expect(checkoutConfig).toBeTruthy()
    })

    await act(async () => {
      await checkoutConfig.onPaymentCompleted({}, { id: 'pay_test_1' })
    })

    expect(
      await screen.findByText('Payment status could not be verified'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Retry verification' }),
    ).toHaveAttribute(
      'href',
      '/payment/pmt_test_1/result?cko-payment-id=pay_test_1',
    )
    expect(mocks.verifyPayment).toHaveBeenCalledWith(
      'pmt_test_1',
      'pay_test_1',
    )
  })

  it('does not remount Flow while an authorization is unsettled', async () => {
    mocks.getPaymentAttempt.mockResolvedValue(
      makeAttempt({
        status: 'AUTHORIZED',
        providerStatus: 'Authorized',
        verification: {
          source: 'provider',
          verifiedAt: '2026-10-26T08:05:00.000Z',
        },
      }),
    )

    renderApp('/payment/pmt_test_1')

    expect(
      await screen.findByText(/This payment is still authorized/),
    ).toBeInTheDocument()
    expect(window.CheckoutWebComponents).not.toHaveBeenCalled()
    expect(component.mount).not.toHaveBeenCalled()
    expect(
      screen.queryByRole('link', { name: 'Return to checkout' }),
    ).not.toBeInTheDocument()
  })

  it('does not offer another checkout while a result is pending', async () => {
    mocks.getPaymentAttempt.mockResolvedValue(
      makeAttempt({
        status: 'PENDING',
        providerStatus: 'Pending',
        flow: {
          ...makeAttempt().flow,
          session: null,
        },
      }),
    )

    renderApp('/payment/pmt_test_1/result')

    expect(
      await screen.findByRole(
        'heading',
        { name: 'Payment pending', level: 1 },
        { timeout: 3000 },
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Refresh status' }),
    ).toHaveAttribute('href', '/payment/pmt_test_1/result?verify=1')
    expect(
      screen.queryByRole('link', { name: 'Return to checkout' }),
    ).not.toBeInTheDocument()
  })

  it('can refresh the stored provider status without creating a payment', async () => {
    mocks.verifyPayment.mockResolvedValue({
      payment: makeAttempt({
        status: 'PENDING',
        providerStatus: 'Pending',
        flow: {
          ...makeAttempt().flow,
          session: null,
        },
      }),
      verification: {
        verified: true,
        source: 'provider',
        verifiedAt: '2026-10-26T08:05:00.000Z',
        reason: null,
      },
    })

    renderApp('/payment/pmt_test_1/result?verify=1')

    expect(
      await screen.findByRole('heading', { name: 'Payment pending', level: 1 }),
    ).toBeInTheDocument()
    expect(mocks.verifyPayment).toHaveBeenCalledWith('pmt_test_1', null)
    expect(mocks.createPaymentSession).not.toHaveBeenCalled()
    expect(mocks.getPaymentAttempt).not.toHaveBeenCalled()
  })

  it('does not offer another checkout when result verification fails', async () => {
    mocks.verifyPayment.mockRejectedValue({
      status: 502,
      message: 'Checkout.com could not complete the request.',
    })

    renderApp('/payment/pmt_test_1/result?cko-payment-id=pay_uncertain_1')

    expect(
      await screen.findByText('Payment status could not be verified'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Do not start another payment/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Retry verification' }),
    ).toHaveAttribute(
      'href',
      '/payment/pmt_test_1/result?cko-payment-id=pay_uncertain_1',
    )
    expect(
      screen.queryByRole('link', { name: 'Return to checkout' }),
    ).not.toBeInTheDocument()
  })

  it('does not remount Flow for a final payment', async () => {
    mocks.getPaymentAttempt.mockResolvedValue(
      makeAttempt({
        status: 'CAPTURED',
        providerStatus: 'Captured',
        verification: {
          source: 'provider',
          verifiedAt: '2026-10-26T08:05:00.000Z',
        },
        flow: {
          ...makeAttempt().flow,
          session: null,
        },
      }),
    )

    renderApp('/payment/pmt_test_1')

    expect(
      await screen.findByText(/This payment is already captured/),
    ).toBeInTheDocument()
    expect(window.CheckoutWebComponents).not.toHaveBeenCalled()
    expect(component.mount).not.toHaveBeenCalled()
  })

  it('explains when the server did not return a Flow session', async () => {
    mocks.getPaymentAttempt.mockResolvedValue(
      makeAttempt({
        flow: null,
      }),
    )

    renderApp('/payment/pmt_test_1')

    expect(
      await screen.findByText('Checkout.com session unavailable'),
    ).toBeInTheDocument()
    expect(window.CheckoutWebComponents).not.toHaveBeenCalled()
  })
})
