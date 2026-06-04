import { formatProviderLabels } from "../config/options";
import { tmdbPosterUrl } from "../services/tmdb";
import type { Title } from "../types";

export function TitleCard({
  title,
  compact = false,
  noTopMargin = false,
  compactMobile = false,
  truncateOverview = false
}: {
  title: Title;
  compact?: boolean;
  noTopMargin?: boolean;
  compactMobile?: boolean;
  truncateOverview?: boolean;
}) {
  const poster = tmdbPosterUrl(title.posterPath);
  const overviewStyle = truncateOverview
    ? {
      display: "-webkit-box",
      WebkitLineClamp: 3,
      WebkitBoxOrient: "vertical" as const,
      overflow: "hidden"
    }
    : undefined;
  return (
    <article
      className={
        compact
          ? `${noTopMargin ? "" : "mt-4 "}rounded-2xl bg-zinc-900/20 p-3`
          : `${noTopMargin ? "" : "mt-4 "}rounded-2xl`
      }
    >
      <div
        className={
          compact
            ? "mx-auto grid w-full max-w-[170px] place-items-center overflow-hidden rounded-xl bg-zinc-800/70 text-3xl font-semibold aspect-[2/3]"
            : compactMobile
              ? "mx-auto grid w-full max-w-[190px] sm:max-w-[240px] place-items-center overflow-hidden rounded-xl bg-zinc-800/70 text-3xl sm:text-4xl font-semibold aspect-[2/3]"
              : "mx-auto grid w-full max-w-[260px] place-items-center overflow-hidden rounded-xl bg-zinc-800/70 text-4xl font-semibold aspect-[2/3]"
        }
      >
        {poster ? (
          <img
            className="h-full w-full object-cover object-center"
            src={poster}
            alt={`${title.name} poster`}
            draggable={false}
            onDragStart={(event) => event.preventDefault()}
          />
        ) : (
          <span>{title.name.slice(0, 1)}</span>
        )}
      </div>
      <div className={compactMobile ? "mt-2" : "mt-3"}>
        <h3 className={compactMobile ? "text-base font-medium sm:text-lg md:text-xl" : "text-lg font-medium md:text-xl"}>
          {title.name} ({title.releaseYear})
        </h3>
        <p className={compactMobile ? "mt-1 text-xs sm:text-sm text-zinc-300" : "mt-2 text-sm text-zinc-300"}>
          {title.type} - {title.runtimeMinutes}m
          {typeof title.rating === "number" ? ` - ${title.rating.toFixed(1)}★` : ""}
        </p>
        <p className={compactMobile ? "mt-1 text-sm text-zinc-100" : "mt-2 text-zinc-100"} style={overviewStyle}>
          {title.overview}
        </p>
        <p className={compactMobile ? "mt-1 text-xs sm:text-sm text-zinc-300" : "mt-2 text-sm text-zinc-300"}>
          Genres: {title.genres.join(", ")}
        </p>
        {title.providers.length ? (
          <p className={compactMobile ? "mt-1 text-xs sm:text-sm text-zinc-300" : "mt-1 text-sm text-zinc-300"}>
            Streaming: {formatProviderLabels(title.providers)}
          </p>
        ) : null}
        {title.cast?.length ? (
          <p className={compactMobile ? "mt-1 text-xs sm:text-sm text-zinc-300" : "mt-1 text-sm text-zinc-300"}>
            Cast: {title.cast.join(", ")}
          </p>
        ) : null}
      </div>
    </article>
  );
}
