// src/components/skeletons/Skeletons.tsx

// ── Base pulse box ────────────────────────────────────────────────────────────
function Pulse({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-slate-800 rounded ${className}`} />
  );
}

// ── Dashboard stat cards ──────────────────────────────────────────────────────
export function StatCardSkeleton() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <div className="flex justify-between items-center mb-3">
        <Pulse className="w-24 h-3" />
        <Pulse className="w-6 h-6 rounded" />
      </div>
      <Pulse className="w-32 h-7 mb-2" />
      <Pulse className="w-20 h-3" />
    </div>
  );
}

// ── Stock header ──────────────────────────────────────────────────────────────
export function StockHeaderSkeleton() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl px-6 py-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Pulse className="w-12 h-12 rounded-2xl" />
          <div className="space-y-2">
            <Pulse className="w-20 h-6" />
            <Pulse className="w-36 h-4" />
          </div>
        </div>
        <div className="space-y-2 text-right">
          <Pulse className="w-32 h-9 ml-auto" />
          <Pulse className="w-24 h-4 ml-auto" />
        </div>
      </div>
    </div>
  );
}

// ── Chart ─────────────────────────────────────────────────────────────────────
export function ChartSkeleton() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Toolbar */}
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex gap-2">
          {[80, 70, 80, 70, 60, 60].map((w, i) => (
            <Pulse key={i} className={`w-${w === 80 ? "20" : w === 70 ? "16" : "14"} h-7 rounded-lg`} />
          ))}
        </div>
        <div className="flex gap-1">
          <Pulse className="w-20 h-7 rounded-lg" />
          <Pulse className="w-20 h-7 rounded-lg" />
        </div>
      </div>
      {/* Fake chart bars */}
      <div className="h-[460px] flex items-end px-6 pb-6 gap-0.5 bg-slate-900/30">
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-slate-800 animate-pulse rounded-t"
            style={{
              height: `${20 + Math.abs(Math.sin(i * 0.4) * 35) + (i % 3) * 8}%`,
              animationDelay: `${i * 30}ms`,
            }}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="px-5 py-3 border-t border-slate-800 flex gap-4">
        <Pulse className="w-32 h-3" />
        <Pulse className="w-24 h-3" />
      </div>
    </div>
  );
}

// ── Technical indicators ──────────────────────────────────────────────────────
export function IndicatorsSkeleton() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
      <Pulse className="w-44 h-5" />
      {/* RSI gauge */}
      <div className="bg-slate-800/60 rounded-xl p-4 space-y-3">
        <Pulse className="w-20 h-3" />
        <Pulse className="w-full h-3 rounded-full" />
        <div className="flex justify-between">
          <Pulse className="w-16 h-3" />
          <Pulse className="w-8 h-3" />
          <Pulse className="w-8 h-3" />
          <Pulse className="w-20 h-3" />
        </div>
        <div className="flex justify-between items-center">
          <Pulse className="w-16 h-8" />
          <Pulse className="w-32 h-6 rounded-full" />
        </div>
      </div>
      {/* MACD + MA grid */}
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-slate-800/60 rounded-xl p-4 space-y-3">
            <Pulse className="w-12 h-3" />
            <Pulse className="w-20 h-6" />
            <Pulse className="w-16 h-5 rounded-full" />
          </div>
        ))}
      </div>
      {/* Overall signal */}
      <div className="bg-slate-800/40 rounded-xl p-4 flex gap-3">
        <Pulse className="w-8 h-8 rounded-full flex-shrink-0" />
        <div className="space-y-2 flex-1">
          <Pulse className="w-32 h-4" />
          <Pulse className="w-full h-3" />
          <Pulse className="w-3/4 h-3" />
        </div>
      </div>
    </div>
  );
}

// ── AI recommendations ────────────────────────────────────────────────────────
export function AIRecommendationSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="bg-slate-800/60 rounded-xl px-3 py-2.5 space-y-2 animate-pulse"
          style={{ animationDelay: `${i * 100}ms` }}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Pulse className="w-12 h-5" />
              <Pulse className="w-16 h-4" />
              <Pulse className="w-10 h-4" />
            </div>
            <Pulse className="w-14 h-5 rounded-full" />
          </div>
          <div className="flex items-center gap-2">
            <Pulse className="flex-1 h-1.5 rounded-full" />
            <Pulse className="w-8 h-3" />
          </div>
          <div className="flex gap-4 pt-0.5 border-t border-slate-700/30">
            {[1, 2, 3].map(j => (
              <Pulse key={j} className="w-16 h-3" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Holdings / positions table ────────────────────────────────────────────────
export function HoldingsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i}
          className="flex items-center gap-4 px-4 py-3 border-b border-slate-800/60 animate-pulse"
          style={{ animationDelay: `${i * 80}ms` }}>
          <Pulse className="w-7 h-7 rounded-lg flex-shrink-0" />
          <Pulse className="w-14 h-4" />
          <div className="ml-auto flex gap-6">
            <Pulse className="w-10 h-4" />
            <Pulse className="w-16 h-4" />
            <Pulse className="w-16 h-4" />
            <Pulse className="w-16 h-4" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Top holdings (dashboard) ──────────────────────────────────────────────────
export function TopHoldingsSkeleton() {
  return (
    <div className="space-y-1.5">
      {[1, 2, 3, 4].map(i => (
        <div key={i}
          className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/40 animate-pulse"
          style={{ animationDelay: `${i * 80}ms` }}>
          <div className="flex items-center gap-3">
            <Pulse className="w-7 h-7 rounded-full" />
            <div className="space-y-1.5">
              <Pulse className="w-12 h-4" />
              <Pulse className="w-16 h-3" />
            </div>
          </div>
          <div className="space-y-1.5 text-right">
            <Pulse className="w-16 h-4 ml-auto" />
            <Pulse className="w-12 h-3 ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── News cards ────────────────────────────────────────────────────────────────
export function NewsCardSkeleton() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 animate-pulse">
      <Pulse className="w-14 h-5 rounded-full" />
      <Pulse className="w-full h-4" />
      <Pulse className="w-4/5 h-4" />
      <Pulse className="w-3/5 h-4" />
      <div className="flex justify-between pt-1">
        <Pulse className="w-16 h-3" />
        <Pulse className="w-24 h-3" />
      </div>
    </div>
  );
}

export function NewsGridSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {[1, 2, 3, 4].map(i => (
        <NewsCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ── Order form ────────────────────────────────────────────────────────────────
export function OrderFormSkeleton() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 animate-pulse">
      <Pulse className="w-32 h-5" />
      <Pulse className="w-48 h-3" />
      <Pulse className="w-full h-12 rounded-xl" />
      <div className="bg-slate-800/60 rounded-xl p-3 space-y-2.5">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex justify-between">
            <Pulse className="w-20 h-3" />
            <Pulse className="w-16 h-3" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Pulse className="h-12 rounded-xl" />
        <Pulse className="h-12 rounded-xl" />
      </div>
    </div>
  );
}

// ── Account summary ───────────────────────────────────────────────────────────
export function AccountSkeleton() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 animate-pulse">
      <Pulse className="w-32 h-5" />
      <div className="bg-slate-800/60 rounded-xl p-4 space-y-2">
        <Pulse className="w-24 h-3" />
        <Pulse className="w-40 h-8" />
        <Pulse className="w-28 h-3" />
      </div>
      {[1, 2].map(i => (
        <div key={i} className="flex justify-between py-2 border-b border-slate-800/60">
          <Pulse className="w-20 h-4" />
          <Pulse className="w-24 h-4" />
        </div>
      ))}
    </div>
  );
}

// ── Watchlist rows ────────────────────────────────────────────────────────────
export function WatchlistSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i}
          className="flex items-center justify-between px-4 py-3 rounded-lg animate-pulse"
          style={{ animationDelay: `${i * 60}ms` }}>
          <div className="flex items-center gap-3">
            <Pulse className="w-8 h-8 rounded-lg" />
            <div className="space-y-1.5">
              <Pulse className="w-12 h-4" />
              <Pulse className="w-20 h-3" />
            </div>
          </div>
          <div className="space-y-1.5 text-right">
            <Pulse className="w-16 h-4 ml-auto" />
            <Pulse className="w-12 h-3 ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}