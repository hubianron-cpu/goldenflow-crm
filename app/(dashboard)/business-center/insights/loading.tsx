export default function BusinessInsightsLoading() {
  return (
    <div aria-busy="true" className="min-w-0 space-y-5" dir="rtl">
      <section className="panel p-6 sm:p-8">
        <div className="h-3 w-32 animate-pulse rounded-full bg-gold/15" />
        <div className="mt-4 h-10 w-64 max-w-full animate-pulse rounded-xl bg-white/[0.06]" />
        <div className="mt-3 h-4 w-full max-w-xl animate-pulse rounded-full bg-white/[0.04]" />
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            className="h-36 animate-pulse rounded-2xl border border-white/[0.08] bg-white/[0.025]"
            key={index}
          />
        ))}
      </section>
      <p className="text-center text-sm text-zinc-500">
        טוען סיכומים ומגמות...
      </p>
    </div>
  );
}
