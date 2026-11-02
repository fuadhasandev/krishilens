import {
  ArrowRight,
  BookOpenCheck,
  Check,
  Clock3,
  Languages,
  Leaf,
  ScanLine,
  SearchCheck,
  Sprout,
} from 'lucide-react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CropInvestigationForm } from './components/CropInvestigationForm'
import { LanguageSwitcher } from './components/LanguageSwitcher'
import { Badge, Card, SectionHeader } from './components/ui'
import { ImageAnalysis } from './pages/ImageAnalysis'
import { CaseHistory } from './pages/CaseHistory'
import { CaseDetails } from './pages/CaseDetails'
import { Recheck } from './pages/Recheck'

const featureItems = [
  { icon: ScanLine, title: 'segmentation', description: 'segmentationText' },
  { icon: SearchCheck, title: 'investigation', description: 'investigationText' },
  { icon: Languages, title: 'bilingual', description: 'bilingualText' },
  { icon: BookOpenCheck, title: 'evidence', description: 'evidenceText' },
  { icon: Clock3, title: 'history', description: 'historyText' },
] as const

function App() {
  return (
    <Routes>
      <Route element={<HomePage />} path="/" />
      <Route element={<ImageAnalysis />} path="/image-analysis" />
      <Route element={<CaseHistory />} path="/cases" />
      <Route element={<CaseDetails />} path="/cases/:caseId" />
      <Route element={<Recheck />} path="/cases/:caseId/recheck" />
      <Route element={<Navigate replace to="/" />} path="*" />
    </Routes>
  )
}

