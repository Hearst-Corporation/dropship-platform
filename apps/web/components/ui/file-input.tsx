import { forwardRef } from 'react'

export const HiddenFileInput = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { label: string }
>(function HiddenFileInput({ label, className, ...props }, ref) {
  return <input ref={ref} type="file" aria-label={label} className="sr-only" {...props} />
})
