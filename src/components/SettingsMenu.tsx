import { WATCH_REGION_OPTIONS } from "../config/regions";
import { formatViewerRegionHint } from "../services/viewerPrefs";
import type { ViewerPrefs } from "../types";

export function SettingsMenu({
  viewerPrefs,
  onWatchRegionChange,
  onClearCache,
  onToggleTasteProfile,
  onToggleLibrary,
  onToggleHistory,
  savedCount,
  watchedCount
}: {
  viewerPrefs: ViewerPrefs;
  onWatchRegionChange: (watchRegion: string) => void;
  onClearCache: () => void;
  onToggleTasteProfile?: () => void;
  onToggleLibrary?: () => void;
  onToggleHistory?: () => void;
  savedCount?: number;
  watchedCount?: number;
}) {
  function handleResetAllData() {
    if (typeof window === "undefined") {
      onClearCache();
      return;
    }
    const confirmed = window.confirm(
      "Reset all data? This clears your taste profile, saved picks, seen history, and room history."
    );
    if (confirmed) {
      onClearCache();
    }
  }

  return (
    <details className="group relative ml-auto">
      <summary className="summary-no-marker list-none cursor-pointer rounded-full border border-white/30 bg-zinc-900/60 p-2 text-sm text-zinc-100 backdrop-blur-md transition hover:border-white/50 hover:bg-zinc-800/70 active:scale-90">
        <span className="sr-only">Settings</span>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M4 18L20 18" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"></path> <path d="M4 12L20 12" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"></path> <path d="M4 6L20 6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"></path> </g></svg>
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-white/20 bg-zinc-900/90 p-3 shadow-2xl backdrop-blur-xl">
        {onToggleTasteProfile || onToggleLibrary || onToggleHistory ? (
          <div className="">
            <p className="text-[11px] uppercase tracking-wide text-zinc-400">Personalization</p>
            <div className="mt-2 grid gap-2">
              {onToggleTasteProfile ? (
                <button
                  type="button"
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-100 transition hover:bg-zinc-800/80 active:bg-zinc-800/90"
                  onClick={onToggleTasteProfile}
                >
                  Taste profile
                </button>
              ) : null}
              {onToggleLibrary ? (
                <button
                  type="button"
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-100 transition hover:bg-zinc-800/80 active:bg-zinc-800/90"
                  onClick={onToggleLibrary}
                >
                  Library ({savedCount ?? 0} saved / {watchedCount ?? 0} seen)
                </button>
              ) : null}
              {onToggleHistory ? (
                <button
                  type="button"
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-100 transition hover:bg-zinc-800/80 active:bg-zinc-800/90"
                  onClick={onToggleHistory}
                >
                  History
                </button>
              ) : null}
            </div>

            <label className="block text-xs font-medium uppercase tracking-wide text-zinc-400 border-t border-white/10 pt-3">
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
          </div>
        ) : null}
        <button
          type="button"
          className="mt-3 w-full rounded-lg px-3 py-2 text-left text-sm text-rose-300/80 transition hover:bg-rose-950/40 hover:text-rose-200 active:bg-rose-950/60"
          onClick={handleResetAllData}
        >
          Reset all data
        </button>
      </div>
    </details>
  );
}
