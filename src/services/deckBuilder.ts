import { passesCandidateConstraints, prepareSwipeCandidatePool } from "../engine/candidateFilters";
import { createDefaultProfile } from "../engine/profile";
import { rankTitles } from "../engine/scoring";
import type { AiHistoryHints } from "./ai";
import { generateSuggestionsWithAi, rerankCandidatesWithAi } from "./ai";
import { assertCanBuildAiDeck, fetchAiQuota } from "./aiQuota";
import { loadBackendConfig } from "./backendConfig";
import { createSyntheticAiTitle, enrichTitlesWithTmdb, resolveAiSuggestionsToTitles } from "./tmdb";
import { buildDeck, fillDeckFromSources } from "../state/machine";
import type { OnboardingAnswers, TasteProfile, Title } from "../types";
import { mergeCatalog } from "../utils/appState";

interface BuildRecommendationDeckParams {
  answers: OnboardingAnswers;
  profile: TasteProfile;
  catalog: Title[];
  watchRegion: string;
}

export interface BuildRecommendationDeckResult {
  deckTitles: Title[];
  deck: string[];
}

function buildHistoryHints(catalog: Title[], profile: TasteProfile): AiHistoryHints {
  const byId = new Map(catalog.map((title) => [title.id, title]));
  const namesFrom = (ids: string[], cap: number) =>
    ids
      .slice(-cap)
      .map((id) => byId.get(id)?.name)
      .filter((name): name is string => Boolean(name));

  return {
    likedSample: namesFrom(profile.likedIds, 14),
    rejectedSample: namesFrom(profile.rejectedIds, 10),
    seenSample: namesFrom(profile.seenIds, 10),
    lastChosenLabel: profile.lastChosenTitle ? byId.get(profile.lastChosenTitle)?.name : undefined,
    sessionCount: profile.sessionCount
  };
}

export async function buildRecommendationDeck(
  params: BuildRecommendationDeckParams
): Promise<BuildRecommendationDeckResult> {
  const { answers, profile, catalog, watchRegion } = params;
  const { ai: aiEnabled, tmdb: tmdbEnabled } = await loadBackendConfig();
  let deckTitles: Title[] = [];

  if (aiEnabled) {
    assertCanBuildAiDeck(await fetchAiQuota());
    const historyHints = buildHistoryHints(catalog, profile);
    const generated = await generateSuggestionsWithAi({
      answers,
      profile,
      count: 10,
      watchRegion,
      historyHints
    });

    if (generated.length > 0) {
      if (tmdbEnabled) {
        deckTitles = await resolveAiSuggestionsToTitles(generated, answers, profile, 10, watchRegion);
      } else {
        deckTitles = generated.map((item, index) => createSyntheticAiTitle(item, answers, index));
      }
    }
  }

  if (deckTitles.length === 0) {
    const activeProfile = answers.usePersonalization ? profile : createDefaultProfile();
    const pool = prepareSwipeCandidatePool(catalog, answers, activeProfile);
    const sorted = rankTitles(pool.length ? pool : catalog, answers, activeProfile);
    const top20 = sorted.slice(0, 20);
    const reranked = await rerankCandidatesWithAi({
      answers,
      profile: activeProfile,
      candidates: top20,
      watchRegion,
      historyHints: buildHistoryHints(catalog, profile)
    });
    const baseDeckTitles = (reranked.length ? reranked : top20).slice(0, 10);
    deckTitles = tmdbEnabled ? await enrichTitlesWithTmdb(baseDeckTitles, watchRegion) : baseDeckTitles;
  }

  if (deckTitles.length > 0) {
    deckTitles = deckTitles.filter((title) => passesCandidateConstraints(title, answers));
  }

  const catalogForDeck = deckTitles.length > 0 ? mergeCatalog(catalog, deckTitles) : catalog;
  const primaryIds = deckTitles.map((title) => title.id);
  const fallbackIds = buildDeck(catalogForDeck, answers, profile);
  const deck = primaryIds.length > 0 ? fillDeckFromSources(primaryIds, fallbackIds) : fallbackIds;
  return { deckTitles, deck };
}
