import { WATCH_REGION_OPTIONS } from "../config/regions";
import { formatViewerRegionHint } from "../services/viewerPrefs";
import type { ViewerPrefs } from "../types";

export function SettingsMenu({
  viewerPrefs,
  onWatchRegionChange,
  onClearCache,
  onToggleTasteProfile,
  onToggleLibrary,
  savedCount,
  watchedCount
}: {
  viewerPrefs: ViewerPrefs;
  onWatchRegionChange: (watchRegion: string) => void;
  onClearCache: () => void;
  onToggleTasteProfile?: () => void;
  onToggleLibrary?: () => void;
  savedCount?: number;
  watchedCount?: number;
}) {
  return (
    <details className="group relative ml-auto">
      <summary className="summary-no-marker list-none cursor-pointer rounded-full border border-white/30 bg-zinc-900/60 p-2 text-sm text-zinc-100 backdrop-blur-md transition hover:border-white/50 hover:bg-zinc-800/70">
        <span className="sr-only">Settings</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.325 4.317a1.724 1.724 0 0 1 3.35 0 1.724 1.724 0 0 0 2.573 1.066 1.724 1.724 0 0 1 2.49 2.49 1.724 1.724 0 0 0 1.065 2.573 1.724 1.724 0 0 1 0 3.35 1.724 1.724 0 0 0-1.066 2.573 1.724 1.724 0 0 1-2.49 2.49 1.724 1.724 0 0 0-2.573 1.065 1.724 1.724 0 0 1-3.35 0 1.724 1.724 0 0 0-2.573-1.066 1.724 1.724 0 0 1-2.49-2.49 1.724 1.724 0 0 0-1.065-2.573 1.724 1.724 0 0 1 0-3.35 1.724 1.724 0 0 0 1.066-2.573 1.724 1.724 0 0 1 2.49-2.49 1.724 1.724 0 0 0 2.573-1.065Z"
          />
          <circle cx="12" cy="12" r="3.25" />
        </svg>
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-white/20 bg-zinc-900/90 p-3 shadow-2xl backdrop-blur-xl">
        <label className="block text-xs font-medium uppercase tracking-wide text-zinc-400">
          Where you watch
        </label>
        <p className="mt-0.5 text-[11px] text-zinc-500">Streaming links and suggestions use this region.</p>
        <select
          className="mt-2 w-full rounded-lg border border-white/20 bg-zinc-950/80 px-2 py-2 text-sm text-zinc-100"
          value={viewerPrefs.watchRegion}
          onChange={(e) => onWatchRegionChange(e.target.value)}
          aria-label="Watch region"
        >
          {WATCH_REGION_OPTIONS.map((opt) => (
            <option key={opt.code} value={opt.code}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-[11px] text-zinc-500">{formatViewerRegionHint(viewerPrefs)}</p>
        {onToggleTasteProfile || onToggleLibrary ? (
          <div className="mt-3 border-t border-white/10 pt-3">
            <p className="text-[11px] uppercase tracking-wide text-zinc-400">Personalization</p>
            <div className="mt-2 grid gap-2">
              {onToggleTasteProfile ? (
                <button
                  type="button"
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-100 transition hover:bg-zinc-800/80"
                  onClick={onToggleTasteProfile}
                >
                  Taste profile
                </button>
              ) : null}
              {onToggleLibrary ? (
                <button
                  type="button"
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-100 transition hover:bg-zinc-800/80"
                  onClick={onToggleLibrary}
                >
                  Library ({savedCount ?? 0}/{watchedCount ?? 0})
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        <button
          type="button"
          className="mt-3 w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-100 transition hover:bg-zinc-800/80"
          onClick={onClearCache}
        >
          Clear cache
        </button>
      </div>
    </details>
  );
}
