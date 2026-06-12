import { passesAiDeckConstraints, passesCandidateConstraints, prepareSwipeCandidatePool } from "../engine/candidateFilters";
import { createDefaultProfile } from "../engine/profile";
import { rankTitles } from "../engine/scoring";
import type { AiHistoryHints, AiSuggestedTitle } from "./ai";
import { rerankCandidatesWithAi, streamGenerateSuggestionsForRequest } from "./ai";
import { assertCanBuildAiDeck, fetchAiQuota } from "./aiQuota";
import { loadBackendConfig } from "./backendConfig";
import {
  createSyntheticAiTitle,
  enrichTitlesWithTmdb,
  resolveSingleAiSuggestionToTitle
} from "./tmdb";
import { buildDeck, DECK_SIZE, fillDeckFromSources } from "../state/machine";
import type { OnboardingAnswers, TasteProfile, Title } from "../types";
import { mergeCatalog } from "../utils/appState";
import { loadSoloHistory, loadGroupHistory } from "./storage";
import { DeckBuildProgressReporter, type DeckBuildProgress } from "./deckBuildProgress";

interface BuildRecommendationDeckParams {
  answers: OnboardingAnswers;
  profile: TasteProfile;
  catalog: Title[];
  watchRegion: string;
  onProgress?: (progress: DeckBuildProgress) => void;
}

const AI_GENERATION_CANDIDATE_COUNT = 30;
const AI_REFILL_CANDIDATE_COUNT = 20;
const MAX_AI_REFILL_ROUNDS = 2;

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

  // Pull past winners from solo and group history to feed as liked samples
  const soloWinners: string[] = loadSoloHistory()
    .slice(-10)
    .map((e) => e.winner.name);
  const groupWinners: string[] = loadGroupHistory()
    .slice(-10)
    .flatMap((e) => [e.myPick?.name, e.partnerPick?.name, e.sharedCompromise?.name])
    .filter((name): name is string => Boolean(name));
  const historyLikedSample = [...soloWinners, ...groupWinners];

  return {
    likedSample: [...historyLikedSample, ...namesFrom(profile.likedIds, 14)],
    rejectedSample: namesFrom(profile.rejectedIds, 10),
    seenSample: namesFrom(profile.seenIds, 10),
    lastChosenLabel: profile.lastChosenTitle ? byId.get(profile.lastChosenTitle)?.name : undefined,
    sessionCount: profile.sessionCount
  };
}

function shuffleTitles<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

function filterDeckTitles(
  titles: Title[],
  answers: OnboardingAnswers,
  usedAiSuggestions: boolean,
  blockedIds: Set<string>
): Title[] {
  return titles
    .filter((title) =>
      usedAiSuggestions ? passesAiDeckConstraints(title, answers) : passesCandidateConstraints(title, answers)
    )
    .filter((title) => !blockedIds.has(title.id));
}

function mergeUniqueTitles(existing: Title[], incoming: Title[]): Title[] {
  const seen = new Set(existing.map((title) => title.id));
  const merged = [...existing];
  for (const title of incoming) {
    if (seen.has(title.id)) continue;
    seen.add(title.id);
    merged.push(title);
  }
  return merged;
}

async function resolveStreamedSuggestion(
  suggestion: AiSuggestedTitle,
  index: number,
  answers: OnboardingAnswers,
  profile: TasteProfile,
  watchRegion: string,
  tmdbEnabled: boolean
): Promise<Title | null> {
  if (tmdbEnabled) {
    return resolveSingleAiSuggestionToTitle(suggestion, index, answers, profile, watchRegion);
  }
  return createSyntheticAiTitle(suggestion, answers, index);
}

async function streamAndResolveSuggestions(params: {
  answers: OnboardingAnswers;
  profile: TasteProfile;
  watchRegion: string;
  historyHints: AiHistoryHints;
  blockedIds: Set<string>;
  tmdbEnabled: boolean;
  count: number;
  excludeNames?: string[];
  targetResolvedCount: number;
  progress?: DeckBuildProgressReporter;
}): Promise<Title[]> {
  const {
    answers,
    profile,
    watchRegion,
    historyHints,
    blockedIds,
    tmdbEnabled,
    count,
    excludeNames,
    targetResolvedCount,
    progress
  } = params;

  const deckTitles: Title[] = [];
  const seenIds = new Set<string>();
  const pending: Promise<void>[] = [];
  const abortController = new AbortController();
  let suggestionIndex = 0;

  const maybeAbort = () => {
    if (deckTitles.length >= targetResolvedCount) {
      abortController.abort();
    }
  };

  await streamGenerateSuggestionsForRequest(
    {
      answers,
      profile,
      count,
      watchRegion,
      historyHints,
      excludeNames
    },
    (suggestion) => {
      if (abortController.signal.aborted) return;
      progress?.noteSuggestion(suggestion.name);
      const currentIndex = suggestionIndex;
      suggestionIndex += 1;
      const task = resolveStreamedSuggestion(
        suggestion,
        currentIndex,
        answers,
        profile,
        watchRegion,
        tmdbEnabled
      ).then((title) => {
        if (!title || seenIds.has(title.id)) return;
        if (!filterDeckTitles([title], answers, true, blockedIds).length) return;
        seenIds.add(title.id);
        deckTitles.push(title);
        progress?.noteResolved({
          name: title.name,
          type: title.type,
          posterPath: title.posterPath
        });
        maybeAbort();
      });
      pending.push(task);
    },
    { signal: abortController.signal, maxSuggestions: count }
  );

  await Promise.all(pending);
  return deckTitles;
}

