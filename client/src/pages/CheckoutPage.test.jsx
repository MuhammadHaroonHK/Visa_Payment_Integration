import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderApp } from '../test/renderApp.jsx'
import {
  makeAttempt,
  testCheckoutData,
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

describe('CheckoutPage', () => {
  beforeEach(() => {
    mocks.getCheckoutData.mockResolvedValue(testCheckoutData)
    mocks.createPaymentSession.mockResolvedValue({
      session: makeAttempt(),
    })
    mocks.getPaymentAttempt.mockResolvedValue(makeAttempt())
    mocks.verifyPayment.mockResolvedValue({
      payment: makeAttempt(),
    })
  })

  it('renders the order summary and exactly Cards and Apple Pay', async () => {
    renderApp('/checkout')

    expect(
      await screen.findByRole('heading', {
        name: 'Complete your order',
        level: 1,
      }),
    ).toBeInTheDocument()

    expect(
      screen.getAllByText(/SAR\s1,378\.85/).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText('ORD-2026-1042').length,
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText('Riwāq Home Espresso Machine').length,
    ).toBeGreaterThan(0)

    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(2)
    expect(screen.getByRole('radio', { name: /^Cards/ })).toBeEnabled()
    expect(
      screen.getByRole('radio', { name: /^Apple Pay/ }),
    ).toBeEnabled()
    expect(screen.getByRole('radio', { name: /^Cards/ })).toBeChecked()
    for (const name of [/^Mada/, /^Visa/, /^STC Pay/, /^Tabby/]) {
      expect(
        screen.queryByRole('radio', { name }),
      ).not.toBeInTheDocument()
    }
  })

  it('shows the selected method guidance', async () => {
    const user = userEvent.setup()
    renderApp('/checkout')

    const applePay = await screen.findByRole('radio', {
      name: /^Apple Pay/,
    })
    await user.click(applePay)

    expect(
      screen.getByText(/The domain must be onboarded with Checkout\.com/),
    ).toBeInTheDocument()
  })

  it('submits the default Cards method and opens the payment step', async () => {
    const user = userEvent.setup()
    renderApp('/checkout')

    await user.click(
      await screen.findByRole('button', {
        name: /Continue to payment/,
      }),
    )

    await waitFor(() => {
      expect(mocks.createPaymentSession).toHaveBeenCalledWith({
        orderId: 'ord_test_1',
        methodId: 'card',
        customer: {
          fullName: 'Layla Al-Harbi',
          email: 'layla@example.com',
        },
      })
    })

    expect(
      await screen.findByRole(
        'heading',
        { name: 'Complete your payment', level: 1 },
        { timeout: 3000 },
      ),
    ).toBeInTheDocument()
  })

  it('submits Apple Pay when it is selected', async () => {
    const user = userEvent.setup()
    renderApp('/checkout')

    await user.click(
      await screen.findByRole('radio', { name: /^Apple Pay/ }),
    )
    await user.click(
      screen.getByRole('button', { name: /Continue to payment/ }),
    )

    await waitFor(() => {
      expect(mocks.createPaymentSession).toHaveBeenCalledWith(
        expect.objectContaining({ methodId: 'apple_pay' }),
      )
    })
  })

  it('disables payment when the server is not configured', async () => {
    mocks.getCheckoutData.mockResolvedValue({
      ...testCheckoutData,
      methods: testMethods.map((method) => ({
        ...method,
        availability: 'unavailable',
        selectable: false,
        providerReady: false,
      })),
      meta: {
        ...testCheckoutData.meta,
        providerConnected: false,
        providerConfigured: false,
        publicKey: null,
        applePayEnabled: false,
      },
    })

    renderApp('/checkout')

    expect(
      await screen.findByText(
        'Checkout.com is not configured on this server',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Continue to payment/ }),
    ).toBeDisabled()
  })

  it('shows a safe error when the Payment Session cannot be created', async () => {
    const user = userEvent.setup()
    mocks.createPaymentSession.mockRejectedValue(
      new Error('The payment provider is unavailable.'),
    )

    renderApp('/checkout')

    await user.click(
      await screen.findByRole('button', {
        name: /Continue to payment/,
      }),
    )

    expect(
      await screen.findByText('The payment provider is unavailable.'),
    ).toBeInTheDocument()
  })
})
