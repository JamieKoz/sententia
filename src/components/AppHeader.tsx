import { SettingsMenu } from "./SettingsMenu";
import type { ViewerPrefs } from "../types";

export function AppHeader({
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
    <header className="mb-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">Sententia</h1>
        <SettingsMenu
          viewerPrefs={viewerPrefs}
          onWatchRegionChange={onWatchRegionChange}
          onClearCache={onClearCache}
          onToggleTasteProfile={onToggleTasteProfile}
          onToggleLibrary={onToggleLibrary}
          savedCount={savedCount}
          watchedCount={watchedCount}
        />
      </div>
      <div>
        <p className="text-sm text-zinc-300 md:text-base">Stop scrolling. Swipe. Pick. Watch.</p>
      </div>
    </header>
  );
}
