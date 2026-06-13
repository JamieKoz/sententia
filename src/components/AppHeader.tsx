import { SettingsMenu } from "./SettingsMenu";
import { AuthHeaderButtons } from "./AuthHeaderButtons";
import { SignedInAccountSection } from "./SignedInAccountSection";
import { useClerkEnabled } from "./ClerkAppShell";
import type { ViewerPrefs } from "../types";

export function AppHeader({
  viewerPrefs,
  onWatchRegionChange,
  onClearCache,
  onToggleTasteProfile,
  onToggleLibrary,
  onToggleHistory,
  savedCount,
  watchedCount,
  compact
}: {
  viewerPrefs: ViewerPrefs;
  onWatchRegionChange: (watchRegion: string) => void;
  onClearCache: () => void;
  onToggleTasteProfile?: () => void;
  onToggleLibrary?: () => void;
  onToggleHistory?: () => void;
  savedCount?: number;
  watchedCount?: number;
  compact?: boolean;
}) {
  const clerkEnabled = useClerkEnabled();

  return (
    <header className={compact ? "mb-2" : "mb-3"}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center">
          <a href="/" className="flex items-center no-underline">
            <img
              src="/icons/sententia-v6.svg"
              alt=""
              className={compact ? "h-9 w-auto sm:h-11" : "h-7 w-auto sm:h-9 md:h-16"}
            />
            <div className="ml-3 md:ml-6">
              <h1 className={compact ? "text-xl font-bold tracking-tight sm:text-xl uppercase" : "text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl"}>
                Sententia
              </h1>


              <p className="text-[10px] italic leading-tight text-zinc-300 opacity-80">
                Your next watch, decided now
              </p>
            </div>
          </a>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {clerkEnabled ? <AuthHeaderButtons /> : null}
          <SettingsMenu
            viewerPrefs={viewerPrefs}
            onWatchRegionChange={onWatchRegionChange}
            onClearCache={onClearCache}
            onToggleTasteProfile={onToggleTasteProfile}
            onToggleLibrary={onToggleLibrary}
            onToggleHistory={onToggleHistory}
            savedCount={savedCount}
            watchedCount={watchedCount}
            accountSection={clerkEnabled ? <SignedInAccountSection /> : null}
          />
        </div>
      </div>
    </header>
  );
}
