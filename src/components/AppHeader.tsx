import { SettingsMenu } from "./SettingsMenu";
import type { ViewerPrefs } from "../types";

export function AppHeader({
  viewerPrefs,
  onWatchRegionChange,
  onClearCache
}: {
  viewerPrefs: ViewerPrefs;
  onWatchRegionChange: (watchRegion: string) => void;
  onClearCache: () => void;
}) {
  return (
    <header className="mb-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">CouchPicks</h1>
        <SettingsMenu
          viewerPrefs={viewerPrefs}
          onWatchRegionChange={onWatchRegionChange}
          onClearCache={onClearCache}
        />
      </div>
      <div>
        <p className="text-sm text-zinc-300 md:text-base">Find the match for your next watch.</p>
      </div>
    </header>
  );
}
