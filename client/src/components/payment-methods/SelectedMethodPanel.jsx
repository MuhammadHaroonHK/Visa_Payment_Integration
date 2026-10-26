import { ArrowUpRight, ShieldCheck } from 'lucide-react'
import {
  getAvailability,
  getPaymentMethod,
} from '../../data/paymentMethods.js'
import { Alert } from '../ui/Alert.jsx'

export function SelectedMethodPanel({ methodId, method: providedMethod }) {
  const method = providedMethod ?? getPaymentMethod(methodId)

  if (!method) return null

  const availability = getAvailability(method)

  return (
    <div className="mt-4 space-y-3">
      {!availability.canProceed ? (
        <Alert tone="warning" title="This method is not available">
          {method.requirement}. Choose another method or check the server
          configuration before continuing.
        </Alert>
      ) : null}

      <div className="rounded-card border border-line bg-white px-4 py-3.5">
        <div className="flex items-start gap-2.5">
          <ShieldCheck
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0 text-brand"
            strokeWidth={1.8}
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-ink uppercase">
              Integration note
            </p>
            <p className="mt-1 text-sm leading-6 text-muted text-pretty">
              {method.detail}
            </p>
            <a
              href={method.docsUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-brand underline decoration-brand-line underline-offset-4 hover:decoration-brand"
            >
              Read the provider guidance
              <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
