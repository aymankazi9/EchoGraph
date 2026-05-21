'use client'

import { forwardRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

interface PassphraseInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const PassphraseInput = forwardRef<HTMLInputElement, PassphraseInputProps>(
  ({ label, error, id, ...props }, ref) => {
    const [visible, setVisible] = useState(false)
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-label text-text-secondary tracking-wide"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={visible ? 'text' : 'password'}
            autoComplete={props.autoComplete ?? 'current-password'}
            className={[
              'w-full h-9 px-2.5 pr-9',
              'bg-bg-input border rounded-input',
              'text-body text-text-primary',
              'placeholder:text-text-tertiary',
              'transition-colors duration-75',
              'focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40',
              error
                ? 'border-rose-400 ring-1 ring-red-200/40'
                : 'border-border-default',
            ]
              .filter(Boolean)
              .join(' ')}
            {...props}
          />
          <button
            type="button"
            aria-label={visible ? 'Hide passphrase' : 'Show passphrase'}
            tabIndex={-1}
            onClick={() => setVisible((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors"
          >
            {visible ? (
              <EyeOff size={14} strokeWidth={1.5} />
            ) : (
              <Eye size={14} strokeWidth={1.5} />
            )}
          </button>
        </div>
        {error && <p className="text-label text-rose-300">{error}</p>}
      </div>
    )
  },
)
PassphraseInput.displayName = 'PassphraseInput'