function HomePage() {
  const { t } = useTranslation()

  return (
    <main className="min-h-screen overflow-hidden bg-[#FAF9F5] text-[#173c2c]">
      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-5 py-4 sm:px-8 lg:px-12">
        <Link aria-label={t('navigation.home')} className="flex shrink-0 items-center gap-2.5" to="/">
          <span className="flex size-10 items-center justify-center rounded-xl bg-[#174D35] text-white">
            <Leaf aria-hidden="true" size={22} strokeWidth={2.2} />
          </span>
          <span className="text-lg font-bold tracking-tight sm:text-xl">KrishiLens</span>
        </Link>
        <nav aria-label={t('navigation.home')} className="flex items-center gap-2 sm:gap-4">
          <a className="hidden min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-[#456150] hover:text-[#174D35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F855A] sm:inline-flex" href="#how-it-works">
            {t('home.howItWorks')}
          </a>
          <Link className="hidden min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-[#456150] hover:text-[#174D35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F855A] sm:inline-flex" to="/cases">
            {t('caseHistory.title')}
          </Link>
          <LanguageSwitcher />
          <Link className="hidden min-h-11 items-center justify-center rounded-xl bg-[#174D35] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#103d29] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F855A] focus-visible:ring-offset-2 sm:inline-flex" to="/image-analysis">
            {t('home.start')}
          </Link>
        </nav>
      </header>

      <section className="relative mx-auto grid w-full max-w-7xl items-center gap-10 px-5 pb-14 pt-8 sm:px-8 sm:pb-20 sm:pt-12 lg:grid-cols-[1fr_0.9fr] lg:gap-16 lg:px-12 lg:py-20">
        <div className="relative z-10 mx-auto w-full max-w-2xl lg:mx-0">
          <Badge><Sprout aria-hidden="true" className="mr-1.5" size={16} />{t('home.eyebrow')}</Badge>
          <h1 className="mt-6 max-w-xl text-[2.6rem] font-semibold leading-[1.12] tracking-[-0.045em] text-[#174D35] sm:text-5xl lg:text-6xl">
            {t('home.headline')}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-[#59695d] sm:text-lg sm:leading-8">
            {t('home.subtitle')}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#174D35] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#103d29] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F855A] focus-visible:ring-offset-2 sm:px-6 sm:text-base" to="/image-analysis">
              {t('home.start')} <ArrowRight aria-hidden="true" size={18} />
            </Link>
            <a className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#d6e2d3] bg-white px-5 py-3 text-sm font-semibold text-[#174D35] transition hover:bg-[#f1f5ed] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F855A] focus-visible:ring-offset-2 sm:px-6 sm:text-base" href="#how-it-works">
              {t('home.howItWorks')}
            </a>
          </div>
          <p className="mt-5 text-sm text-[#66766a]">
            <Check aria-hidden="true" className="mr-1 inline text-[#2F855A]" size={16} />
            {t('home.madeFor')}
          </p>
        </div>

        <div
          aria-label={t('home.illustration')}
          className="relative mx-auto flex aspect-[1.1/1] w-full max-w-[520px] items-center justify-center overflow-hidden rounded-[2rem] border border-[#e2e9de] bg-[#EAF4E8] p-5 sm:rounded-[2.5rem] sm:p-9"
          role="img"
        >
          <div aria-hidden="true" className="absolute right-[14%] top-[12%] size-14 rounded-full bg-[#E5A04A]/80 sm:size-20" />
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[42%] rounded-t-[50%] bg-[#d4e5c8]" />
          <div aria-hidden="true" className="absolute -bottom-[15%] -left-[9%] h-[44%] w-[120%] rounded-[50%] bg-[#b4d09e]" />
          <div aria-hidden="true" className="absolute -bottom-[21%] left-[10%] h-[38%] w-[93%] rotate-[-8deg] rounded-[50%] bg-[#8eaf76]" />
          <div aria-hidden="true" className="absolute bottom-[13%] left-[8%] right-[8%] flex h-[55%] items-end justify-around">
            <Sprout className="mb-2 h-[88%] w-[24%] text-[#4d8053]" strokeWidth={1.15} />
            <Sprout className="h-full w-[31%] text-[#286344]" strokeWidth={1.1} />
            <Sprout className="mb-1 h-[78%] w-[23%] text-[#5b8b51]" strokeWidth={1.15} />
          </div>
          <div className="absolute left-4 top-4 flex max-w-[75%] items-center gap-2 rounded-xl border border-white/80 bg-white/90 px-3 py-2 text-xs font-semibold text-[#174D35] shadow-sm sm:left-6 sm:top-6 sm:px-4 sm:py-3 sm:text-sm">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#EAF4E8] text-[#2F855A]"><ScanLine aria-hidden="true" size={17} /></span>
            {t('home.visualAnalysis')}
          </div>
          <p className="absolute bottom-4 left-4 right-4 rounded-xl border border-white/70 bg-white/85 px-3 py-2 text-xs font-medium leading-5 text-[#456150] shadow-sm sm:bottom-6 sm:left-6 sm:right-auto sm:max-w-[75%] sm:px-4 sm:py-3 sm:text-sm">{t('home.builtFor')}</p>
        </div>
      </section>

      <section className="border-y border-[#e6e9df] bg-white/70 py-16 sm:py-20" id="how-it-works">
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
          <SectionHeader
            className="mb-9 text-center"
            eyebrow={t('home.stepsEyebrow')}
            title={t('home.stepsTitle')}
            description={t('home.stepsIntro')}
          />
          <div className="grid gap-4 md:grid-cols-3">
            {(['photo', 'investigate', 'track'] as const).map((step, index) => {
              const Icon = [ScanLine, SearchCheck, Clock3][index]
              return (
                <Card className="p-5 sm:p-6" key={step}>
                  <div className="mb-5 flex items-center justify-between">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-[#EAF4E8] text-[#2F855A]">
                      <Icon aria-hidden="true" size={21} />
                    </span>
                    <span className="text-sm font-semibold text-[#91a091]">{`0${index + 1}`}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-[#174D35]">{t(`home.steps.${step}Title`)}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#617166]">{t(`home.steps.${step}Text`)}</p>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
        <SectionHeader
          className="mb-8"
          eyebrow={t('home.featuresEyebrow')}
          title={t('home.featuresTitle')}
          description={t('home.featuresIntro')}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {featureItems.map(({ icon: Icon, title, description }) => (
            <article className="flex gap-4 rounded-2xl border border-[#e2e9de] bg-white p-5 transition-colors hover:border-[#c5d6c3] sm:p-6" key={title}>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF4E8] text-[#2F855A]"><Icon aria-hidden="true" size={20} /></span>
              <div>
                <h3 className="font-semibold text-[#174D35]">{t(`home.features.${title}`)}</h3>
                <p className="mt-1 text-sm leading-6 text-[#617166]">{t(`home.features.${description}`)}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-2xl bg-[#174D35] p-5 text-white sm:flex-row sm:items-center sm:p-7">
          <div>
            <h3 className="text-lg font-semibold">{t('home.ctaTitle')}</h3>
            <p className="mt-1 text-sm leading-6 text-white/80">{t('home.ctaText')}</p>
          </div>
          <Link className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#174D35] transition hover:bg-[#EAF4E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#174D35]" to="/image-analysis">
            {t('home.start')} <ArrowRight aria-hidden="true" size={17} />
          </Link>
        </div>
      </section>

      <section className="relative px-5 pb-16 sm:px-8 sm:pb-20 lg:px-12">
        <CropInvestigationForm />
      </section>
    </main>
  )
}

export default App
