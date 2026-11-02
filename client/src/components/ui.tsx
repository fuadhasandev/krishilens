import { useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { ArrowLeft, Leaf, LoaderCircle, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from './LanguageSwitcher'

type ButtonVariant = 'primary' | 'secondary' | 'quiet'

const buttonStyles: Record<ButtonVariant, string> = {
  primary: 'bg-[#174D35] text-white shadow-sm hover:bg-[#103d29] focus-visible:ring-[#2F855A]',
  secondary: 'border border-[#d6e2d3] bg-white text-[#174D35] hover:bg-[#f1f5ed] focus-visible:ring-[#2F855A]',
  quiet: 'bg-transparent text-[#315d3d] hover:bg-[#EAF4E8] focus-visible:ring-[#2F855A]',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${buttonStyles[variant]} ${className}`}
      {...props}
    />
  )
}

export function Card({
  as: Element = 'section',
  className = '',
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: 'article' | 'section' }) {
  return (
    <Element
      className={`rounded-2xl border border-[#e2e9de] bg-white shadow-[0_8px_24px_rgba(23,77,53,0.04)] ${className}`}
      {...props}
    />
  )
}

export function Badge({
  children,
  tone = 'green',
}: {
  children: ReactNode
  tone?: 'green' | 'amber' | 'neutral' | 'red'
}) {
  const tones = {
    green: 'bg-[#EAF4E8] text-[#174D35]',
    amber: 'bg-[#fff4df] text-[#76551f]',
    neutral: 'bg-[#f0f2ed] text-[#566258]',
    red: 'bg-[#fff0ec] text-[#854735]',
  }
  return (
    <span className={`inline-flex max-w-full items-center rounded-full px-3 py-1.5 text-xs font-semibold leading-5 ${tones[tone]}`}>
      {children}
    </span>
  )
}

const fieldStyles = 'mt-2 min-h-12 w-full rounded-xl border border-[#d6e2d3] bg-[#fbfcf9] px-3 text-base text-[#183b2c] outline-none transition focus:border-[#2F855A] focus:ring-2 focus:ring-[#2F855A]/20'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldStyles} ${props.className ?? ''}`} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${fieldStyles} ${props.className ?? ''}`} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${fieldStyles} min-h-28 resize-y py-3 leading-6 ${props.className ?? ''}`} />
}

export function Alert({
  children,
  tone = 'error',
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { tone?: 'error' | 'warning' | 'success' }) {
  const tones = {
    error: 'border-[#f1d4cd] bg-[#fff7f4] text-[#854735]',
    warning: 'border-[#eee2bd] bg-[#fffaf0] text-[#705c2f]',
    success: 'border-[#d6e2d3] bg-[#EAF4E8] text-[#174D35]',
  }
  return (
    <div className={`rounded-xl border p-4 text-sm leading-6 ${tones[tone]} ${className}`} {...props}>
      {children}
    </div>
  )
}

export function LoadingState({ children }: { children: ReactNode }) {
  return (
    <div aria-live="polite" className="flex items-center gap-3 text-sm text-[#617166]" role="status">
      <LoaderCircle aria-hidden="true" className="shrink-0 animate-spin text-[#2F855A] motion-reduce:animate-none" size={18} />
      {children}
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#cbd8c4] bg-white/70 p-6 text-sm leading-6 text-[#617166]">
      {children}
    </div>
  )
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  className = '',
  headingLevel = 2,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  className?: string
  headingLevel?: 1 | 2
}) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2'
  return (
    <div className={className}>
      {eyebrow && <p className="text-sm font-semibold text-[#2F855A]">{eyebrow}</p>}
      <Heading className="mt-1 text-2xl font-semibold tracking-tight text-[#174D35] sm:text-3xl">{title}</Heading>
      {description && <p className="mt-3 max-w-2xl text-sm leading-6 text-[#617166] sm:text-base">{description}</p>}
    </div>
  )
}

export function PageHeader({
  backTo,
  backLabel,
  children,
}: {
  backTo: string
  backLabel: string
  children?: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 py-4 sm:px-8 sm:py-5">
      <div className="flex min-w-0 items-center gap-3">
        <Link aria-label={backLabel} className="flex size-10 shrink-0 items-center justify-center rounded-full text-[#315d3d] transition hover:bg-[#EAF4E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F855A]" to={backTo}>
          <ArrowLeft aria-hidden="true" size={20} />
        </Link>
        <Link aria-label={t('navigation.home')} className="flex items-center gap-2 font-bold tracking-tight text-[#174D35]" to="/">
          <span className="flex size-9 items-center justify-center rounded-xl bg-[#174D35] text-white">
            <Leaf aria-hidden="true" size={19} />
          </span>
          <span className="hidden text-lg sm:inline">KrishiLens</span>
        </Link>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        {children}
        <LanguageSwitcher />
      </div>
    </header>
  )
}

export function Modal({
  open,
  title,
  closeLabel,
  onClose,
  children,
}: {
  open: boolean
  title: string
  closeLabel: string
  onClose: () => void
  children: ReactNode
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      aria-labelledby="modal-title"
      className="w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-[#e2e9de] bg-[#FAF9F5] p-0 text-[#183b2c] shadow-2xl backdrop:bg-[#173c2c]/45"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose()
      }}
      ref={dialogRef}
    >
      <div className="flex items-center justify-between border-b border-[#e2e9de] px-5 py-4">
        <h2 className="text-lg font-semibold" id="modal-title">{title}</h2>
        <button aria-label={closeLabel} className="flex size-10 items-center justify-center rounded-full hover:bg-[#EAF4E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F855A]" onClick={onClose} type="button">
          <X aria-hidden="true" size={18} />
        </button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>
  )
}
