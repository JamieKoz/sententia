import { useEffect, useState } from "react";

const STATUS_LINES = [
  "Curating picks for your mood…",
  "Matching titles to your filters…",
  "Pulling posters and details…",
  "Shuffling the shortlist…",
  "Almost ready to swipe…"
];

export function DeckBuildingOverlay({
  error,
  onDismiss
}: {
  error?: string | null;
  onDismiss?: () => void;
}) {
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    if (error) return;
    const id = window.setInterval(() => {
      setLineIndex((i) => (i + 1) % STATUS_LINES.length);
    }, 2400);
    return () => window.clearInterval(id);
  }, [error]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-black/55 px-6 backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="deck-building-card-stack relative h-44 w-36 sm:h-52 sm:w-44">
        <div className="deck-building-card-wrap">
          <div className="deck-building-card-inner rounded-2xl border border-white/15 bg-zinc-900/80 shadow-xl" />
        </div>
        <div className="deck-building-card-wrap">
          <div className="deck-building-card-inner rounded-2xl border border-white/15 bg-zinc-800/70 shadow-xl" />
        </div>
        <div className="deck-building-card-wrap">
          <div className="deck-building-card-inner relative overflow-hidden rounded-2xl border border-violet-400/30 bg-zinc-900/90 shadow-2xl shadow-violet-950/40">
            <div className="deck-building-skeleton absolute inset-0 opacity-90" />
            <div className="relative flex h-full flex-col items-center justify-center gap-2 p-3 text-center">
              <div className="deck-building-spinner h-9 w-9 rounded-full border-2 border-white/20 border-t-violet-400" />
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-400">Deck</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-sm text-center">
        {error ? (
          <>
            <p className="text-base font-medium text-rose-100 sm:text-lg">Could not build your deck</p>
            <p className="mt-2 text-sm text-zinc-300">{error}</p>
            {onDismiss ? (
              <button
                type="button"
                className="mt-6 rounded-full border border-white/30 bg-zinc-900/70 px-5 py-2 text-sm text-zinc-100 transition hover:border-white/50"
                onClick={onDismiss}
              >
                Back
              </button>
            ) : null}
          </>
        ) : (
          <>
            <p className="text-base font-medium text-zinc-100 sm:text-lg">Building your deck</p>
            <p className="mt-2 min-h-[3rem] text-sm text-zinc-300 sm:min-h-[2.75rem]" key={lineIndex}>
              {STATUS_LINES[lineIndex]}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
