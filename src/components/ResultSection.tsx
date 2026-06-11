import { useEffect, useState } from "react";
import { formatProviderLabels } from "../config/options";
import { tmdbPosterUrl } from "../services/tmdb";
import type { Title } from "../types";

export function ResultSection({
  winner,
  backup,
  whyThisPick,
  isSaved,
  seenReaction,
  onToggleSave,
  onSetSeenReaction,
  onWatchNow,
  onWatchTrailer,
  onPickAnother
}: {
  winner: Title;
  backup?: Title;
  whyThisPick: string[];
  isSaved: boolean;
  seenReaction?: "up" | "down";
  onToggleSave: () => void;
  onSetSeenReaction: (reaction?: "up" | "down") => void;
  onWatchNow: () => void;
  onWatchTrailer: () => void;
  onPickAnother: () => void;
}) {
  const poster = tmdbPosterUrl(winner.posterPath);
  const streaming = winner.providers.length ? formatProviderLabels(winner.providers) : null;
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <section className="result-section-enter rounded-3xl border border-white/20 p-5 shadow-2xl backdrop-blur-lg">
      <div className="grid gap-5 md:grid-cols-[220px_1fr] md:items-start">
        <aside>
          <div className="mx-auto grid w-full max-w-[220px] place-items-center overflow-hidden rounded-2xl bg-zinc-800/70 text-4xl font-semibold aspect-[2/3]">
            {poster ? (
              <img
                className="h-full w-full object-cover object-center"
                src={poster}
                alt={`${winner.name} poster`}
                draggable={false}
                onDragStart={(event) => event.preventDefault()}
              />
            ) : (
              <span>{winner.name.slice(0, 1)}</span>
            )}
          </div>

          <div className="mt-3">
            <SeenReactionButtons
              reaction={seenReaction}
              isSaved={isSaved}
              onToggleSave={() => {
                const wasSaved = isSaved;
                onToggleSave();
                if (!wasSaved) {
                  setToast("Saved for later!");
                }
              }}
              onChange={(reaction) => {
                const previous = seenReaction;
                onSetSeenReaction(reaction);
                if (reaction === "up" && previous !== "up") {
                  setToast("You liked this film!");
                }
                if (reaction === "down" && previous !== "down") {
                  setToast("You did not like this film!");
                }
              }}
            />
          </div>
        </aside>

        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
            {winner.name} ({winner.releaseYear})
          </h2>
          <p className="mt-2 text-sm text-zinc-300">
            {winner.type} - {winner.runtimeMinutes}m
            {typeof winner.rating === "number" ? ` - ${winner.rating.toFixed(1)}★` : ""}
          </p>
          <p className="mt-3 text-zinc-100">{winner.overview}</p>
          <div className="mt-4 space-y-1 text-sm text-zinc-300">
            {winner.genres.length ? <p>Genres: {winner.genres.join(", ")}</p> : null}
            {streaming ? <p>Streaming: {streaming}</p> : null}
            {winner.cast?.length ? <p>Cast: {winner.cast.join(", ")}</p> : null}
          </div>

          <details className="mt-4 rounded-xl border border-violet-300/25 bg-violet-500/10 text-sm text-violet-100">
            <summary className="summary-no-marker flex cursor-pointer items-center justify-between gap-3 px-3 py-2 font-medium">
              <span>Why this was recommended</span>
              <span className="text-xs text-violet-200">Show details</span>
            </summary>
            <div className="border-t border-violet-300/15 px-3 pb-3 pt-2">
              <p className="text-xs text-violet-200">
                These are the signals that got it into your deck.
              </p>
              <ul className="mt-2 list-disc pl-5">
                {whyThisPick.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          </details>

          {backup ? <BackupOption title={backup} /> : null}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          className="rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-medium transition hover:brightness-110 active:scale-95 active:brightness-95"
          onClick={onWatchNow}
        >
          Watch now
        </button>
        <button
          className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-zinc-900/60 px-4 py-2 text-sm transition hover:border-white/50 hover:bg-zinc-800/75 active:scale-95"
          onClick={onWatchTrailer}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
            <path d="M23.5 6.2a3.1 3.1 0 0 0-2.2-2.2C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.3.5A3.1 3.1 0 0 0 .5 6.2 33 33 0 0 0 0 12a33 33 0 0 0 .5 5.8 3.1 3.1 0 0 0 2.2 2.2c1.8.5 9.3.5 9.3.5s7.5 0 9.3-.5a3.1 3.1 0 0 0 2.2-2.2 33 33 0 0 0 .5-5.8 33 33 0 0 0-.5-5.8zM9.5 15.5v-7l6.2 3.5z" />
          </svg>
          Watch trailer
        </button>
        <button
          className="rounded-full border border-white/30 bg-zinc-900/60 px-4 py-2 text-sm transition hover:border-white/50 hover:bg-zinc-800/75 active:scale-95"
          onClick={onPickAnother}
        >
          Pick another
        </button>
      </div>
      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[90] flex justify-center px-4">
          <p className="rounded-full border border-white/20 bg-zinc-950/90 px-4 py-2 text-xs text-zinc-100 shadow-xl backdrop-blur-md">
            {toast}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function SeenReactionButtons({
  reaction,
  isSaved,
  onToggleSave,
  onChange
}: {
  reaction?: "up" | "down";
  isSaved: boolean;
  onToggleSave: () => void;
  onChange: (reaction?: "up" | "down") => void;
}) {
  return (
    <div className="rounded-xl p-2">
      <div className="flex justify-center items-center gap-2">
        <button
          type="button"
          className={`grid h-9 w-9 place-items-center rounded-full border text-base transition active:scale-90 ${reaction === "up"
            ? "border-emerald-300/75 bg-emerald-700/50 text-emerald-100 scale-110"
            : "border-emerald-300/50 bg-emerald-900/30 text-emerald-100 hover:bg-emerald-800/45 hover:scale-105"
            }`}
          onClick={() => onChange(reaction === "up" ? undefined : "up")}
          aria-label="Liked this film"
          aria-pressed={reaction === "up"}
        >
          👍
        </button>
        <button
          type="button"
          className={`grid h-9 w-9 place-items-center rounded-full border text-base transition active:scale-90 ${reaction === "down"
            ? "border-rose-300/75 bg-rose-700/50 text-rose-100 scale-110"
            : "border-rose-300/50 bg-rose-900/30 text-rose-100 hover:bg-rose-800/45 hover:scale-105"
            }`}
          onClick={() => onChange(reaction === "down" ? undefined : "down")}
          aria-label="Did not like this film"
          aria-pressed={reaction === "down"}
        >
          👎
        </button>
        <button
          type="button"
          className={`grid h-9 w-9 place-items-center rounded-full border text-base transition active:scale-90 ${isSaved
            ? "border-violet-300/75 bg-violet-700/45 text-violet-100 scale-110"
            : "border-white/25 bg-zinc-900/60 text-zinc-200 hover:bg-zinc-800/70 hover:scale-105"
            }`}
          onClick={onToggleSave}
          aria-label={isSaved ? "Saved for later" : "Save for later"}
          aria-pressed={isSaved}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path fill="currentColor" d="M5 3h14a2 2 0 0 1 2 2v14l-4-2-4 2-4-2-4 2V5a2 2 0 0 1 2-2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function BackupOption({ title }: { title: Title }) {
  const poster = tmdbPosterUrl(title.posterPath, "w342");

  return (
    <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/15 bg-zinc-900/35 p-2 text-sm text-zinc-300">
      <div className="grid h-16 w-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-zinc-800/70 text-sm font-semibold text-zinc-100 aspect-[2/3]">
        {poster ? (
          <img className="h-full w-full object-cover object-center" src={poster} alt={`${title.name} poster`} draggable={false} />
        ) : (
          <span>{title.name.slice(0, 1)}</span>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-zinc-500">Backup option</p>
        <p className="truncate font-medium text-zinc-100">
          {title.name} ({title.releaseYear})
        </p>
      </div>
    </div>
  );
}

