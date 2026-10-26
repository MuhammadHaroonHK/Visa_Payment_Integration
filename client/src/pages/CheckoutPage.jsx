import { zodResolver } from '@hookform/resolvers/zod'
import { LockKeyhole, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useController, useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { CheckoutSkeleton } from '../components/checkout/CheckoutSkeleton.jsx'
import { CheckoutSteps } from '../components/checkout/CheckoutSteps.jsx'
import {
  MobileOrderSummary,
  OrderSummary,
} from '../components/order-summary/OrderSummary.jsx'
import { PaymentMethodList } from '../components/payment-methods/PaymentMethodList.jsx'
import { SelectedMethodPanel } from '../components/payment-methods/SelectedMethodPanel.jsx'
import { Alert } from '../components/ui/Alert.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Spinner } from '../components/ui/Spinner.jsx'
import { TextField } from '../components/ui/TextField.jsx'
import { checkoutCustomer } from '../data/checkoutDefaults.js'
import {
  getPaymentMethod,
  isMethodActionable,
} from '../data/paymentMethods.js'
import { useCheckoutData } from '../hooks/useCheckoutData.js'
import { checkoutService } from '../services/checkoutService.js'
import { formatCurrency } from '../utils/format.js'
import { PageShell } from '../components/layout/PageShell.jsx'

const checkoutSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Enter your full name.')
    .max(80, 'Name is too long.'),
  email: z
    .string()
    .trim()
    .min(1, 'Enter your email address.')
    .email('Enter a valid email address.'),
  paymentMethod: z.string().min(1, 'Choose a payment method.'),
})

