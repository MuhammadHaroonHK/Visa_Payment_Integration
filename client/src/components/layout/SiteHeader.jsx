import { Link } from 'react-router-dom'
import { LockKeyhole } from 'lucide-react'
import { BrandMark } from '../ui/BrandMark.jsx'
import { Badge } from '../ui/Badge.jsx'

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          to="/checkout"
          className="flex min-h-11 items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-4"
        >
          <BrandMark />
          <span className="leading-none">
            <span className="block text-[0.9375rem] font-semibold tracking-tight text-ink">
              Sahla
            </span>
            <span className="mt-1 block text-[0.5625rem] font-medium tracking-[0.16em] text-subtle uppercase">
              Demo storefront
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <Badge tone="brand" dot={false}>
            Checkout.com
          </Badge>
          <span className="hidden h-4 w-px bg-line sm:block" />
          <span className="hidden items-center gap-1.5 text-xs text-muted sm:flex">
            <LockKeyhole
              aria-hidden="true"
              className="h-3.5 w-3.5"
              strokeWidth={1.8}
            />
            Secure checkout
          </span>
        </div>
      </div>
    </header>
  )
}
