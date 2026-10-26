import { Skeleton } from '../ui/Skeleton.jsx'

export function CheckoutSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="mt-8">
      <span className="sr-only">Loading checkout details</span>

      <div className="rounded-card border border-line bg-white p-5">
        <Skeleton className="h-4 w-32" />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-11 w-full" />
          </div>
          <div>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-2 h-11 w-full" />
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-card border border-line bg-white p-5">
        <Skeleton className="h-4 w-36" />
        <div className="mt-5 space-y-3">
          {[0, 1].map((item) => (
            <div
              key={item}
              className="flex items-start gap-3 rounded-card border border-line p-4"
            >
              <Skeleton className="mt-0.5 h-4 w-4 rounded-full" />
              <Skeleton className="h-9 w-14" />
              <div className="flex-1">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="mt-2 h-3 w-full max-w-xs" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
