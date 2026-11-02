import { useState } from 'react'
import { LoaderCircle, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { currentLanguage } from '../i18n'
import {
  answerInvestigation,
  startInvestigation,
  translateInvestigation,
} from '../services/agent'
import type {
  AgentSessionResponse,
  InvestigationLanguage,
  TranslatedInvestigationText,
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
  const { t } = useTranslation()
  const [session, setSession] = useState<AgentSessionResponse | null>(null)
  const [farmerMessages, setFarmerMessages] = useState<string[]>([])
  const [accessToken, setAccessToken] = useState('')
  const [translation, setTranslation] =
    useState<TranslatedInvestigationText | null>(null)
  const [errorCode, setErrorCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [translating, setTranslating] = useState(false)

  const displayLanguage: InvestigationLanguage = currentLanguage()
  const sessionLanguage = session?.language ?? displayLanguage
  const report =
    session?.report?.language === displayLanguage
      ? session.report
      : translation?.report?.language === displayLanguage
        ? translation.report
        : session?.report
  const pendingQuestion =
    translation?.pendingQuestion && displayLanguage !== sessionLanguage
      ? translation.pendingQuestion
      : session?.pendingQuestion

  async function handleStart(farmerQuestion: string): Promise<boolean> {
    const language = currentLanguage()
    setLoading(true)
    setErrorCode('')
    try {
      const result = await startInvestigation({
        scanId,
        scanAccessToken,
        crop,
        language,
        question: farmerQuestion,
      })
      setSession(result)
      setFarmerMessages([farmerQuestion])
      setAccessToken(result.accessToken ?? '')
      setTranslation(null)
      return true
    } catch (requestError) {
      setErrorCode(requestError instanceof Error ? requestError.message : 'INVESTIGATION_FAILED')
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
    setErrorCode('')
    try {
      setSession(
        await answerInvestigation(
          session.sessionId,
          accessToken,
          answer,
          session.language,
        ),
      )
      setFarmerMessages((messages) => [...messages, answer])
      setTranslation(null)
      return true
    } catch (requestError) {
      setErrorCode(requestError instanceof Error ? requestError.message : 'INVESTIGATION_FAILED')
      return false
    } finally {
      setLoading(false)
    }
  }

  async function handleTranslate() {
    if (!session || !accessToken) {
      return
    }
    setTranslating(true)
    setErrorCode('')
    try {
      setTranslation(
        await translateInvestigation(
          session.sessionId,
          accessToken,
          displayLanguage,
        ),
      )
    } catch (translationError) {
      setErrorCode(
        translationError instanceof Error
          ? translationError.message
          : 'TRANSLATION_FAILED',
      )
    } finally {
      setTranslating(false)
    }
  }

  const otherLanguage =
    sessionLanguage === 'bn' ? 'common.bangla' : 'common.english'
  const targetLanguage =
    displayLanguage === 'bn' ? 'common.bangla' : 'common.english'

  return (
    <section className="space-y-5 border-t border-[#e5ebdf] pt-6">
      <div>
        <p className="text-sm font-semibold text-[#4c8456]">
          {t('investigation.eyebrow')}
        </p>
        <h2 className="mt-1 text-xl font-semibold text-[#183b2c] sm:text-2xl">
          {t('investigation.title')}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#617166]">
          {t('investigation.intro')}
        </p>
      </div>

      {!session && (
        <FarmerQuestion
          loading={loading}
          mode="start"
          onSubmit={handleStart}
          title={t('investigation.askTitle')}
        />
      )}

      {loading && (
        <div
          aria-live="polite"
          className="flex items-center gap-3 rounded-xl bg-[#e9f1e4] p-4 text-sm font-medium text-[#326548]"
          role="status"
        >
          <LoaderCircle aria-hidden="true" className="animate-spin" size={18} />
          {t('investigation.loading')}
        </div>
      )}

      {errorCode && (
        <p
          aria-live="polite"
          className="rounded-xl border border-[#f1d4cd] bg-[#fff7f4] p-4 text-sm leading-6 text-[#854735]"
          role="alert"
        >
          {t(`errors.${errorCode}`, { defaultValue: t('errors.INVESTIGATION_FAILED') })}
        </p>
      )}

      {session && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <InvestigationStatusBadge status={session.status} />
            <span className="text-xs text-[#7b887e]">
              {t('investigation.case')} {session.sessionId.slice(0, 8)} ·{' '}
              {t(otherLanguage)}
            </span>
          </div>

          <ol aria-label={t('investigation.farmerMessages')} className="space-y-3">
            {farmerMessages.map((message, index) => (
              <li className="ml-auto max-w-[92%] rounded-2xl rounded-br-md bg-[#174D35] p-4 text-sm leading-6 text-white sm:max-w-[80%]" key={`${index}-${message}`}>
                <p className="mb-1 text-xs font-semibold text-white/75">{t('investigation.farmerLabel')}</p>
                <p className="whitespace-pre-wrap">{message}</p>
              </li>
            ))}
          </ol>

          {displayLanguage !== sessionLanguage &&
            (session.report || session.pendingQuestion) && (
            <div className="space-y-3 rounded-xl border border-[#eee2bd] bg-[#fffaf0] p-4 text-sm leading-6 text-[#705c2f]">
              <p>{t('investigation.sessionLanguageNote', { language: t(otherLanguage) })}</p>
              <button
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#d8c98f] bg-white px-3 py-2 font-semibold text-[#574817] disabled:opacity-60"
                disabled={translating || loading}
                onClick={handleTranslate}
                type="button"
              >
                {translating ? (
                  <>
                    <LoaderCircle aria-hidden="true" className="mr-2 animate-spin" size={16} />
                    {t('investigation.translating')}
                  </>
                ) : (
                  t(
                    session.report
                      ? 'investigation.translateReport'
                      : 'investigation.translateQuestion',
                    { language: t(targetLanguage) },
                  )
                  )}
              </button>
              {translation?.report && displayLanguage === translation.report.language && (
                <p>{t('investigation.translationNote')}</p>
              )}
            </div>
          )}

          {session.status === 'awaiting_farmer' && pendingQuestion && (
            <FarmerQuestion
              loading={loading}
              mode="answer"
              onSubmit={handleAnswer}
              prompt={pendingQuestion}
              title={t('investigation.moreInfo')}
            />
          )}

          {session.status === 'failed' && (
            <p className="rounded-xl border border-[#f1d4cd] bg-[#fff7f4] p-4 text-sm leading-6 text-[#854735]">
              {t('errors.INVESTIGATION_FAILED')}
            </p>
          )}

          {report && <InvestigationReport report={report} />}
          <InvestigationTrace trace={session.trace} />
        </div>
      )}

      {!session && !loading && (
        <div className="flex items-center gap-2 text-xs text-[#7b887e]">
          <Search aria-hidden="true" size={14} />
          {t('investigation.disclaimer')}
        </div>
      )}
    </section>
  )
}
