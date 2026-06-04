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
export type ProviderOption = {
  id: string;
  label: string;
  logoSrc: string;
};

export const PROVIDER_OPTIONS: ProviderOption[] = [
  { id: "netflix", label: "Netflix", logoSrc: "/providers/netflix.svg" },
  { id: "prime", label: "Prime", logoSrc: "/providers/prime.svg" },
  { id: "hulu", label: "Hulu", logoSrc: "/providers/hulu.svg" },
  { id: "max", label: "Max", logoSrc: "/providers/max.svg" },
  { id: "apple", label: "Apple TV+", logoSrc: "/providers/apple.svg" },
  { id: "disney", label: "Disney+", logoSrc: "/providers/disney.svg" }
];

const LEGACY_PROVIDER_IDS: Record<string, string> = {
  netflix: "netflix",
  Netflix: "netflix",
  prime: "prime",
  Prime: "prime",
  "prime video": "prime",
  hulu: "hulu",
  Hulu: "hulu",
  max: "max",
  Max: "max",
  "hbo max": "max",
  "HBO Max": "max",
  apple: "apple",
  Apple: "apple",
  "apple tv+": "apple",
  disney: "disney",
  Disney: "disney",
  "disney+": "disney"
};

export function formatProviderLabels(providerIds: string[]): string {
  return providerIds
    .map((id) => PROVIDER_OPTIONS.find((item) => item.id === id)?.label ?? id)
    .join(", ");
}

