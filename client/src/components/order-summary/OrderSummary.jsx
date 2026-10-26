import { Coffee, ShieldCheck, Tag } from 'lucide-react'
import { useId } from 'react'
import { formatCurrency, formatQuantity } from '../../utils/format.js'
import { cn } from '../../utils/cn.js'

function Amount({ children, className }) {
  return (
    <span className={cn('tabular-nums', className)}>{children}</span>
  )
}

export function OrderSummary({
  order,
  totals,
  variant = 'card',
  showHeading = true,
}) {
  const headingId = useId()

  if (!order || !totals) return null

  const currency = totals.currency ?? order.currency

  return (
    <section
      aria-labelledby={showHeading ? headingId : undefined}
      className={cn(
        variant === 'card' &&
          'rounded-card border border-line bg-white p-5 sm:p-6',
      )}
    >
      {showHeading ? (
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={headingId} className="text-base font-semibold text-ink">
              Order summary
            </h2>
            <p className="mt-1 font-mono text-[0.6875rem] tracking-tight text-subtle">
              {order.reference}
            </p>
          </div>
          <span className="rounded-full border border-line bg-canvas px-2.5 py-0.5 text-[0.6875rem] font-medium text-muted">
            {currency}
          </span>
        </div>
      ) : null}

      <ul className={cn('space-y-4', showHeading && 'mt-5')}>
        {totals.items.map((item) => (
          <li key={item.id} className="flex gap-3">
            <div
              aria-hidden="true"
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-[#e7e0d4] bg-[#f4efe6] text-[#7f6a4f]"
            >
              <Coffee className="h-6 w-6" strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-5 font-medium text-ink text-pretty">
                {item.name}
              </p>
              <p className="mt-0.5 text-xs text-muted">{item.description}</p>
              <div className="mt-1.5 flex items-center justify-between gap-3 text-xs text-muted">
                <span>Qty {formatQuantity(item.quantity)}</span>
                <Amount className="text-ink">
                  {formatCurrency(item.lineTotalMinor, currency, order.locale)}
                </Amount>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {totals.discountMinor > 0 ? (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-dashed border-line bg-canvas px-3 py-2 text-xs text-muted">
          <Tag aria-hidden="true" className="h-3.5 w-3.5 text-brand" />
          <span>
            <span className="font-semibold text-ink">
              {order.discount.code}
            </span>{' '}
            applied
          </span>
          <Amount className="ml-auto font-medium text-emerald-700">
            −{formatCurrency(totals.discountMinor, currency, order.locale)}
          </Amount>
        </div>
      ) : null}

      <dl className="mt-5 space-y-2.5 border-t border-line pt-5 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-muted">Subtotal</dt>
          <dd>
            <Amount>
              {formatCurrency(totals.subtotalMinor, currency, order.locale)}
            </Amount>
          </dd>
        </div>

        {totals.discountMinor > 0 ? (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted">Discount</dt>
            <dd className="text-emerald-700">
              <Amount>
                −{formatCurrency(totals.discountMinor, currency, order.locale)}
              </Amount>
            </dd>
          </div>
        ) : null}

        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-muted">{order.tax.label}</dt>
          <dd>
            <Amount>
              {formatCurrency(totals.taxMinor, currency, order.locale)}
            </Amount>
          </dd>
        </div>

        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-muted">{order.shipping.label}</dt>
          <dd>
            {totals.shippingMinor === 0 ? (
              <span className="text-emerald-700">Free</span>
            ) : (
              <Amount>
                {formatCurrency(
                  totals.shippingMinor,
                  currency,
                  order.locale,
                )}
              </Amount>
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-5 flex items-end justify-between gap-4 border-t border-line pt-5">
        <div>
          <p className="text-sm font-semibold text-ink">Total</p>
          <p className="mt-0.5 text-[0.6875rem] text-subtle">
            Includes VAT · {currency}
          </p>
        </div>
        <p className="text-xl font-semibold tracking-tight text-ink">
          <Amount>
            {formatCurrency(totals.totalMinor, currency, order.locale)}
          </Amount>
        </p>
      </div>

      <p className="mt-4 flex items-start gap-1.5 text-[0.6875rem] leading-4 text-subtle">
        <ShieldCheck
          aria-hidden="true"
          className="mt-px h-3.5 w-3.5 shrink-0 text-brand"
          strokeWidth={1.8}
        />
        The server recalculates the final amount before creating a Checkout.com
        payment session.
      </p>
    </section>
  )
}

export function MobileOrderSummary({ order, totals }) {
  if (!order || !totals) return null

  return (
    <details className="group rounded-card border border-line bg-white lg:hidden">
      <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          Order summary
          <span className="font-mono text-[0.625rem] font-normal text-subtle">
            {order.reference}
          </span>
        </span>
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          {formatCurrency(
            totals.totalMinor,
            totals.currency ?? order.currency,
            order.locale,
          )}
          <span
            aria-hidden="true"
            className="text-subtle transition-transform group-open:rotate-180"
          >
            ▾
          </span>
        </span>
      </summary>
      <div className="border-t border-line px-4 py-4">
        <OrderSummary
          order={order}
          totals={totals}
          variant="plain"
          showHeading={false}
        />
      </div>
    </details>
  )
}
