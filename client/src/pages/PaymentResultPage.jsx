import { ArrowLeft } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { PageShell } from '../components/layout/PageShell.jsx'
import { PaymentResultView } from '../components/payment-status/PaymentResultView.jsx'
import { Alert } from '../components/ui/Alert.jsx'
import { Skeleton } from '../components/ui/Skeleton.jsx'
import {
  getResultViewForStatus,
  RESULT_VIEWS,
} from '../data/paymentStatus.js'
import { usePaymentAttempt } from '../hooks/usePaymentAttempt.js'

export function PaymentResultPage() {
  const { attemptId } = useParams()
  const [searchParams] = useSearchParams()
  const providerPaymentId =
    searchParams.get('cko-payment-id') ??
    searchParams.get('cko-session-id')
  const { status, attempt, error } = usePaymentAttempt(attemptId, {
    providerPaymentId,
    verifyStored: searchParams.get('verify') === '1',
  })

  if (status === 'loading') {
    return (
      <PageShell>
        <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-5 h-[34rem] rounded-card" />
        </div>
      </PageShell>
    )
  }

  if (status === 'error') {
    const retrySearch = searchParams.toString()

    return (
      <PageShell>
        <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
          <Alert
            tone="danger"
            title="Payment status could not be verified"
            role="alert"
          >
            <p>
              {error?.message ??
                'The server could not reach the provider to confirm this payment.'}
            </p>
            <p className="mt-2">
              Do not start another payment. Retry the server verification, or
              check the Checkout.com dashboard and server logs if the problem
              persists.
            </p>
            <Link
              reloadDocument
              to={`/payment/${attemptId}/result${
                retrySearch ? `?${retrySearch}` : ''
              }`}
              className="mt-3 inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-brand underline decoration-brand-line underline-offset-4"
            >
              Retry verification
            </Link>
          </Alert>
        </div>
      </PageShell>
    )
  }

  if (status === 'not_found' || !attempt) {
    return (
      <PageShell>
        <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
          <Alert tone="danger" title="Payment not found" role="alert">
            <p>
              The payment record is no longer available. Return to checkout to
              start again.
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
      </PageShell>
    )
  }

  const view = getResultViewForStatus(attempt.status) ?? RESULT_VIEWS.error
  const isUnsettled = [
    'CREATED',
    'REQUIRES_ACTION',
    'PENDING',
    'AUTHORIZED',
    'UNKNOWN',
  ].includes(attempt.status)
  const canContinuePayment =
    attempt.status === 'REQUIRES_ACTION' || attempt.status === 'CREATED'
  const primaryAction = canContinuePayment
    ? { to: `/payment/${attemptId}`, label: 'Continue payment' }
    : isUnsettled
      ? {
          to: `/payment/${attemptId}/result?verify=1`,
          label: 'Refresh status',
          reloadDocument: true,
        }
      : { to: '/checkout', label: view.actionLabel }
  const secondaryAction = isUnsettled
    ? null
    : {
        to: `/payment/${attemptId}`,
        label: 'Back to payment step',
      }

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 lg:py-12">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Link
            to={`/payment/${attemptId}`}
            className="inline-flex min-h-9 items-center gap-1.5 text-xs font-medium text-muted hover:text-ink"
          >
            <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
            Back to payment step
          </Link>
          <span className="text-[0.6875rem] font-medium tracking-[0.14em] text-subtle uppercase">
            Payment result
          </span>
        </div>

        <PaymentResultView
          attempt={attempt}
          view={view}
          primaryAction={primaryAction}
          secondaryAction={secondaryAction}
        />
      </div>
    </PageShell>
  )
}
