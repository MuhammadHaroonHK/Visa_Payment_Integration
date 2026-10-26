import { cn } from '../../utils/cn.js'

export function Skeleton({ className }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse rounded-md bg-stone-200/70 motion-reduce:animate-none',
        className,
      )}
    />
  )
}
