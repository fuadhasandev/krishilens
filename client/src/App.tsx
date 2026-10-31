import { ArrowRight, Leaf, Sprout } from 'lucide-react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CropInvestigationForm } from './components/CropInvestigationForm'
import { LanguageSwitcher } from './components/LanguageSwitcher'
import { ImageAnalysis } from './pages/ImageAnalysis'
import { CaseHistory } from './pages/CaseHistory'
import { CaseDetails } from './pages/CaseDetails'
import { Recheck } from './pages/Recheck'

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
    <main className="relative min-h-screen overflow-hidden bg-[#f7f8f2] text-[#183b2c]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-36 -top-44 h-96 w-96 rounded-full bg-[#e6efdc] blur-3xl"
      />
      <header className="relative mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <Link aria-label={t('navigation.home')} className="flex items-center gap-2.5" to="/">
          <span className="flex size-10 items-center justify-center rounded-xl bg-[#1f603f] text-white shadow-sm">
            <Leaf aria-hidden="true" size={22} strokeWidth={2.2} />
          </span>
          <span className="text-xl font-bold tracking-tight">KrishiLens</span>
        </Link>
        <nav aria-label={t('navigation.home')} className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher />
          <Link
            className="text-sm font-semibold text-[#326548] hover:text-[#183b2c]"
            to="/image-analysis"
          >
            {t('navigation.analyzeImage')}
          </Link>
          <Link
            className="text-sm font-semibold text-[#326548] hover:text-[#183b2c]"
            to="/cases"
          >
            {t('caseHistory.title')}
          </Link>
          <span className="hidden rounded-full border border-[#dce6d6] bg-white/70 px-3 py-1.5 text-xs font-medium text-[#55705d] sm:inline-flex sm:px-4 sm:text-sm">
            {t('home.madeFor')}
          </span>
        </nav>
      </header>

      <section className="relative mx-auto grid min-h-[calc(100svh-81px)] w-full max-w-7xl items-center gap-12 px-5 pb-16 pt-8 sm:px-8 sm:pb-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-12 lg:py-16">
        <div className="mx-auto w-full max-w-2xl lg:mx-0">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#e9f1e4] px-3.5 py-2 text-sm font-semibold text-[#326548]">
            <Sprout aria-hidden="true" size={17} />
            {t('home.eyebrow')}
          </div>
          <h1 className="max-w-xl text-4xl font-semibold leading-[1.12] tracking-[-0.045em] text-[#183b2c] sm:text-5xl lg:text-6xl">
            {t('home.headline')}
            <span className="mt-1 block text-[#4c8456]">{t('home.headlineAccent')}</span>
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-[#617166] sm:mt-6 sm:text-lg sm:leading-8">
            {t('home.subtitle')}
          </p>
          <a
            className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#1f603f] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#194d33] focus:outline-none focus:ring-2 focus:ring-[#4c8456] focus:ring-offset-2 sm:mt-9 sm:px-6 sm:text-base"
            href="#investigate"
          >
            {t('home.start')}
            <ArrowRight aria-hidden="true" size={18} />
          </a>
          <Link
            className="ml-3 mt-8 inline-flex min-h-12 items-center justify-center rounded-xl border border-[#dce6d6] bg-white px-5 py-3 text-sm font-semibold text-[#315d3d] transition-colors hover:bg-[#f1f5ed] focus:outline-none focus:ring-2 focus:ring-[#4c8456] focus:ring-offset-2 sm:ml-4 sm:px-6 sm:text-base"
            to="/image-analysis"
          >
            {t('home.analyzeImage')}
          </Link>
        </div>

        <div
          aria-label={t('home.illustration')}
          className="relative mx-auto flex aspect-[1.12/1] w-full max-w-[500px] items-center justify-center overflow-hidden rounded-[2rem] border border-[#e5ebdf] bg-[#edf3e8] p-6 sm:rounded-[2.5rem] sm:p-10"
          role="img"
        >
          <div aria-hidden="true" className="absolute right-[15%] top-[14%] size-16 rounded-full bg-[#f6d98b] sm:size-20" />
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[34%] rounded-t-[50%] bg-[#d5e5c7]" />
          <div aria-hidden="true" className="absolute -bottom-[11%] -left-[8%] h-[39%] w-[116%] rounded-[50%] bg-[#b7d1a5]" />
          <div aria-hidden="true" className="absolute -bottom-[20%] left-[12%] h-[39%] w-[90%] rotate-[-8deg] rounded-[50%] bg-[#8db77f]" />
          <div className="relative z-10 flex h-[68%] w-full items-end justify-center gap-3 sm:gap-6">
            <Sprout aria-hidden="true" className="mb-2 h-[78%] w-[27%] text-[#47794c]" strokeWidth={1.15} />
            <Sprout aria-hidden="true" className="h-full w-[34%] text-[#286344]" strokeWidth={1.1} />
            <Sprout aria-hidden="true" className="mb-1 h-[70%] w-[25%] text-[#5b8b51]" strokeWidth={1.15} />
          </div>
          <div className="absolute bottom-5 left-5 rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm backdrop-blur sm:bottom-7 sm:left-7">
            <p className="text-xs font-medium text-[#748074]">{t('home.rooted')}</p>
            <p className="mt-0.5 text-sm font-semibold text-[#315d3d]">{t('home.builtFor')}</p>
          </div>
        </div>
      </section>
      <div className="relative px-5 pb-16 sm:px-8 sm:pb-20 lg:px-12">
        <CropInvestigationForm />
      </div>
    </main>
  )
}

export default App
