import { PaymentMethodCard } from './PaymentMethodCard.jsx'

export function PaymentMethodList({ methods, value, onChange }) {
  return (
    <fieldset className="mt-4 min-w-0 space-y-3">
      <legend className="sr-only">Payment method</legend>

      {methods.map((method) => (
        <PaymentMethodCard
          key={method.id}
          method={method}
          selected={value === method.id}
          onSelect={onChange}
        />
      ))}
    </fieldset>
  )
}
