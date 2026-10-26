import {
  Ban,
  ChevronDown,
  CircleCheck,
  CircleX,
  Clock3,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '../ui/Badge.jsx'
import { INTERNAL_PAYMENT_STATUS } from '../../data/paymentStatus.js'
import { formatCurrency, formatDateTime } from '../../utils/format.js'
import { cn } from '../../utils/cn.js'
import { buttonClassName } from '../ui/buttonStyles.js'

const icons = {
  success: CircleCheck,
  pending: Clock3,
  declined: CircleX,
  cancelled: Ban,
  error: TriangleAlert,
}

const toneStyles = {
  positive: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  info: 'border-sky-200 bg-sky-50 text-sky-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  danger: 'border-rose-200 bg-rose-50 text-rose-700',
  neutral: 'border-stone-200 bg-stone-100 text-stone-600',
}

function verificationNotice(attempt) {
  const verified = ['provider', 'webhook'].includes(
    attempt.verification?.source,
  )

  if (verified) {
    return {
      className: 'border-emerald-200 bg-emerald-50/70 text-emerald-950',
      iconClassName: 'text-emerald-700',
      Icon: ShieldCheck,
      title: 'Server-verified result.',
      text: 'The server confirmed this status with Checkout.com. A browser callback alone is never treated as proof.',
    }
  }

  return {
    className: 'border-amber-200 bg-amber-50/70 text-amber-950',
    iconClassName: 'text-amber-700',
    Icon: ShieldAlert,
    title: 'Not yet confirmed by Checkout.com.',
    text: 'This page shows the stored server status. The payment is not treated as complete until a provider status check or a signed webhook confirms it.',
  }
}

export function PaymentResultView({
  attempt,
  view,
  primaryAction,
  secondaryAction,
  headingLevel = 1,
}) {
  const Icon = icons[view.icon] ?? CircleX
  const statusKey = attempt.status ?? view.status
  const internalStatus =
    INTERNAL_PAYMENT_STATUS[statusKey] ?? INTERNAL_PAYMENT_STATUS.UNKNOWN
  const Heading = headingLevel === 2 ? 'h2' : 'h1'
  const notice = verificationNotice(attempt)
  const NoticeIcon = notice.Icon
  const verified = ['provider', 'webhook'].includes(
    attempt.verification?.source,
  )
  const verificationRule = verified
    ? 'the server checked the provider status endpoint and authenticates webhook signatures before updating this payment.'
    : 'the frontend callback and success URL are never proof of payment. The server must verify the provider status or a signed webhook before fulfilling the order.'

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div
        className={cn(
          'rounded-card border px-4 py-3',
          notice.className,
        )}
      >
        <p className="flex items-start gap-2 text-xs leading-5">
          <NoticeIcon
            aria-hidden="true"
            className={cn('mt-0.5 h-4 w-4 shrink-0', notice.iconClassName)}
            strokeWidth={1.8}
          />
          <span>
            <strong className="font-semibold">{notice.title}</strong>{' '}
            {notice.text}
          </span>
        </p>
      </div>

      <section
        aria-labelledby="result-heading"
        className="mt-3 rounded-card border border-line bg-white p-6 sm:p-8"
      >
        <div className="flex flex-col items-center text-center">
          <span
            aria-hidden="true"
            className={cn(
              'flex h-14 w-14 items-center justify-center rounded-full border',
              toneStyles[view.tone] ?? toneStyles.neutral,
            )}
          >
            <Icon className="h-7 w-7" strokeWidth={1.6} />
          </span>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Badge tone={internalStatus.tone}>
              {internalStatus.label}
            </Badge>
          </div>

          <Heading
            id="result-heading"
            className="mt-4 text-2xl font-semibold tracking-tight text-ink text-balance sm:text-3xl"
          >
            {view.title}
          </Heading>
          <p className="mt-2 max-w-lg text-sm leading-6 text-muted text-pretty">
            {view.description}
          </p>
        </div>

        <dl className="mt-6 grid gap-3 rounded-control border border-line bg-canvas p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[0.6875rem] font-medium tracking-wide text-subtle uppercase">
              Amount
            </dt>
            <dd className="mt-1 font-semibold text-ink">
              {formatCurrency(attempt.amountMinor, attempt.currency)}
            </dd>
          </div>
          <div>
            <dt className="text-[0.6875rem] font-medium tracking-wide text-subtle uppercase">
              Method
            </dt>
            <dd className="mt-1 font-medium text-ink">{attempt.methodName}</dd>
          </div>
          <div>
            <dt className="text-[0.6875rem] font-medium tracking-wide text-subtle uppercase">
              Order reference
            </dt>
            <dd className="mt-1 font-mono text-xs text-ink">
              {attempt.orderReference}
            </dd>
          </div>
          <div>
            <dt className="text-[0.6875rem] font-medium tracking-wide text-subtle uppercase">
              Payment reference
            </dt>
            <dd className="mt-1 truncate font-mono text-xs text-ink">
              {attempt.id}
            </dd>
          </div>
        </dl>

        <div className="mt-6 border-t border-line pt-5">
          <h2 className="text-sm font-semibold text-ink">What happens next</h2>
          <ol className="mt-3 space-y-2.5">
            {view.nextSteps.map((step, index) => (
              <li key={step} className="flex items-start gap-2.5">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line bg-canvas text-[0.625rem] font-semibold text-muted"
                >
                  {index + 1}
                </span>
                <span className="text-sm leading-5 text-muted">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-5 rounded-control border border-line bg-white px-4 py-3">
          <p className="text-xs leading-5 text-muted text-pretty">
            <strong className="font-semibold text-ink">
              Verification rule:
            </strong>{' '}
            {verificationRule}
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          {primaryAction ? (
            <Link
              reloadDocument={primaryAction.reloadDocument}
              to={primaryAction.to}
              className={buttonClassName({
                variant: 'primary',
                size: 'md',
                className: 'flex-1',
              })}
            >
              {primaryAction.label}
            </Link>
          ) : null}
          {secondaryAction ? (
            <Link
              to={secondaryAction.to}
              className={buttonClassName({
                variant: 'secondary',
                size: 'md',
                className: 'flex-1',
              })}
            >
              {secondaryAction.label}
            </Link>
          ) : null}
        </div>

        <details className="group mt-5 border-t border-line pt-4">
          <summary className="group/summary inline-flex min-h-8 cursor-pointer items-center gap-1.5 text-xs font-medium text-muted hover:text-ink">
            Developer details
            <ChevronDown
              aria-hidden="true"
              className="h-3.5 w-3.5 transition-transform group-open:rotate-180"
            />
          </summary>
          <dl className="mt-3 grid gap-2 text-[0.6875rem] sm:grid-cols-2">
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-subtle">Internal status</dt>
              <dd className="font-mono text-muted">{statusKey}</dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-subtle">Provider</dt>
              <dd className="font-mono text-muted">
                {attempt.providerLabel}
              </dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-subtle">Provider status</dt>
              <dd className="font-mono text-muted">
                {attempt.providerStatus ?? 'Not reported'}
              </dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-subtle">Mode</dt>
              <dd className="font-mono text-muted">{attempt.mode}</dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-subtle">Verification</dt>
              <dd className="font-mono text-muted">
                {attempt.verification?.source ?? 'none'}
              </dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-subtle">Created</dt>
              <dd className="font-mono text-muted">
                {formatDateTime(attempt.createdAt)}
              </dd>
            </div>
          </dl>
        </details>
      </section>
    </div>
  )
}
