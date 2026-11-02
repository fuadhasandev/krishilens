import { useState, type FormEvent } from 'react'
import { LoaderCircle, Send } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, Card, Textarea } from './ui'
import { VoiceRecorder } from './VoiceRecorder'
import type { VoiceAuthorization } from '../services/voice'

interface FarmerQuestionProps {
  mode: 'start' | 'answer'
  title: string
  prompt?: { question: string; why: string }
  loading: boolean
  onSubmit: (answer: string) => Promise<boolean>
  authorization?: VoiceAuthorization
}

export function FarmerQuestion({
  mode,
  title,
  prompt,
  loading,
  onSubmit,
  authorization,
}: FarmerQuestionProps) {
  const { t, i18n } = useTranslation()
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
      className="space-y-4 rounded-2xl border border-[#d6e2d3] bg-[#fbfcf9] p-4 sm:p-5"
      onSubmit={handleSubmit}
    >
      <div>
        <h3 className="font-semibold text-[#183b2c]">{title}</h3>
        {prompt && (
          <Card className="mt-3 p-4">
            <p className="text-sm font-semibold leading-6 text-[#183b2c]">
              {prompt.question}
            </p>
            <p className="mt-2 text-sm leading-6 text-[#617166]">{prompt.why}</p>
          </Card>
        )}
      </div>
      <label className="block text-sm font-medium text-[#31513b]">
        {t('questions.answer')}
        <Textarea
          autoComplete="off"
          maxLength={2000}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder={t(i18n.resolvedLanguage === 'bn' ? 'questions.answerPlaceholderBn' : 'questions.answerPlaceholder')}
          required
          value={answer}
        />
      </label>
      <VoiceRecorder
        authorization={authorization}
        disabled={loading}
        onTranscript={setAnswer}
      />
      <Button
        className="min-h-12"
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
      </Button>
    </form>
  )
}
