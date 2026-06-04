import type { OnboardingAnswers, RuntimeBucket } from "../types";

/** Canonical mood tokens (match `Title.moods` / scoring); `label` is UI-only. */
export const MOOD_CHIPS: { value: string; label: string; description: string }[] = [
  { value: "light", label: "Light", description: "Easy, feel-good, low effort" },
  { value: "intense", label: "Intense", description: "Fast pace, tension, momentum" },
  { value: "emotional", label: "Emotional", description: "Rich stories with real pull" },
  { value: "mind-bending", label: "Mind-bending", description: "Twists and unconventional ideas" }
];

export const TYPE_OPTIONS: { value: "movie" | "series" | "either"; label: string; description: string }[] = [
  { value: "movie", label: "Movie", description: "One sitting, start to finish" },
  { value: "series", label: "Series", description: "Episodes you can settle into" },
  { value: "either", label: "Either", description: "Surprise me with the best match" }
];

export const RUNTIME_OPTIONS: { value: RuntimeBucket | "any"; label: string; description: string }[] = [
  { value: "any", label: "Any", description: "No length preference" },
  { value: "short", label: "Under 90m", description: "Quick watch" },
  { value: "standard", label: "90–130m", description: "Standard feature length" },
  { value: "long", label: "130m+", description: "Epic or slow-burn" }
];

export function normalizeMoodList(raw?: string[] | string): string[] {
  const arr = !raw ? [] : Array.isArray(raw) ? raw : [raw];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of arr) {
    const t = item.trim().toLowerCase();
    if (!t) continue;
    const chip = MOOD_CHIPS.find(
      (m) => m.value === t || m.value === t.replace(/\s+/g, "-") || m.label.toLowerCase() === t
    );
    if (chip && !seen.has(chip.value)) {
      seen.add(chip.value);
      out.push(chip.value);
    }
  }
  return out;
}
export const PROVIDER_OPTIONS = ["Netflix", "Prime", "Hulu", "HBO Max", "Apple", "Disney"];
export const LANGUAGE_OPTIONS = ["any", "en", "es", "fr", "ko", "ja"];
export const EXCLUSION_OPTIONS = ["Horror", "Crime", "Romance", "Drama", "Action", "Thriller", "Comedy"];
export const RELEASE_WINDOW_OPTIONS = ["any", "2020s", "2010s", "2000s", "pre-2000"] as const;
export const FAMILIARITY_OPTIONS = ["any", "popular", "hidden-gems", "for-kids"] as const;
export const YEAR_MIN = 1900;
export const YEAR_MAX = new Date().getFullYear();

export type QuickPreset = {
  id: string;
  label: string;
  description: string;
  values: Partial<OnboardingAnswers>;
};

export const QUICK_PRESETS: QuickPreset[] = [
  {
    id: "easy-light",
    label: "Easy & light",
    description: "Low effort, short, feel-good choices.",
    values: { moods: ["light"], preferredType: "either", runtime: "short", familiarities: ["popular"] }
  },
  {
    id: "something-deep",
    label: "Something deep",
    description: "Richer stories with emotional pull.",
    values: { moods: ["emotional"], preferredType: "movie", runtime: "standard", releaseWindow: "2010s" }
  },
  {
    id: "high-intensity",
    label: "High intensity",
    description: "Fast pace, tension, and momentum.",
    values: { moods: ["intense"], preferredType: "either", runtime: "standard", familiarities: ["popular"] }
  },
  {
    id: "binge-mode",
    label: "Binge mode",
    description: "Series-first setup for longer sessions.",
    values: { preferredType: "series", runtime: "any", moods: ["emotional", "intense"] }
  }
];
