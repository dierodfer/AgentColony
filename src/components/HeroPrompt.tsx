import { useEffect, useState } from 'react'
import type { KeyboardEvent } from 'react'

export function HeroPrompt({
  onAsk,
  onCancel,
  isRunning,
  disabled,
  externalValue,
}: {
  onAsk: (prompt: string) => void
  onCancel: () => void
  isRunning: boolean
  disabled: boolean
  externalValue?: string
}) {
  const [value, setValue] = useState('')

  useEffect(() => {
    if (externalValue) setValue(externalValue)
  }, [externalValue])

  const submit = () => {
    const prompt = value.trim()
    if (!prompt || isRunning || disabled) return
    onAsk(prompt)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="group rounded-2xl border border-line bg-surface p-2 transition-colors duration-200 focus-within:border-accent/45 focus-within:bg-surface-2">
        <div className="flex items-end gap-2">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder={
              disabled
                ? 'Añade especialistas para empezar a consultar…'
                : 'Plantea una petición a tu equipo de especialistas…'
            }
            disabled={disabled}
            className="min-h-[56px] flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] leading-relaxed text-white/90 outline-none placeholder:text-white/30 disabled:cursor-not-allowed"
          />
          {isRunning ? (
            <button
              onClick={onCancel}
              className="mb-1 shrink-0 rounded-xl border border-line-strong px-4 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              Detener
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={disabled || !value.trim()}
              className="mb-1 shrink-0 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-white/30"
            >
              Consultar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
