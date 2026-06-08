import { summarizeTasteProfile } from "../services/personalizationInsights";
import type { TasteProfile } from "../types";

export function TasteProfileCard({
  profile,
  savedCount,
  watchedCount
}: {
  profile: TasteProfile;
  savedCount: number;
  watchedCount: number;
}) {
  const summary = summarizeTasteProfile(profile);
  return (
    <section className="rounded-2xl bg-zinc-900/45 p-4">
      <ul className="mt-2 space-y-1 text-sm text-zinc-100">
        {summary.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-zinc-300">
        Saved picks: {savedCount} | Watched: {watchedCount}
      </p>
    </section>
  );
}
