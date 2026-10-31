import { ArrowRight, Leaf, Sprout } from 'lucide-react'

function App() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f7f8f2] text-[#183b2c]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-36 -top-44 h-96 w-96 rounded-full bg-[#e6efdc] blur-3xl"
      />
      <header className="relative mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <a aria-label="KrishiLens home" className="flex items-center gap-2.5" href="/">
          <span className="flex size-10 items-center justify-center rounded-xl bg-[#1f603f] text-white shadow-sm">
            <Leaf aria-hidden="true" size={22} strokeWidth={2.2} />
          </span>
          <span className="text-xl font-bold tracking-tight">KrishiLens</span>
        </a>
        <span className="rounded-full border border-[#dce6d6] bg-white/70 px-3 py-1.5 text-xs font-medium text-[#55705d] sm:px-4 sm:text-sm">
          Made for Bangladesh
        </span>
      </header>

      <section className="relative mx-auto grid min-h-[calc(100svh-81px)] w-full max-w-7xl items-center gap-12 px-5 pb-16 pt-8 sm:px-8 sm:pb-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-12 lg:py-16">
        <div className="mx-auto w-full max-w-2xl lg:mx-0">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#e9f1e4] px-3.5 py-2 text-sm font-semibold text-[#326548]">
            <Sprout aria-hidden="true" size={17} />
            A new way to care for your crops
          </div>
          <h1 className="max-w-xl text-4xl font-semibold leading-[1.12] tracking-[-0.045em] text-[#183b2c] sm:text-5xl lg:text-6xl">
            Smarter Crop Care,
            <span className="mt-1 block text-[#4c8456]">Powered by AI</span>
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-[#617166] sm:mt-6 sm:text-lg sm:leading-8">
            Your AI-powered crop investigation assistant.
          </p>
          <button
            aria-describedby="investigation-status"
            className="mt-8 inline-flex min-h-12 cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-[#aab9ab] px-5 py-3 text-sm font-semibold text-white shadow-sm sm:mt-9 sm:px-6 sm:text-base"
            disabled
            type="button"
          >
            Start Investigation
            <ArrowRight aria-hidden="true" size={18} />
          </button>
          <p className="mt-3 text-sm text-[#7b887e]" id="investigation-status">
            Investigations will be available in a future update.
          </p>
        </div>

        <div
          aria-label="Illustration of healthy green crops growing in a field"
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
            <p className="text-xs font-medium text-[#748074]">Rooted in local needs</p>
            <p className="mt-0.5 text-sm font-semibold text-[#315d3d]">Built for the people who grow our food</p>
          </div>
        </div>
      </section>
    </main>
  )
}

export default App
