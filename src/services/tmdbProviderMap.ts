import { PROVIDER_OPTIONS } from "../config/options";

export interface TmdbWatchProviderEntry {
  provider_id: number;
  provider_name: string;
}

/** TMDB provider_id → our canonical id (US-centric; names used as fallback). */
const PROVIDER_ID_MAP: Record<number, string> = {
  8: "netflix",
  9: "prime",
  10: "prime",
  15: "hulu",
  119: "prime",
  337: "disney",
  350: "apple",
  384: "max",
  1899: "max",
  283: "prime",
  531: "prime"
};

const SUPPORTED = new Set(PROVIDER_OPTIONS.map((p) => p.id));

function matchByName(providerName: string): string | undefined {
  const name = providerName.toLowerCase();
  if (name.includes("netflix")) return "netflix";
  if (name.includes("disney")) return "disney";
  if (name.includes("hulu")) return "hulu";
  if (/hbo max|\bmax\b/.test(name) && !name.includes("cinema")) return "max";
  if (name.includes("apple tv")) return "apple";
  if (/amazon prime|prime video|\bprime\b/.test(name)) return "prime";
  if (name.includes("amazon") && (name.includes("video") || name.includes("prime"))) return "prime";
  return undefined;
}

export function mapTmdbProvidersToCanonical(entries: TmdbWatchProviderEntry[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const entry of entries) {
    const byId = PROVIDER_ID_MAP[entry.provider_id];
    const byName = matchByName(entry.provider_name);
    const id = byId ?? byName;
    if (!id || !SUPPORTED.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }

  return out;
}

/** Use onboarding fallback only when the title is not tied to a TMDB id (synthetic picks). */
export function resolveTitleProviders(
  regional: string[],
  fallback: string[],
  hasTmdbBinding: boolean
): string[] {
  if (regional.length > 0) return regional;
  if (!hasTmdbBinding) return [...fallback];
  return [];
}
