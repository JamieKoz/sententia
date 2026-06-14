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
              ? "mx-auto grid w-[min(38vw,8.75rem)] place-items-center overflow-hidden rounded-xl bg-zinc-800/70 text-2xl font-semibold aspect-[2/3] sm:w-[9.5rem] sm:text-3xl md:w-[12.5rem] md:rounded-2xl lg:w-[15rem] lg:text-4xl"
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
      <div className={compactMobile ? "mt-1.5 min-h-0 md:mt-3" : "mt-3"}>
        <h3
          className={
            compactMobile
              ? "line-clamp-2 text-sm font-medium leading-snug sm:text-base md:text-lg lg:text-xl"
              : "text-lg font-medium md:text-xl"
          }
        >
          {title.name} ({title.releaseYear})
        </h3>
        <p
          className={
            compactMobile
              ? "mt-0.5 text-[11px] text-zinc-300 sm:text-sm md:mt-1.5 md:text-base"
              : "mt-2 text-sm text-zinc-300"
          }
        >
          {title.type} - {title.runtimeMinutes}m
          {typeof title.rating === "number" ? ` - ${title.rating.toFixed(1)}★` : ""}
        </p>
        <p
          className={
            compactMobile
              ? `mt-0.5 text-xs leading-snug text-zinc-100 sm:text-sm md:mt-2 md:text-base md:leading-relaxed lg:line-clamp-5 ${truncateOverview ? "line-clamp-3 md:line-clamp-4" : ""}`
              : `mt-2 text-zinc-100 ${truncateOverview ? "line-clamp-3" : ""}`
          }
        >
          {title.overview}
        </p>
        {title.genres.length ? (
          <p className={compactMobile ? "mt-1 hidden text-sm text-zinc-300 md:block" : "mt-2 text-sm text-zinc-300"}>
            Genres: {title.genres.join(", ")}
          </p>
        ) : null}
        {title.providers.length ? (
          <p
            className={
              compactMobile ? "mt-1 hidden text-sm text-zinc-300 md:block" : "mt-1 text-sm text-zinc-300"
            }
          >
            Streaming: {formatProviderLabels(title.providers)}
          </p>
        ) : null}
        {title.cast?.length ? (
          <p className={compactMobile ? "mt-1 hidden text-sm text-zinc-300 lg:block" : "mt-1 text-sm text-zinc-300"}>
            Cast: {title.cast.join(", ")}
          </p>
        ) : null}
      </div>
    </article>
  );
}
