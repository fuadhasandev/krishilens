import { useState, type FormEvent } from 'react'
import { LoaderCircle, Send } from 'lucide-react'
import { analyzeCrop } from '../services/cropAnalysis'
import type {
  Crop,
  CropAnalysisResponse,
  ResponseLanguage,
} from '../types/cropAnalysis'

const crops: { value: Crop; label: string }[] = [
  { value: 'rice', label: 'Rice' },
  { value: 'wheat', label: 'Wheat' },
  { value: 'maize', label: 'Maize' },
  { value: 'jute', label: 'Jute' },
  { value: 'other', label: 'Other' },
]

export function CropInvestigationForm() {
  const [crop, setCrop] = useState<Crop>('rice')
  const [question, setQuestion] = useState('')
  const [language, setLanguage] = useState<ResponseLanguage>('bn')
  const [result, setResult] = useState<CropAnalysisResponse | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setError('')
    setResult(null)

    try {
      setResult(await analyzeCrop({ crop, question, language }))
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Something went wrong. Please try again.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section
      aria-labelledby="investigation-title"
      className="mx-auto w-full max-w-3xl rounded-3xl border border-[#e5ebdf] bg-white p-5 shadow-sm sm:p-8"
      id="investigate"
    >
      <div className="mb-6">
        <p className="text-sm font-semibold text-[#4c8456]">Text-only preview</p>
        <h2
          className="mt-1 text-2xl font-semibold tracking-tight text-[#183b2c] sm:text-3xl"
          id="investigation-title"
        >
          Tell us what you’ve noticed
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#617166]">
          Share your observations to get cautious, AI-generated guidance. No
          image is analyzed, and this is not a confirmed diagnosis.
        </p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-[#31513b]">
            Crop
            <select
              className="mt-2 min-h-12 w-full rounded-xl border border-[#dce6d6] bg-[#fbfcf9] px-3 text-base text-[#183b2c] outline-none focus:border-[#4c8456] focus:ring-2 focus:ring-[#4c8456]/20"
              onChange={(event) => setCrop(event.target.value as Crop)}
              value={crop}
            >
              {crops.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-[#31513b]">
            Response language
            <select
              className="mt-2 min-h-12 w-full rounded-xl border border-[#dce6d6] bg-[#fbfcf9] px-3 text-base text-[#183b2c] outline-none focus:border-[#4c8456] focus:ring-2 focus:ring-[#4c8456]/20"
              onChange={(event) =>
                setLanguage(event.target.value as ResponseLanguage)
              }
              value={language}
            >
              <option value="bn">Bangla</option>
              <option value="en">English</option>
            </select>
          </label>
        </div>

        <label className="block text-sm font-medium text-[#31513b]">
          What have you observed?
          <textarea
            autoComplete="off"
            className="mt-2 min-h-32 w-full resize-y rounded-xl border border-[#dce6d6] bg-[#fbfcf9] px-3 py-3 text-base leading-6 text-[#183b2c] outline-none placeholder:text-[#89968b] focus:border-[#4c8456] focus:ring-2 focus:ring-[#4c8456]/20"
            maxLength={2000}
            minLength={3}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={
              language === 'bn'
                ? 'যেমন: আমার ধানের পাতায় বাদামি দাগ পড়েছে'
                : 'For example: Brown spots have appeared on my rice leaves'
            }
            required
            value={question}
          />
          <span className="mt-1 block text-right text-xs text-[#7b887e]">
            {question.length}/2000
          </span>
        </label>

        <button
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1f603f] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#194d33] focus:outline-none focus:ring-2 focus:ring-[#4c8456] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-65 sm:w-auto sm:text-base"
          disabled={isLoading || question.trim().length < 3}
          type="submit"
        >
          {isLoading ? (
            <>
              <LoaderCircle aria-hidden="true" className="animate-spin" size={18} />
              Investigating…
            </>
          ) : (
            <>
              Analyze question
              <Send aria-hidden="true" size={17} />
            </>
          )}
        </button>
      </form>

      {error && (
        <div
          aria-live="polite"
          className="mt-6 rounded-xl border border-[#f1d4cd] bg-[#fff7f4] p-4 text-sm leading-6 text-[#854735]"
          role="alert"
        >
          {error}
        </div>
      )}

      {result?.success && (
        <article
          aria-live="polite"
          className="mt-6 rounded-2xl border border-[#dce6d6] bg-[#f7f8f2] p-5 sm:p-6"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-[#183b2c]">Investigation response</h3>
            <span className="rounded-full bg-[#e9f1e4] px-3 py-1 text-xs font-medium text-[#326548]">
              {result.model}
            </span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-7 text-[#46564a] sm:text-base">
            {result.answer}
          </p>
          {result.requestId && (
            <p className="mt-4 break-all text-xs text-[#7b887e]">
              Request ID: {result.requestId}
            </p>
          )}
        </article>
      )}
    </section>
  )
}
