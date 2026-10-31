import { useState } from 'react'
import { LoaderCircle, Search } from 'lucide-react'
import { answerInvestigation, startInvestigation } from '../services/agent'
import type {
  AgentSessionResponse,
  InvestigationLanguage,
} from '../types/agent'
import type { Crop } from '../types/cropAnalysis'
import { FarmerQuestion } from './FarmerQuestion'
import { InvestigationReport } from './InvestigationReport'
import { InvestigationStatusBadge } from './InvestigationStatus'
import { InvestigationTrace } from './InvestigationTrace'

interface AgentInvestigationProps {
  scanId: string
  scanAccessToken: string
  crop: Crop
}

export function AgentInvestigation({
  scanId,
  scanAccessToken,
  crop,
}: AgentInvestigationProps) {
  const [language, setLanguage] = useState<InvestigationLanguage>('bn')
  const [session, setSession] = useState<AgentSessionResponse | null>(null)
  const [accessToken, setAccessToken] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleStart(farmerQuestion: string): Promise<boolean> {
    setLoading(true)
    setError('')
    try {
      const result = await startInvestigation({
        scanId,
        scanAccessToken,
        crop,
        language,
        question: farmerQuestion,
      })
      setSession(result)
      setAccessToken(result.accessToken ?? '')
      return true
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'The investigation could not be started. Please try again.',
      )
      return false
    } finally {
      setLoading(false)
    }
  }

  async function handleAnswer(answer: string): Promise<boolean> {
    if (!session || !accessToken) {
      return false
    }
    setLoading(true)
    setError('')
    try {
      setSession(
        await answerInvestigation(session.sessionId, accessToken, answer),
      )
      return true
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Your answer could not be submitted. Please try again.',
      )
      return false
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="space-y-5 border-t border-[#e5ebdf] pt-6">
      <div>
        <p className="text-sm font-semibold text-[#4c8456]">
          {language === 'bn' ? 'প্রমাণভিত্তিক তদন্ত' : 'Evidence-led investigation'}
        </p>
        <h2 className="mt-1 text-xl font-semibold text-[#183b2c] sm:text-2xl">
          {language === 'bn' ? 'আপনার পর্যবেক্ষণ অনুসন্ধান করুন' : 'Investigate your observations'}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#617166]">
          {language === 'bn'
            ? 'এজেন্টটি আসল স্ক্যান পর্যবেক্ষণ ও সূত্র ব্যবহার করবে, প্রয়োজন হলে একটি প্রশ্ন করবে এবং অনিশ্চয়তা স্পষ্ট করবে।'
            : 'The agent uses actual scan observations and retrieved references, asks a follow-up when useful, and makes uncertainty clear.'}
        </p>
      </div>

      {!session && (
        <div className="space-y-4">
          <label className="block text-sm font-medium text-[#31513b]">
            {language === 'bn' ? 'উত্তরের ভাষা' : 'Response language'}
            <select
              className="mt-2 min-h-11 w-full rounded-xl border border-[#dce6d6] bg-[#fbfcf9] px-3 text-base outline-none focus:border-[#4c8456] focus:ring-2 focus:ring-[#4c8456]/20 sm:w-auto sm:min-w-48"
              onChange={(event) =>
                setLanguage(event.target.value as InvestigationLanguage)
              }
              value={language}
            >
              <option value="bn">বাংলা / Bangla</option>
              <option value="en">English</option>
            </select>
          </label>
          <FarmerQuestion
            language={language}
            loading={loading}
            mode="start"
            onSubmit={handleStart}
            title={language === 'bn' ? 'আপনি কী জানতে চান?' : 'What would you like to investigate?'}
          />
        </div>
      )}

      {loading && (
        <div
          aria-live="polite"
          className="flex items-center gap-3 rounded-xl bg-[#e9f1e4] p-4 text-sm font-medium text-[#326548]"
          role="status"
        >
          <LoaderCircle aria-hidden="true" className="animate-spin" size={18} />
          {language === 'bn' ? 'প্রমাণ যাচাই করে তদন্ত চলছে…' : 'Investigating with evidence…'}
        </div>
      )}

      {error && (
        <p
          aria-live="polite"
          className="rounded-xl border border-[#f1d4cd] bg-[#fff7f4] p-4 text-sm leading-6 text-[#854735]"
          role="alert"
        >
          {error}
        </p>
      )}

      {session && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <InvestigationStatusBadge status={session.status} />
            <span className="text-xs text-[#7b887e]">
              {language === 'bn' ? 'কেস' : 'Case'} {session.sessionId.slice(0, 8)}
            </span>
          </div>

          {session.status === 'awaiting_farmer' && session.pendingQuestion && (
            <FarmerQuestion
              language={language}
              loading={loading}
              mode="answer"
              onSubmit={handleAnswer}
              prompt={session.pendingQuestion}
              title={language === 'bn' ? 'আরও একটি তথ্য প্রয়োজন' : 'A little more information is needed'}
            />
          )}

          {session.message && (
            <p className="rounded-xl border border-[#f1dfaa] bg-[#fff9e9] p-4 text-sm leading-6 text-[#755a16]">
              {session.message}
            </p>
          )}

          {session.report && <InvestigationReport report={session.report} />}
          <InvestigationTrace trace={session.trace} />
        </div>
      )}

      {!session && !loading && (
        <div className="flex items-center gap-2 text-xs text-[#7b887e]">
          <Search aria-hidden="true" size={14} />
          {language === 'bn'
            ? 'এটি একটি তদন্ত সহায়তা, নিশ্চিত রোগ নির্ণয় নয়।'
            : 'This is an investigation aid, not a confirmed diagnosis.'}
        </div>
      )}
    </section>
  )
}
