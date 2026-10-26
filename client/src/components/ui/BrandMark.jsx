import { cn } from '../../utils/cn.js'

export function BrandMark({ className }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.55rem] bg-brand text-[0.8125rem] font-semibold tracking-tight text-[#f7f4ee]',
        className,
      )}
    >
      S
    </span>
  )
}
