import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageShell } from '../components/layout/PageShell.jsx'

export function NotFoundPage() {
  return (
    <PageShell>
      <div className="mx-auto flex max-w-xl flex-col items-start px-4 py-20 sm:px-6">
        <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
          404
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">
          Page not found
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          The checkout route you requested does not exist in this demo.
        </p>
        <Link
          to="/checkout"
          className="mt-5 inline-flex min-h-11 items-center gap-1.5 rounded-control border border-brand bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Go to checkout
        </Link>
      </div>
    </PageShell>
  )
}