export function CheckoutPage() {
  const navigate = useNavigate()
  const { status, data, error, retry } = useCheckoutData()
  const [submitError, setSubmitError] = useState(null)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      fullName: checkoutCustomer.fullName,
      email: checkoutCustomer.email,
      paymentMethod: 'card',
    },
  })

  const { field: paymentMethodField } = useController({
    name: 'paymentMethod',
    control,
  })

  const selectedMethodId = paymentMethodField.value
  const selectedMethod =
    data?.methods?.find((method) => method.id === selectedMethodId) ??
    getPaymentMethod(selectedMethodId)
  const providerConfigured = data?.meta?.providerConfigured !== false
  const canSubmit =
    providerConfigured && isMethodActionable(selectedMethod)

  async function onSubmit(values) {
    setSubmitError(null)

    try {
      const { session } = await checkoutService.createPaymentSession({
        orderId: data.order.id,
        methodId: values.paymentMethod,
        customer: {
          fullName: values.fullName.trim(),
          email: values.email.trim(),
        },
      })

      navigate(`/payment/${session.id}`)
    } catch (submissionError) {
      setSubmitError(
        submissionError?.message ??
          'We could not prepare the payment. Please try again.',
      )
    }
  }

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <CheckoutSteps current="payment" />
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <LockKeyhole
              aria-hidden="true"
              className="h-3.5 w-3.5 text-brand"
              strokeWidth={1.8}
            />
            No card details stored
          </p>
        </div>

        <div className="mt-8 max-w-2xl">
          <p className="text-[0.6875rem] font-semibold tracking-[0.18em] text-brand uppercase">
            Riwāq home
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink text-balance sm:text-4xl">
            Complete your order
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted text-pretty sm:text-base">
            Review your details and choose Cards or Apple Pay. Card details are
            entered only inside Checkout.com Flow.
          </p>
        </div>

        {status === 'loading' ? <CheckoutSkeleton /> : null}

        {status === 'error' ? (
          <div className="mt-8 max-w-2xl">
            <Alert
              tone="danger"
              title="Checkout could not be loaded"
              role="alert"
            >
              <p>
                {error?.message ??
                  'The checkout data could not be loaded. Try again.'}
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={retry}
              >
                Retry
              </Button>
            </Alert>
          </div>
        ) : null}

        {status === 'ready' ? (
          <>
            <div className="mt-6 lg:hidden">
              <MobileOrderSummary order={data.order} totals={data.totals} />
            </div>

            {!providerConfigured ? (
              <Alert
                tone="warning"
                title="Checkout.com is not configured on this server"
                className="mt-6 max-w-2xl"
              >
                Add the Checkout.com API prefix, public key and secret key to
                the server environment. Configure the webhook signing key before
                relying on asynchronous payment confirmation. Payment methods
                stay disabled until the provider is configured.
              </Alert>
            ) : null}

            <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px] xl:gap-10">
              <form
                noValidate
                onSubmit={handleSubmit(onSubmit)}
                aria-busy={isSubmitting}
                className="space-y-6"
              >
                <section
                  aria-labelledby="contact-heading"
                  className="rounded-card border border-line bg-white p-5 sm:p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2
                        id="contact-heading"
                        className="text-base font-semibold text-ink"
                      >
                        Contact details
                      </h2>
                      <p className="mt-1 text-sm text-muted">
                        Used to create the payment session and receipt.
                      </p>
                    </div>
                    <span className="shrink-0 text-xs whitespace-nowrap text-subtle">
                      Step 1
                    </span>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <TextField
                      id="customer-name"
                      label="Full name"
                      autoComplete="name"
                      required
                      error={errors.fullName?.message}
                      {...register('fullName')}
                    />
                    <TextField
                      id="customer-email"
                      label="Email address"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      required
                      hint="Used for the payment receipt."
                      error={errors.email?.message}
                      {...register('email')}
                    />
                  </div>
                </section>

                <section
                  aria-labelledby="payment-heading"
                  aria-describedby="payment-methods-note"
                  className="rounded-card border border-line bg-white p-5 sm:p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2
                        id="payment-heading"
                        className="text-base font-semibold text-ink"
                      >
                        Payment method
                      </h2>
                      <p
                        id="payment-methods-note"
                        className="mt-1 text-sm text-muted text-pretty"
                      >
                        Cards and Apple Pay are processed by Checkout.com Flow.
                        Availability is resolved by the server.
                      </p>
                    </div>
                    <span className="shrink-0 text-xs whitespace-nowrap text-subtle">
                      Step 2
                    </span>
                  </div>

                  <PaymentMethodList
                    methods={data.methods}
                    value={selectedMethodId}
                    onChange={(methodId) => {
                      setSubmitError(null)
                      paymentMethodField.onChange(methodId)
                    }}
                  />

                  {errors.paymentMethod ? (
                    <p className="mt-3 text-xs text-rose-700" role="alert">
                      {errors.paymentMethod.message}
                    </p>
                  ) : null}

                  <SelectedMethodPanel
                    methodId={selectedMethodId}
                    method={selectedMethod}
                  />
                </section>

                <section
                  aria-labelledby="payment-action-heading"
                  className="rounded-card border border-line bg-white p-5 sm:p-6"
                >
                  <h2 id="payment-action-heading" className="sr-only">
                    Continue to payment
                  </h2>

                  {submitError ? (
                    <Alert
                      tone="danger"
                      title="Payment could not be started"
                      role="alert"
                      className="mb-4"
                    >
                      {submitError}
                    </Alert>
                  ) : null}

                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs text-muted">Total due</p>
                      <p className="mt-1 text-lg font-semibold tracking-tight text-ink">
                        {formatCurrency(
                          data.totals.totalMinor,
                          data.totals.currency,
                          data.order.locale,
                        )}
                      </p>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="mt-4 w-full"
                    disabled={isSubmitting || !canSubmit}
                  >
                    {isSubmitting ? (
                      <>
                        <Spinner label="Preparing payment" />
                        Preparing secure payment…
                      </>
                    ) : (
                      <>
                        <LockKeyhole
                          aria-hidden="true"
                          className="h-4 w-4"
                          strokeWidth={2}
                        />
                        Continue to payment
                      </>
                    )}
                  </Button>

                  <p className="mt-3 flex items-start justify-center gap-1.5 text-center text-[0.6875rem] leading-4 text-subtle">
                    <ShieldCheck
                      aria-hidden="true"
                      className="mt-px h-3.5 w-3.5 shrink-0"
                      strokeWidth={1.8}
                    />
                    Payment details are collected inside Checkout.com Flow. The
                    browser callback is never treated as proof; the server
                    verifies the provider status.
                  </p>
                </section>
              </form>

              <aside className="hidden lg:sticky lg:top-6 lg:block">
                <OrderSummary order={data.order} totals={data.totals} />

                <div className="mt-4 rounded-card border border-line bg-white px-5 py-4">
                  <p className="text-xs font-semibold text-ink">
                    Need help with your order?
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    Payments are processed by Checkout.com. For integration
                    questions, refer to the Flow documentation.
                  </p>
                  <a
                    href="https://www.checkout.com/docs/payments/accept-payments/accept-a-payment-on-your-website/get-started-with-flow"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex min-h-8 items-center text-xs font-semibold text-brand underline decoration-brand-line underline-offset-4 hover:decoration-brand"
                  >
                    Open provider docs
                  </a>
                </div>
              </aside>
            </div>
          </>
        ) : null}
      </div>
    </PageShell>
  )
}
