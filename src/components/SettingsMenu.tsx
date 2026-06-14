import { useEffect, useRef, useState, type ReactNode } from "react";
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
  watchedCount,
  accountSection
}: {
  viewerPrefs: ViewerPrefs;
  onWatchRegionChange: (watchRegion: string) => void;
  onClearCache: () => void;
  onToggleTasteProfile?: () => void;
  onToggleLibrary?: () => void;
  onToggleHistory?: () => void;
  savedCount?: number;
  watchedCount?: number;
  accountSection?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

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
    <div ref={rootRef} className="relative ml-auto">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        className="rounded-full border border-white/30 bg-zinc-900/60 p-2 text-sm text-zinc-100 backdrop-blur-md transition hover:border-white/50 hover:bg-zinc-800/70 active:scale-90"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="sr-only">Settings</span>
        <svg width="100%" height="100%" className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 21C20 19.6044 20 18.9067 19.8278 18.3389C19.44 17.0605 18.4395 16.06 17.1611 15.6722C16.5933 15.5 15.8956 15.5 14.5 15.5H9.5C8.10444 15.5 7.40665 15.5 6.83886 15.6722C5.56045 16.06 4.56004 17.0605 4.17224 18.3389C4 18.9067 4 19.6044 4 21M16.5 7.5C16.5 9.98528 14.4853 12 12 12C9.51472 12 7.5 9.98528 7.5 7.5C7.5 5.01472 9.51472 3 12 3C14.4853 3 16.5 5.01472 16.5 7.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
      <div className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-white/20 bg-zinc-900/90 p-3 shadow-2xl backdrop-blur-xl" role="menu">
        {accountSection}
        {onToggleTasteProfile || onToggleLibrary || onToggleHistory ? (
          <div className="">
            <p className="text-[11px] uppercase tracking-wide text-zinc-400">Personalization</p>
            <div className="mt-2 grid gap-2">
              {onToggleTasteProfile ? (
                <button
                  type="button"
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-100 transition hover:bg-zinc-800/80 active:bg-zinc-800/90"
                  onClick={() => {
                    onToggleTasteProfile();
                    setOpen(false);
                  }}
                >
                  Taste profile
                </button>
              ) : null}
              {onToggleLibrary ? (
                <button
                  type="button"
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-100 transition hover:bg-zinc-800/80 active:bg-zinc-800/90"
                  onClick={() => {
                    onToggleLibrary();
                    setOpen(false);
                  }}
                >
                  Library ({savedCount ?? 0} saved / {watchedCount ?? 0} seen)
                </button>
              ) : null}
              {onToggleHistory ? (
                <button
                  type="button"
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-100 transition hover:bg-zinc-800/80 active:bg-zinc-800/90"
                  onClick={() => {
                    onToggleHistory();
                    setOpen(false);
                  }}
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
      ) : null}
    </div>
  );
}