export function normalizeProviderList(raw?: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw ?? []) {
    const key = item.trim();
    if (!key) continue;
    const id = LEGACY_PROVIDER_IDS[key] ?? LEGACY_PROVIDER_IDS[key.toLowerCase()] ?? key.toLowerCase();
    if (PROVIDER_OPTIONS.some((provider) => provider.id === id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}
export type LanguageOption = {
  code: string;
  label: string;
  flag?: string;
};

export const DEFAULT_LANGUAGES = ["en"] as const;

const LANGUAGE_OPTIONS_REST: LanguageOption[] = [
  { code: "af", label: "Afrikaans", flag: "🇿🇦" },
  { code: "sq", label: "Albanian", flag: "🇦🇱" },
  { code: "am", label: "Amharic", flag: "🇪🇹" },
  { code: "ar", label: "Arabic", flag: "🇸🇦" },
  { code: "hy", label: "Armenian", flag: "🇦🇲" },
  { code: "az", label: "Azerbaijani", flag: "🇦🇿" },
  { code: "eu", label: "Basque", flag: "🇪🇸" },
  { code: "bn", label: "Bengali", flag: "🇧🇩" },
  { code: "bg", label: "Bulgarian", flag: "🇧🇬" },
  { code: "my", label: "Burmese", flag: "🇲🇲" },
  { code: "ca", label: "Catalan", flag: "🇪🇸" },
  { code: "zh", label: "Chinese", flag: "🇨🇳" },
  { code: "hr", label: "Croatian", flag: "🇭🇷" },
  { code: "cs", label: "Czech", flag: "🇨🇿" },
  { code: "da", label: "Danish", flag: "🇩🇰" },
  { code: "nl", label: "Dutch", flag: "🇳🇱" },
  { code: "et", label: "Estonian", flag: "🇪🇪" },
  { code: "fi", label: "Finnish", flag: "🇫🇮" },
  { code: "fil", label: "Filipino", flag: "🇵🇭" },
  { code: "fr", label: "French", flag: "🇫🇷" },
  { code: "gl", label: "Galician", flag: "🇪🇸" },
  { code: "ka", label: "Georgian", flag: "🇬🇪" },
  { code: "de", label: "German", flag: "🇩🇪" },
  { code: "el", label: "Greek", flag: "🇬🇷" },
  { code: "gu", label: "Gujarati", flag: "🇮🇳" },
  { code: "he", label: "Hebrew", flag: "🇮🇱" },
  { code: "hi", label: "Hindi", flag: "🇮🇳" },
  { code: "hu", label: "Hungarian", flag: "🇭🇺" },
  { code: "is", label: "Icelandic", flag: "🇮🇸" },
  { code: "id", label: "Indonesian", flag: "🇮🇩" },
  { code: "ga", label: "Irish", flag: "🇮🇪" },
  { code: "it", label: "Italian", flag: "🇮🇹" },
  { code: "ja", label: "Japanese", flag: "🇯🇵" },
  { code: "kn", label: "Kannada", flag: "🇮🇳" },
  { code: "kk", label: "Kazakh", flag: "🇰🇿" },
  { code: "km", label: "Khmer", flag: "🇰🇭" },
  { code: "ko", label: "Korean", flag: "🇰🇷" },
  { code: "lo", label: "Lao", flag: "🇱🇦" },
  { code: "lv", label: "Latvian", flag: "🇱🇻" },
  { code: "lt", label: "Lithuanian", flag: "🇱🇹" },
  { code: "lb", label: "Luxembourgish", flag: "🇱🇺" },
  { code: "mk", label: "Macedonian", flag: "🇲🇰" },
  { code: "ms", label: "Malay", flag: "🇲🇾" },
  { code: "ml", label: "Malayalam", flag: "🇮🇳" },
  { code: "mt", label: "Maltese", flag: "🇲🇹" },
  { code: "mr", label: "Marathi", flag: "🇮🇳" },
  { code: "mn", label: "Mongolian", flag: "🇲🇳" },
  { code: "ne", label: "Nepali", flag: "🇳🇵" },
  { code: "no", label: "Norwegian", flag: "🇳🇴" },
  { code: "fa", label: "Persian", flag: "🇮🇷" },
  { code: "pl", label: "Polish", flag: "🇵🇱" },
  { code: "pt", label: "Portuguese", flag: "🇵🇹" },
  { code: "pa", label: "Punjabi", flag: "🇮🇳" },
  { code: "ro", label: "Romanian", flag: "🇷🇴" },
  { code: "ru", label: "Russian", flag: "🇷🇺" },
  { code: "sr", label: "Serbian", flag: "🇷🇸" },
  { code: "si", label: "Sinhala", flag: "🇱🇰" },
  { code: "sk", label: "Slovak", flag: "🇸🇰" },
  { code: "sl", label: "Slovenian", flag: "🇸🇮" },
  { code: "es", label: "Spanish", flag: "🇪🇸" },
  { code: "sw", label: "Swahili", flag: "🇰🇪" },
  { code: "sv", label: "Swedish", flag: "🇸🇪" },
  { code: "ta", label: "Tamil", flag: "🇮🇳" },
  { code: "te", label: "Telugu", flag: "🇮🇳" },
  { code: "th", label: "Thai", flag: "🇹🇭" },
  { code: "tr", label: "Turkish", flag: "🇹🇷" },
  { code: "uk", label: "Ukrainian", flag: "🇺🇦" },
  { code: "ur", label: "Urdu", flag: "🇵🇰" },
  { code: "uz", label: "Uzbek", flag: "🇺🇿" },
  { code: "vi", label: "Vietnamese", flag: "🇻🇳" },
  { code: "cy", label: "Welsh" }
];

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "en", label: "English", flag: "🇬🇧" },
  ...LANGUAGE_OPTIONS_REST.slice().sort((a, b) => a.label.localeCompare(b.label))
];

const LANGUAGE_BY_CODE = new Map(LANGUAGE_OPTIONS.map((option) => [option.code, option]));

export function getLanguageOption(code: string): LanguageOption | undefined {
  return LANGUAGE_BY_CODE.get(code);
}

