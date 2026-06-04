import { useState } from "react";
import { passesCandidateConstraints, prepareSwipeCandidatePool } from "../engine/candidateFilters";
import { applyDecisionSignal, applyKeepSignal, applyPassSignal, createDefaultProfile } from "../engine/profile";
import { rankTitles } from "../engine/scoring";
import type { AiHistoryHints } from "../services/ai";
import { generateSuggestionsWithAi, rerankCandidatesWithAi } from "../services/ai";
import { saveLastAnswers } from "../services/storage";
import { trackEvent } from "../services/analytics";
import { apiGateUserMessage } from "../services/apiErrors";
import { loadBackendConfig } from "../services/backendConfig";
import { enrichTitlesWithTmdb, resolveAiSuggestionsToTitles } from "../services/tmdb";
import { buildDeck, createSession, fillDeckFromSources } from "../state/machine";
import type { OnboardingAnswers, SessionState, TasteProfile, Title } from "../types";
import { cloneProfile, cloneSession, mergeCatalog, slugify } from "../utils/appState";

export function useSessionFlow(params: {
  session: SessionState;
  setSession: React.Dispatch<React.SetStateAction<SessionState>>;
  profile: TasteProfile;
  setProfile: React.Dispatch<React.SetStateAction<TasteProfile>>;
  catalog: Title[];
  setCatalog: React.Dispatch<React.SetStateAction<Title[]>>;
  watchRegion: string;
  currentTitle?: Title;
  showdownLeft?: Title;
  showdownRight?: Title;
  winner?: Title;
}) {
  const {
    session,
    setSession,
    profile,
    setProfile,
    catalog,
    setCatalog,
    watchRegion,
    currentTitle,
    showdownLeft,
    showdownRight,
    winner
  } = params;

  const [isBuildingDeck, setIsBuildingDeck] = useState(false);
  const [deckBuildError, setDeckBuildError] = useState<string | null>(null);
  const [lastSwipeSnapshot, setLastSwipeSnapshot] = useState<{ session: SessionState; profile: TasteProfile } | null>(null);

  function buildHistoryHints(): AiHistoryHints {
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

  async function startSwipeRound() {
    setIsBuildingDeck(true);
    setDeckBuildError(null);
    setLastSwipeSnapshot(null);
    saveLastAnswers({ ...session.answers, quickModeId: undefined });
    trackEvent("deck_build_start", {
      watch_region: watchRegion
    });

    try {
      const { ai: aiEnabled, tmdb: tmdbEnabled } = await loadBackendConfig();
      let deckTitles: Title[] = [];

      if (aiEnabled) {
        const historyHints = buildHistoryHints();
        const generated = await generateSuggestionsWithAi({
          answers: session.answers,
          profile,
          count: 10,
          watchRegion,
          historyHints
        });

        if (generated.length > 0) {
          if (tmdbEnabled) {
            deckTitles = await resolveAiSuggestionsToTitles(
              generated,
              session.answers,
              profile,
              10,
              watchRegion
            );
          } else {
            deckTitles = generated.map((item, index) => ({
              id: `ai-${index}-${slugify(item.name)}`,
              name: item.name,
              type: item.type,
              runtimeMinutes: item.type === "series" ? 45 : 110,
              genres: [],
              moods: [...(session.answers.moods ?? [])],
              language: session.answers.languages?.[0] ?? "en",
              providers: [...(session.answers.providers ?? [])],
              popularity: 0.6,
              releaseYear: new Date().getFullYear(),
              posterPath: null,
              overview: item.reason ?? "AI-picked for your current vibe."
            }));
          }
        }
      }

      if (deckTitles.length === 0) {
        const activeProfile = session.answers.usePersonalization ? profile : createDefaultProfile();
        const pool = prepareSwipeCandidatePool(catalog, session.answers, activeProfile);
        const sorted = rankTitles(pool.length ? pool : catalog, session.answers, activeProfile);
        const top20 = sorted.slice(0, 20);
        const reranked = await rerankCandidatesWithAi({
          answers: session.answers,
          profile: activeProfile,
          candidates: top20,
          watchRegion,
          historyHints: buildHistoryHints()
        });
        const baseDeckTitles = (reranked.length ? reranked : top20).slice(0, 10);
        deckTitles = tmdbEnabled
          ? await enrichTitlesWithTmdb(baseDeckTitles, watchRegion)
          : baseDeckTitles;
      }

      if (deckTitles.length > 0) {
        deckTitles = deckTitles.filter((title) => passesCandidateConstraints(title, session.answers));
        setCatalog((prev) => mergeCatalog(prev, deckTitles));
      }

      const catalogForDeck = deckTitles.length > 0 ? mergeCatalog(catalog, deckTitles) : catalog;
      const primaryIds = deckTitles.map((title) => title.id);
      const fallbackIds = buildDeck(catalogForDeck, session.answers, profile);
      const deck =
        primaryIds.length > 0 ? fillDeckFromSources(primaryIds, fallbackIds) : fallbackIds;

      setSession((prev) => ({
        ...prev,
        phase: "swipe",
        deck,
        deckCursor: 0,
        shortlist: [],
        passed: [],
        showdownQueue: [],
        winnerId: undefined,
        backupId: undefined
      }));
    } catch (error) {
      const gateMessage = apiGateUserMessage(error);
      setDeckBuildError(
        gateMessage ?? (error instanceof Error ? error.message : "Could not build your deck. Try again.")
      );
    } finally {
      setIsBuildingDeck(false);
    }
  }

  function clearDeckBuildError() {
    setDeckBuildError(null);
  }

  function handleSwipe(action: "keep" | "pass") {
    if (!currentTitle) return;
    setLastSwipeSnapshot({
      session: cloneSession(session),
      profile: cloneProfile(profile)
    });

    if (action === "keep") {
      setProfile((prev) => applyKeepSignal(prev, currentTitle));
    } else {
      setProfile((prev) => applyPassSignal(prev, currentTitle));
    }

    setSession((prev) => {
      const shortlist = action === "keep" ? [...prev.shortlist, currentTitle.id] : prev.shortlist;
      const passed = action === "pass" ? [...prev.passed, currentTitle.id] : prev.passed;
      const nextCursor = prev.deckCursor + 1;

      if (shortlist.length >= 5) {
        return {
          ...prev,
          phase: "showdown",
          shortlist,
          passed,
          showdownQueue: [...shortlist]
        };
      }

      if (nextCursor >= prev.deck.length) {
        if (shortlist.length >= 2) {
          return {
            ...prev,
            phase: "showdown",
            shortlist,
            passed,
            showdownQueue: [...shortlist]
          };
        }

        return {
          ...prev,
          phase: "questions",
          shortlist,
          passed,
          deck: [],
          deckCursor: 0,
          answers: {
            ...prev.answers,
            moods: prev.answers.moods?.includes("light") ? ["intense"] : ["light"]
          }
        };
      }

      return {
        ...prev,
        shortlist,
        passed,
        deckCursor: nextCursor
      };
    });
  }

  function handleUndoSwipe() {
    if (!lastSwipeSnapshot) return;
    setSession(lastSwipeSnapshot.session);
    setProfile(lastSwipeSnapshot.profile);
    setLastSwipeSnapshot(null);
  }

  function handleShowdownPick(winnerPick: "left" | "right") {
    if (!showdownLeft || !showdownRight) return;

    const winnerId = winnerPick === "left" ? showdownLeft.id : showdownRight.id;
    const loserId = winnerPick === "left" ? showdownRight.id : showdownLeft.id;

    setSession((prev) => {
      const [first, second, ...rest] = prev.showdownQueue;
      if (!first || !second) return prev;

      const nextQueue = [...rest, winnerId];
      if (nextQueue.length === 1) {
        return {
          ...prev,
          phase: "result",
          showdownQueue: nextQueue,
          winnerId,
          backupId: loserId
        };
      }

      return {
        ...prev,
        showdownQueue: nextQueue
      };
    });
  }

  function finalizeDecision() {
    if (!winner) return;
    setProfile((prev) => applyDecisionSignal(prev, winner));
  }

  function resetAndStartNewRound() {
    const nextAnswers: OnboardingAnswers = {
      ...session.answers,
      quickModeId: undefined
    };
    setSession(() => ({
      ...createSession(nextAnswers),
      answers: nextAnswers
    }));
  }

  return {
    isBuildingDeck,
    deckBuildError,
    clearDeckBuildError,
    canUndo: Boolean(lastSwipeSnapshot),
    startSwipeRound,
    handleSwipe,
    handleUndoSwipe,
    handleShowdownPick,
    finalizeDecision,
    resetAndStartNewRound
  };
}
