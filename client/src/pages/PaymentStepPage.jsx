import { useCallback } from 'react'
import {
  ArrowLeft,
  ArrowUpRight,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CheckoutSteps } from '../components/checkout/CheckoutSteps.jsx'
import { PageShell } from '../components/layout/PageShell.jsx'
import { OrderSummary } from '../components/order-summary/OrderSummary.jsx'
import { CheckoutFlow } from '../components/payment/CheckoutFlow.jsx'
import { PaymentBrandMark } from '../components/payment-methods/PaymentBrandMark.jsx'
import { Alert } from '../components/ui/Alert.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Skeleton } from '../components/ui/Skeleton.jsx'
import {
  getAvailability,
  getPaymentMethod,
} from '../data/paymentMethods.js'
import { INTERNAL_PAYMENT_STATUS } from '../data/paymentStatus.js'
import { usePaymentAttempt } from '../hooks/usePaymentAttempt.js'
import { formatCurrency, formatDateTime } from '../utils/format.js'

const WAITING_STATUSES = new Set([
  'PENDING',
  'AUTHORIZED',
  'UNKNOWN',
])

function canReturnToCheckout(status) {
  return !WAITING_STATUSES.has(status)
}

function LoadingState() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8"
    >
      <span className="sr-only">Loading payment session</span>
      <Skeleton className="h-3 w-32" />
      <Skeleton className="mt-4 h-9 w-80 max-w-full" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Skeleton className="h-96 rounded-card" />
        <Skeleton className="h-96 rounded-card" />
      </div>
    </div>
  )
}

function SessionMissing({ error }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <Alert
        tone="danger"
        title={error ? 'The payment could not be loaded' : 'Payment not found'}
        role="alert"
      >
        <p>
          {error?.message ??
            'This payment record is not available. Return to checkout and start again.'}
        </p>
        <Link
          to="/checkout"
          className="mt-3 inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-brand underline decoration-brand-line underline-offset-4"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Return to checkout
        </Link>
      </Alert>
    </div>
  )
}

function modeLabel(mode) {
  if (mode === 'sandbox') return 'Sandbox'
  if (mode === 'live') return 'Live'
  return 'Unknown'
}

