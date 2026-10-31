import { useState, type FormEvent } from 'react'
import { LoaderCircle, Send } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface FarmerQuestionProps {
  mode: 'start' | 'answer'
  title: string
  prompt?: { question: string; why: string }
  loading: boolean
  onSubmit: (answer: string) => Promise<boolean>
}

export function FarmerQuestion({
  mode,
  title,
  prompt,
  loading,
  onSubmit,
}: FarmerQuestionProps) {
  const { t } = useTranslation()
  const [answer, setAnswer] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = answer.trim()
    if (!value) {
      return
    }
    if (await onSubmit(value)) {
      setAnswer('')
    }
  }

  return (
    <form
      className="space-y-4 rounded-2xl border border-[#dce6d6] bg-[#f7f8f2] p-4 sm:p-5"
      onSubmit={handleSubmit}
    >
      <div>
        <h3 className="font-semibold text-[#183b2c]">{title}</h3>
        {prompt && (
          <div className="mt-3 rounded-xl border border-[#e5ebdf] bg-white p-4">
            <p className="text-sm font-semibold leading-6 text-[#183b2c]">
              {prompt.question}
            </p>
            <p className="mt-2 text-sm leading-6 text-[#617166]">{prompt.why}</p>
          </div>
        )}
      </div>
      <label className="block text-sm font-medium text-[#31513b]">
        {t('questions.answer')}
        <textarea
          autoComplete="off"
          className="mt-2 min-h-24 w-full resize-y rounded-xl border border-[#dce6d6] bg-white px-3 py-3 text-base leading-6 text-[#183b2c] outline-none placeholder:text-[#89968b] focus:border-[#4c8456] focus:ring-2 focus:ring-[#4c8456]/20"
          maxLength={2000}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder={t('questions.answerPlaceholder')}
          aria-invalid={Boolean(!answer.trim())}
          value={answer}
        />
      </label>
      <button
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1f603f] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#194d33] focus:outline-none focus:ring-2 focus:ring-[#4c8456] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={loading || !answer.trim()}
        type="submit"
      >
        {loading ? (
          <>
            <LoaderCircle aria-hidden="true" className="animate-spin" size={17} />
            {mode === 'start' ? t('questions.sending') : t('questions.continuing')}
          </>
        ) : (
          <>
            {mode === 'start' ? t('questions.start') : t('questions.send')}
            <Send aria-hidden="true" size={16} />
          </>
        )}
      </button>
    </form>
  )
}