async function accumulateAiDeckTitles(params: {
  answers: OnboardingAnswers;
  profile: TasteProfile;
  watchRegion: string;
  historyHints: AiHistoryHints;
  blockedIds: Set<string>;
  tmdbEnabled: boolean;
  progress?: DeckBuildProgressReporter;
}): Promise<Title[]> {
  const { answers, profile, watchRegion, historyHints, blockedIds, tmdbEnabled, progress } = params;
  let deckTitles = await streamAndResolveSuggestions({
    answers,
    profile,
    watchRegion,
    historyHints,
    blockedIds,
    tmdbEnabled,
    count: AI_GENERATION_CANDIDATE_COUNT,
    targetResolvedCount: DECK_SIZE,
    progress
  });

  let refillRound = 0;
  while (deckTitles.length < DECK_SIZE && refillRound < MAX_AI_REFILL_ROUNDS) {
    const beforeCount = deckTitles.length;
    const refillTitles = await streamAndResolveSuggestions({
      answers,
      profile,
      watchRegion,
      historyHints,
      blockedIds,
      tmdbEnabled,
      count: AI_REFILL_CANDIDATE_COUNT,
      excludeNames: deckTitles.map((title) => title.name),
      targetResolvedCount: DECK_SIZE - deckTitles.length,
      progress
    });
    if (refillTitles.length === 0) break;

    deckTitles = mergeUniqueTitles(deckTitles, refillTitles);
    refillRound += 1;
    if (deckTitles.length === beforeCount) break;
  }

  return deckTitles;
}

export async function buildRecommendationDeck(
  params: BuildRecommendationDeckParams
): Promise<BuildRecommendationDeckResult> {
  const { answers, profile, catalog, watchRegion, onProgress } = params;
  const progress = onProgress ? new DeckBuildProgressReporter(onProgress) : undefined;
  const { ai: aiEnabled, tmdb: tmdbEnabled } = await loadBackendConfig();
  const blockedIds = new Set(profile.rejectedIds);
  let deckTitles: Title[] = [];
  let usedAiSuggestions = false;

  if (aiEnabled) {
    assertCanBuildAiDeck(await fetchAiQuota());
    const historyHints = buildHistoryHints(catalog, profile);
    deckTitles = await accumulateAiDeckTitles({
      answers,
      profile,
      watchRegion,
      historyHints,
      blockedIds,
      tmdbEnabled,
      progress
    });
    usedAiSuggestions = deckTitles.length > 0;
  }

  if (deckTitles.length === 0) {
    progress?.setPhase("fallback");
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
    const baseDeckTitles = shuffleTitles(reranked.length ? reranked : top20);
    deckTitles = tmdbEnabled ? await enrichTitlesWithTmdb(baseDeckTitles, watchRegion) : baseDeckTitles;
    deckTitles = filterDeckTitles(deckTitles, answers, false, blockedIds);
  }

  if (usedAiSuggestions && deckTitles.length === 0) {
    throw new Error("Could not find real streaming matches for those filters. Try broadening provider or format choices.");
  }

  const shuffledPrimary = shuffleTitles(deckTitles);
  let catalogForDeck = (deckTitles.length > 0 ? mergeCatalog(catalog, deckTitles) : catalog).filter(
    (title) => !blockedIds.has(title.id)
  );
  const primaryIds = shuffledPrimary.map((title) => title.id);
  const fallbackIds = buildDeck(catalogForDeck, answers, profile);
  let deck = fillDeckFromSources(primaryIds, fallbackIds, DECK_SIZE);

  if (tmdbEnabled && deck.length > 0) {
    progress?.setPhase("finalizing");
    const selectedTitles = deck
      .map((id) => catalogForDeck.find((title) => title.id === id))
      .filter((title): title is Title => Boolean(title));
    const enrichedSelectedTitles = await enrichTitlesWithTmdb(selectedTitles, watchRegion);
    catalogForDeck = mergeCatalog(catalogForDeck, enrichedSelectedTitles);
    deckTitles = enrichedSelectedTitles;
    deck = enrichedSelectedTitles.map((title) => title.id);
  } else {
    deckTitles = deck
      .map((id) => catalogForDeck.find((title) => title.id === id))
      .filter((title): title is Title => Boolean(title));
  }

  return { deckTitles, deck };
}
