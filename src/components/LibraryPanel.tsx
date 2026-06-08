import type { GroupHistoryEntry, SavedPickEntry, WatchedTitleEntry } from "../services/storage";
import type { Title } from "../types";

function titleName(title?: Title): string {
  if (!title) return "None yet";
  return `${title.name} (${title.releaseYear})`;
}

export function LibraryPanel({
  saved,
  watched,
  history,
  onOpenTitle,
  onToggleSave,
  onRateWatched
}: {
  saved: SavedPickEntry[];
  watched: WatchedTitleEntry[];
  history: GroupHistoryEntry[];
  onOpenTitle: (title: Title) => void;
  onToggleSave: (title: Title) => void;
  onRateWatched: (titleId: string, rating: number) => void;
}) {
  return (
    <section className="rounded-2xl  bg-zinc-900/35 p-4">
      <div className="mt-3 space-y-3">
        <details open>
          <summary className="cursor-pointer text-sm text-zinc-100">Saved picks ({saved.length})</summary>
          <div className="mt-2 space-y-2">
            {saved.length === 0 ? <p className="text-xs text-zinc-400">Save titles from results to build your watchlist.</p> : null}
            {saved.slice(0, 8).map((entry) => (
              <div key={entry.title.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-zinc-950/40 px-3 py-2">
                <button className="truncate text-left text-sm text-zinc-100 hover:underline" onClick={() => onOpenTitle(entry.title)}>
                  {titleName(entry.title)}
                </button>
                <button className="rounded-full border border-white/20 px-2 py-1 text-xs text-zinc-200" onClick={() => onToggleSave(entry.title)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        </details>

        <details>
          <summary className="cursor-pointer text-sm text-zinc-100">Watched ({watched.length})</summary>
          <div className="mt-2 space-y-2">
            {watched.length === 0 ? <p className="text-xs text-zinc-400">Mark titles as watched to improve future picks.</p> : null}
            {watched.slice(0, 8).map((entry) => (
              <div key={entry.title.id} className="rounded-lg border border-white/10 bg-zinc-950/40 px-3 py-2">
                <button className="truncate text-left text-sm text-zinc-100 hover:underline" onClick={() => onOpenTitle(entry.title)}>
                  {titleName(entry.title)}
                </button>
                <div className="mt-1 flex items-center gap-1 text-xs text-zinc-300">
                  <span>Rate:</span>
                  {[1, 2, 3, 4, 5].map((score) => (
                    <button
                      key={score}
                      className={`rounded px-1.5 py-0.5 ${entry.rating === score ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-200"}`}
                      onClick={() => onRateWatched(entry.title.id, score)}
                    >
                      {score}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>

        <details>
          <summary className="cursor-pointer text-sm text-zinc-100">Movie night history ({history.length})</summary>
          <div className="mt-2 space-y-2">
            {history.length === 0 ? <p className="text-xs text-zinc-400">Group results will appear here after each room.</p> : null}
            {history.slice(0, 6).map((entry) => (
              <div key={entry.roomCode} className="rounded-lg border border-white/10 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-300">
                <p className="text-zinc-100">Room {entry.roomCode}</p>
                <p>You: {titleName(entry.myPick)}</p>
                <p>Partner: {titleName(entry.partnerPick)}</p>
                {entry.sharedCompromise ? <p>Shared: {titleName(entry.sharedCompromise)}</p> : null}
              </div>
            ))}
          </div>
        </details>
      </div>
    </section>
  );
}
