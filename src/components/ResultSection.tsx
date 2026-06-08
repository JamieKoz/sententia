import { TitleCard } from "./TitleCard";
import type { Title } from "../types";

export function ResultSection({
  winner,
  backup,
  whyThisPick,
  isSaved,
  isWatched,
  watchedRating,
  onToggleSave,
  onMarkWatched,
  onRateWatched,
  onWatchNow,
  onWatchTrailer,
  onPickAnother
}: {
  winner: Title;
  backup?: Title;
  whyThisPick: string[];
  isSaved: boolean;
  isWatched: boolean;
  watchedRating?: number;
  onToggleSave: () => void;
  onMarkWatched: () => void;
  onRateWatched: (rating: number) => void;
  onWatchNow: () => void;
  onWatchTrailer: () => void;
  onPickAnother: () => void;
}) {
  return (
    <section className="rounded-3xl border border-white/20  p-5 shadow-2xl backdrop-blur-lg">
      <TitleCard title={winner} />
      <div className="mt-3 rounded-xl border border-violet-300/25 bg-violet-500/10 px-3 py-2 text-sm text-violet-100">
        <p className="font-medium">Why this was recommended</p>
        <p className="mt-1 text-xs text-violet-200">You picked it as the winner. These are the signals that got it into your deck.</p>
        <ul className="mt-1 list-disc pl-5">
          {whyThisPick.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>
      {backup ? <p className="mt-2 text-sm text-zinc-300">Backup option: {backup.name}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="rounded-full border border-white/30 bg-zinc-900/60 px-3 py-1.5 text-xs transition hover:border-white/50 hover:bg-zinc-800/75"
          onClick={onToggleSave}
        >
          {isSaved ? "Saved in watchlist" : "Save for later"}
        </button>
        <button
          className="rounded-full border border-white/30 bg-zinc-900/60 px-3 py-1.5 text-xs transition hover:border-white/50 hover:bg-zinc-800/75"
          onClick={onMarkWatched}
        >
          {isWatched ? "Watched" : "Mark watched"}
        </button>
      </div>
      {isWatched ? (
        <div className="mt-2 flex items-center gap-1 text-xs text-zinc-300">
          <span>Rate it:</span>
          {[1, 2, 3, 4, 5].map((rating) => (
            <button
              key={rating}
              className={`rounded px-1.5 py-0.5 ${watchedRating === rating ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-200"}`}
              onClick={() => onRateWatched(rating)}
            >
              {rating}
            </button>
          ))}
        </div>
      ) : null}
      <div className="mt-4 flex gap-3">
        <button
          className="rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-sm transition hover:bg-violet-800/55"
          onClick={onWatchNow}
        >
          Watch now
        </button>
        <button
          className="rounded-full border border-white/30 bg-zinc-900/60 px-4 py-2 text-sm transition hover:border-white/50 hover:bg-zinc-800/75"
          onClick={onWatchTrailer}
        >
          Watch trailer
        </button>
        <button
          className="rounded-full border border-white/30 bg-zinc-900/60 px-4 py-2 text-sm transition hover:border-white/50 hover:bg-zinc-800/75"
          onClick={onPickAnother}
        >
          Pick another
        </button>
      </div>
    </section>
  );
}