export function normalizeLanguageCodes(raw?: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw ?? []) {
    const code = item.trim().toLowerCase();
    if (!code || code === "any" || seen.has(code)) continue;
    if (LANGUAGE_BY_CODE.has(code)) {
      seen.add(code);
      out.push(code);
    }
  }
  return out.length ? out : [...DEFAULT_LANGUAGES];
}
export const EXCLUSION_OPTIONS = ["Horror", "Crime", "Romance", "Drama", "Action", "Thriller", "Comedy", "Animation"];
export const RELEASE_WINDOW_OPTIONS = ["any", "2020s", "2010s", "2000s", "pre-2000"] as const;

/** Chronological order (oldest → newest) for the release step timeline. */
export const RELEASE_TIMELINE_SEGMENTS: {
  value: (typeof RELEASE_WINDOW_OPTIONS)[number];
  label: string;
  hint: string;
}[] = [
    { value: "pre-2000", label: "Pre-2000", hint: "1999 & earlier" },
    { value: "2000s", label: "2000s", hint: "2000–09" },
    { value: "2010s", label: "2010s", hint: "2010–19" },
    { value: "2020s", label: "2020+", hint: "2020–now" }
  ];
export const FAMILIARITY_TOKENS = ["popular", "hidden-gems", "for-kids", "adults-only", "acclaimed"] as const;
export type FamiliarityToken = (typeof FAMILIARITY_TOKENS)[number];

export type DiscoveryPopularity = "balanced" | "popular" | "hidden-gems" | "acclaimed";
export type DiscoveryAudience = "general" | "adults-only" | "for-kids";

export const DISCOVERY_POPULARITY_OPTIONS: {
  id: DiscoveryPopularity;
  label: string;
  description: string;
}[] = [
    { id: "balanced", label: "Surprise me", description: "A balanced mix — no strong skew either way" },
    { id: "popular", label: "Crowd favourites", description: "Well-known picks people are talking about" },
    { id: "hidden-gems", label: "Hidden gems", description: "Lesser-known titles worth discovering" },
    { id: "acclaimed", label: "Highly rated", description: "Favour stronger reviews and buzz" }
  ];

export const DISCOVERY_AUDIENCE_OPTIONS: {
  id: DiscoveryAudience;
  label: string;
  description: string;
}[] = [
    { id: "general", label: "General", description: "Default — not skewed toward family or kids" },
    { id: "adults-only", label: "Adults only", description: "Steer away from family and kids-style picks" },
    { id: "for-kids", label: "Family night", description: "Gentler, kid-friendly choices" }
  ];

const POPULARITY_FAMILIARITY_TOKENS = new Set<FamiliarityToken>(["popular", "hidden-gems", "acclaimed"]);

export function getPopularityTokens(familiarities?: string[]): FamiliarityToken[] {
  return (familiarities ?? []).filter((token): token is FamiliarityToken =>
    POPULARITY_FAMILIARITY_TOKENS.has(token as FamiliarityToken)
  );
}

export function getDiscoveryAudience(familiarities?: string[]): DiscoveryAudience {
  if (familiarities?.includes("for-kids")) return "for-kids";
  if (familiarities?.includes("adults-only")) return "adults-only";
  return "general";
}

export function buildDiscoveryFamiliarities(
  popularityTokens: FamiliarityToken[],
  audience: DiscoveryAudience
): FamiliarityToken[] {
  const out: FamiliarityToken[] = [];
  for (const token of popularityTokens) {
    if (POPULARITY_FAMILIARITY_TOKENS.has(token)) out.push(token);
  }
  if (audience === "for-kids") out.push("for-kids");
  if (audience === "adults-only") out.push("adults-only");
  return out;
}

export function normalizeFamiliarityList(raw?: string[]): FamiliarityToken[] {
  const seen = new Set<FamiliarityToken>();
  const out: FamiliarityToken[] = [];
  for (const item of raw ?? []) {
    const token = item.trim().toLowerCase();
    if (token === "any" || !token) continue;
    if (!FAMILIARITY_TOKENS.includes(token as FamiliarityToken) || seen.has(token as FamiliarityToken)) continue;
    seen.add(token as FamiliarityToken);
    out.push(token as FamiliarityToken);
  }
  return out;
}
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
