import { useState, type FormEvent } from 'react'
import { LoaderCircle, Send } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { analyzeCrop } from '../services/cropAnalysis'
import { currentLanguage } from '../i18n'
import { Alert, Button, Select, Textarea } from './ui'
import { VoiceRecorder } from './VoiceRecorder'
import type {
  Crop,
  CropAnalysisResponse,
  ResponseLanguage,
} from '../types/cropAnalysis'

const crops: Crop[] = ['rice', 'wheat', 'maize', 'jute', 'other']

export function CropInvestigationForm() {
  const { t, i18n } = useTranslation()
  const [crop, setCrop] = useState<Crop>('rice')
  const [question, setQuestion] = useState('')
  const [responseLanguage, setResponseLanguage] = useState<ResponseLanguage>(currentLanguage())
  const [result, setResult] = useState<CropAnalysisResponse | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (question.trim().length < 3) {
      setError('validation.questionMin')
      return
    }
    const requestLanguage = currentLanguage()
    setIsLoading(true)
    setError('')
    setResult(null)

    try {
      setResult(await analyzeCrop({ crop, question, language: requestLanguage }))
      setResponseLanguage(requestLanguage)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'ANALYSIS_FAILED')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section
      aria-labelledby="investigation-title"
      className="mx-auto w-full max-w-3xl rounded-3xl border border-[#e2e9de] bg-white p-5 shadow-[0_12px_36px_rgba(23,77,53,0.06)] sm:p-8"
      id="investigate"
    >
      <div className="mb-6">
        <p className="text-sm font-semibold text-[#4c8456]">{t('home.textPreview')}</p>
        <h2
          className="mt-1 text-2xl font-semibold tracking-tight text-[#183b2c] sm:text-3xl"
          id="investigation-title"
        >
          {t('home.tellUs')}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#617166]">
          {t('home.intro')}
        </p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-[#31513b]">
          {t('common.crop')}
          <Select
            onChange={(event) => setCrop(event.target.value as Crop)}
            value={crop}
          >
            {crops.map((value) => (
              <option key={value} value={value}>
                {t(`common.${value}`)}
              </option>
            ))}
          </Select>
        </label>

        <label className="block text-sm font-medium text-[#31513b]">
          {t('home.observations')}
          <Textarea
            autoComplete="off"
            maxLength={2000}
            onChange={(event) => {
              setQuestion(event.target.value)
              setError('')
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'crop-question-error' : undefined}
            placeholder={t('home.example')}
            value={question}
          />
          <span className="mt-1 block text-right text-xs text-[#7b887e]">
            {new Intl.NumberFormat(i18n.resolvedLanguage).format(question.length)}/
            {new Intl.NumberFormat(i18n.resolvedLanguage).format(2000)}
          </span>
        </label>
        <VoiceRecorder
          onTranscript={(transcript) => {
            setQuestion(transcript)
            setError('')
          }}
        />

        <Button
          className="w-full sm:w-auto sm:text-base"
          disabled={isLoading || question.trim().length < 3}
          type="submit"
        >
          {isLoading ? (
            <>
              <LoaderCircle aria-hidden="true" className="animate-spin" size={18} />
              {t('home.analyzing')}
            </>
          ) : (
            <>
              {t('home.submit')}
              <Send aria-hidden="true" size={17} />
            </>
          )}
        </Button>
      </form>

      {error && (
        <Alert aria-live="polite" className="mt-6" role="alert">
          <span id="crop-question-error">
            {error.startsWith('validation.')
              ? t(error, { defaultValue: t('validation.questionMin') })
              : t(`errors.${error}`, { defaultValue: t('errors.ANALYSIS_FAILED') })}
          </span>
        </Alert>
      )}

      {result?.success && (
        <article
          aria-live="polite"
          className="mt-6 rounded-2xl border border-[#dce6d6] bg-[#f7f8f2] p-5 sm:p-6"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-[#183b2c]">{t('home.resultTitle')}</h3>
            <span className="rounded-full bg-[#e9f1e4] px-3 py-1 text-xs font-medium text-[#326548]">
              {result.model}
            </span>
          </div>
          {responseLanguage !== currentLanguage() && (
            <p className="mb-3 text-xs text-[#7b887e]">
              {t('investigation.reportLanguage', {
                language: t(responseLanguage === 'bn' ? 'common.bangla' : 'common.english'),
              })}
            </p>
          )}
          <p className="whitespace-pre-wrap text-sm leading-7 text-[#46564a] sm:text-base">
            {result.answer}
          </p>
          {result.requestId && (
            <p className="mt-4 break-all text-xs text-[#7b887e]">
              {t('home.requestId', { id: result.requestId })}
            </p>
          )}
        </article>
      )}
    </section>
  )
}
