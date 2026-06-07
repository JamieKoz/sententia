import { tmdbPosterUrl } from "../services/tmdb";
import type { Title } from "../types";

export function ShowdownChoiceCard({
  title,
  side,
  selectionState,
  onPick,
  onShowMore
}: {
  title: Title;
  side: "left" | "right";
  selectionState: "idle" | "picked" | "dismissed";
  onPick: () => void;
  onShowMore: () => void;
}) {
  const poster = tmdbPosterUrl(title.posterPath);
  return (
    <div
      className={`showdown-choice showdown-choice--${side} showdown-choice--${selectionState} rounded-2xl p-2 sm:p-3`}
    >
      <button
        className="showdown-choice__poster mx-auto block w-full max-w-[140px] overflow-hidden rounded-xl border border-transparent bg-zinc-800/70 aspect-[2/3] sm:max-w-[170px]"
        onClick={onPick}
        aria-label={`Pick ${title.name}`}
        disabled={selectionState !== "idle"}
      >
        {poster ? (
          <img
            className="showdown-choice__image h-full w-full object-cover object-center"
            src={poster}
            alt={`${title.name} poster`}
            draggable={false}
          />
        ) : (
          <span className="grid h-full w-full place-items-center text-3xl font-semibold">{title.name.slice(0, 1)}</span>
        )}
      </button>
      <p className="showdown-choice__title mt-2 line-clamp-2 text-center text-sm font-medium text-zinc-100">
        {title.name} ({title.releaseYear})
      </p>
      <div className="showdown-choice__actions mt-2 grid gap-2">
        <button
          className="showdown-choice__pick rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3 py-1.5 text-xs font-medium text-white shadow-lg shadow-violet-900/35 transition hover:brightness-110"
          onClick={onPick}
          disabled={selectionState !== "idle"}
        >
          Pick this
        </button>
        <button
          className="showdown-choice__details rounded-full border border-white/25 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-100 transition hover:bg-zinc-800/75"
          onClick={onShowMore}
          disabled={selectionState !== "idle"}
        >
          Show more
        </button>
      </div>
    </div>
  );
}