export function PaymentStepPage() {
  const { attemptId } = useParams()
  const navigate = useNavigate()
  const { status, attempt, error } = usePaymentAttempt(attemptId)

  const handleVerified = useCallback(() => {
    navigate(`/payment/${attemptId}/result`)
  }, [attemptId, navigate])

  const handleVerificationError = useCallback(
    (providerPaymentId) => {
      navigate(
        `/payment/${attemptId}/result?cko-payment-id=${encodeURIComponent(
          providerPaymentId,
        )}`,
      )
    },
    [attemptId, navigate],
  )

  if (status === 'loading') {
    return (
      <PageShell>
        <LoadingState />
      </PageShell>
    )
  }

  if (status === 'not_found' || status === 'error' || !attempt) {
    return (
      <PageShell>
        <SessionMissing error={status === 'error' ? error : null} />
      </PageShell>
    )
  }

  const method =
    attempt.method ?? getPaymentMethod(attempt.methodId) ?? {
      availability: attempt.methodAvailability,
    }
  const availability = getAvailability(method)
  const statusConfig =
    INTERNAL_PAYMENT_STATUS[attempt.status] ?? INTERNAL_PAYMENT_STATUS.UNKNOWN
  const hasFlowSession = Boolean(attempt.flow?.session)
  const canMountFlow =
    attempt.status === 'REQUIRES_ACTION' && hasFlowSession
  const hasRecordedResult = attempt.status !== 'REQUIRES_ACTION'
  const isWaiting = WAITING_STATUSES.has(attempt.status)

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <CheckoutSteps current="payment" />
          <Link
            to="/checkout"
            className="inline-flex min-h-9 items-center gap-1.5 text-xs font-medium text-muted hover:text-ink"
          >
            <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
            Back to checkout
          </Link>
        </div>

        <div className="mt-8 max-w-2xl">
          <p className="text-[0.6875rem] font-semibold tracking-[0.18em] text-brand uppercase">
            Secure payment
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink text-balance sm:text-4xl">
            Complete your payment
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted text-pretty">
            {formatCurrency(attempt.amountMinor, attempt.currency)} is due for
            order {attempt.orderReference}.
          </p>
        </div>

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <section
              aria-labelledby="selected-method-heading"
              className="rounded-card border border-line bg-white p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2
                  id="selected-method-heading"
                  className="text-base font-semibold text-ink"
                >
                  Selected payment method
                </h2>
                <Link
                  to="/checkout"
                  className="inline-flex min-h-8 items-center text-xs font-semibold text-brand underline decoration-brand-line underline-offset-4 hover:decoration-brand"
                >
                  Change
                </Link>
              </div>

              <div className="mt-4 flex items-center gap-3 rounded-control border border-line bg-canvas p-3.5">
                <PaymentBrandMark methodId={attempt.methodId} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-ink">
                      {attempt.methodName}
                    </p>
                    <Badge tone={availability.tone}>
                      {availability.label}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {attempt.providerLabel}
                  </p>
                </div>
              </div>
            </section>

            <section
              aria-labelledby="flow-heading"
              className="rounded-card border border-line bg-white p-5 sm:p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2
                    id="flow-heading"
                    className="text-base font-semibold text-ink"
                  >
                    Payment details
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    {attempt.methodId === 'apple_pay'
                      ? 'Apple Pay is presented by Checkout.com Flow.'
                      : 'Card details are collected inside Checkout.com Flow.'}
                  </p>
                </div>
                <LockKeyhole
                  aria-hidden="true"
                  className="h-4 w-4 text-brand"
                  strokeWidth={1.8}
                />
              </div>

              {hasRecordedResult ? (
                <div className="mt-5 rounded-card border border-line bg-canvas p-5">
                  <p className="text-sm font-semibold text-ink">
                    This payment is {isWaiting ? 'still' : 'already'}{' '}
                    {statusConfig.label.toLowerCase()}.
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    {isWaiting
                      ? 'The provider has not settled this attempt yet. The server will not start another payment for this order while it is resolving. Check the recorded result or wait for the signed webhook to update it.'
                      : 'The server will not accept another payment for this attempt. Open the recorded result, or return to checkout to start a new payment.'}
                  </p>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Link
                      to={`/payment/${attempt.id}/result`}
                      className="inline-flex min-h-10 items-center justify-center rounded-control border border-brand bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-brand-strong hover:bg-brand-strong"
                    >
                      View recorded result
                    </Link>
                    {canReturnToCheckout(attempt.status) ? (
                      <Link
                        to="/checkout"
                        className="inline-flex min-h-10 items-center justify-center rounded-control border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-line-strong hover:bg-canvas"
                      >
                        Return to checkout
                      </Link>
                    ) : null}
                  </div>
                </div>
              ) : canMountFlow ? (
                <CheckoutFlow
                  payment={attempt}
                  onVerified={handleVerified}
                  onVerificationError={handleVerificationError}
                />
              ) : (
                <Alert
                  tone="warning"
                  title="Checkout.com session unavailable"
                  className="mt-5"
                >
                  The server could not provide a usable Checkout.com Payment
                  Session for this attempt. Return to checkout and start a new
                  payment.
                </Alert>
              )}
            </section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-6">
            <OrderSummary
              order={attempt.order}
              totals={attempt.totals}
              showHeading
            />

            <section
              aria-labelledby="session-details-heading"
              className="rounded-card border border-line bg-white px-5 py-4"
            >
              <h2
                id="session-details-heading"
                className="text-xs font-semibold text-ink"
              >
                Payment session
              </h2>
              <dl className="mt-3 space-y-2 text-[0.6875rem]">
                <div className="flex justify-between gap-4">
                  <dt className="text-subtle">Reference</dt>
                  <dd className="max-w-[12rem] truncate font-mono text-muted">
                    {attempt.id}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-subtle">Mode</dt>
                  <dd className="text-muted">{modeLabel(attempt.mode)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-subtle">Provider</dt>
                  <dd className="text-right text-muted">
                    {attempt.providerLabel}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-subtle">Status</dt>
                  <dd>
                    <Badge tone={statusConfig.tone}>{statusConfig.label}</Badge>
                  </dd>
                </div>
                {attempt.providerStatus ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-subtle">Provider status</dt>
                    <dd className="text-right text-muted">
                      {attempt.providerStatus}
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4">
                  <dt className="text-subtle">Created</dt>
                  <dd className="text-muted">
                    {formatDateTime(attempt.createdAt)}
                  </dd>
                </div>
              </dl>

              {hasRecordedResult ? (
                <Link
                  to={`/payment/${attempt.id}/result`}
                  className="mt-3 inline-flex min-h-8 items-center gap-1.5 text-xs font-semibold text-brand underline decoration-brand-line underline-offset-4 hover:decoration-brand"
                >
                  View recorded result
                  <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
                </Link>
              ) : null}
            </section>

            <p className="flex items-start gap-1.5 px-1 text-[0.6875rem] leading-4 text-subtle">
              <ShieldCheck
                aria-hidden="true"
                className="mt-px h-3.5 w-3.5 shrink-0"
                strokeWidth={1.8}
              />
              The server verifies the provider status. A browser callback or
              success URL is never treated as proof of payment.
            </p>
          </aside>
        </div>
      </div>
    </PageShell>
  )
}
