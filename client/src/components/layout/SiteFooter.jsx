export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium text-ink">
              Sahla demo storefront
            </p>
            <p className="mt-1 max-w-xl text-[0.6875rem] leading-5 text-subtle text-pretty">
              A Checkout.com Flow integration for Cards and Apple Pay. Payment
              actions and order fulfilment are verified by the server.
            </p>
          </div>

          <nav
            aria-label="Payment resources"
            className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs"
          >
            <a
              href="https://www.checkout.com/docs/payments/accept-payments/accept-a-payment-on-your-website/get-started-with-flow"
              target="_blank"
              rel="noreferrer"
              className="min-h-8 rounded-sm text-muted underline decoration-line underline-offset-4 hover:text-ink hover:decoration-line-strong"
            >
              Flow documentation
            </a>
            <a
              href="https://www.checkout.com/docs/payments/add-payment-methods"
              target="_blank"
              rel="noreferrer"
              className="min-h-8 rounded-sm text-muted underline decoration-line underline-offset-4 hover:text-ink hover:decoration-line-strong"
            >
              Payment methods
            </a>
          </nav>
        </div>
      </div>
    </footer>
  )
}
