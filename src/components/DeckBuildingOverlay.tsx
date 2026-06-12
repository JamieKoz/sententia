import { useEffect, useMemo, useState } from "react";
import { THUMBNAIL_PATHS } from "../data/thumbnailManifest";
import type { DeckBuildProgress } from "../services/deckBuildProgress";

const STATUS_LINES = [
  "Asking AI to think about your vibe…",
  "Searching titles that match your mood…",
  "Checking what's streaming in your region…",
  "Pulling cast, ratings and posters…",
  "Scoring titles against your taste…",
  "Shuffling your personalised deck…",
  "Finalising picks — almost ready…"
];

export function DeckBuildingOverlay({
  error,
  progress,
  onDismiss
}: {
  error?: string | null;
  progress?: DeckBuildProgress | null;
  onDismiss?: () => void;
}) {
  const [lineIndex, setLineIndex] = useState(0);
  const stripImages = useMemo(() => {
    const subset = THUMBNAIL_PATHS.slice(0, 18);
    if (subset.length > 0) return subset;
    return [];
  }, []);

  useEffect(() => {
    if (error) return;
    const id = window.setInterval(() => {
      setLineIndex((i) => (i + 1) % STATUS_LINES.length);
    }, 2200);
    return () => window.clearInterval(id);
  }, [error]);

  const lockedInCount = progress?.resolvedCount ?? 0;
  const lockedInTarget = progress?.targetCount ?? 0;
  const showLockedIn = lockedInCount > 0 && lockedInTarget > 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/62 backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {!error ? (
        <>
          <div className="deck-building-thumbnail-strip" aria-hidden="true">
            <div className="thumbnail-row">

              {showLockedIn ? (
                <p
                  key={lockedInCount}
                  className="deck-status-line text-sm font-medium text-zinc-200 shadow-2xl text-center"
                >
                  Locked in {lockedInCount} of {lockedInTarget} picks
                </p>
              ) : null}
              <div className="thumbnail-row-track" style={{ animationDuration: "65s" }}>
                {[...stripImages, ...stripImages].map((src, index) => (
                  <img
                    key={`${src}-${index}`}
                    src={src}
                    alt=""
                    className="thumbnail-row-poster"
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="absolute inset-0 z-10 flex items-center justify-center px-6">
            <div className="max-w-sm text-center">
              <p className="text-base font-semibold text-white sm:text-lg shadow-2xl">Building your deck</p>
              <p
                key={lineIndex}
                className="deck-status-line mt-2 min-h-[2.75rem] text-sm text-white shadow-2xl"
              >
                {STATUS_LINES[lineIndex]}
              </p>
            </div>
          </div>
        </>
      ) : (
        <div className="absolute inset-0 z-10 flex items-center justify-center px-6">
          <div className="max-w-sm text-center">
            <p className="text-base font-medium text-rose-100 sm:text-lg">Could not build your deck</p>
            <p className="mt-2 text-sm text-zinc-300">{error}</p>
            {onDismiss ? (
              <button
                type="button"
                className="mt-6 rounded-full border border-white/30 bg-zinc-900/70 px-5 py-2 text-sm text-zinc-100 transition hover:border-white/50 active:scale-95"
                onClick={onDismiss}
              >
                Back
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
