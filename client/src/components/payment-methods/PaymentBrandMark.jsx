import { cn } from '../../utils/cn.js'

const shell = cn(
  'inline-flex h-9 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-white',
)

function CardsMark() {
  return (
    <span className="flex flex-col items-center gap-0.5 leading-none">
      <span className="flex items-center gap-0.5">
        <span className="h-2 w-3 rounded-[2px] bg-[#eb001b]" />
        <span className="h-2 w-3 rounded-[2px] bg-[#f79e1b]" />
      </span>
      <span className="text-[0.4375rem] font-semibold tracking-tight text-[#007e7a]">
        Visa · mada
      </span>
    </span>
  )
}

function ApplePayMark() {
  return (
    <span className="inline-flex items-center gap-1 text-[#111]">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-[1.05rem] w-[1.05rem]"
        fill="currentColor"
      >
        <path d="M16.37 1.43c0 1.14-.47 2.22-1.23 3.02-.8.84-2.13 1.48-3.2 1.4-.13-1.1.43-2.27 1.17-3.02.83-.85 2.27-1.47 3.26-1.4Zm4.57 15.67c-.57 1.3-.84 1.88-1.57 3.03-1.02 1.6-2.47 3.6-4.26 3.61-1.59.02-2-.99-4.17-.98-2.17.01-2.62 1-4.21.98-1.79-.02-3.16-1.8-4.18-3.4C-.3 16.36-.62 11.2 1.07 8.5c1.2-1.9 3.1-3.02 4.88-3.02 1.81 0 2.95 1 4.45 1 1.45 0 2.33-1 4.42-1 1.58 0 3.26.86 4.46 2.35-3.92 2.15-3.29 7.76.66 9.27Z" />
      </svg>
      <span className="text-[0.875rem] font-semibold tracking-[-0.03em]">
        Pay
      </span>
    </span>
  )
}

const marks = {
  card: CardsMark,
  apple_pay: ApplePayMark,
}

export function PaymentBrandMark({ methodId, className }) {
  const Mark = marks[methodId]

  return (
    <span aria-hidden="true" className={cn(shell, className)}>
      {Mark ? <Mark /> : <span className="text-xs font-semibold">Pay</span>}
    </span>
  )
}
