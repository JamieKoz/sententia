import { useState } from "react";
import { applyDecisionSignal, applyKeepSignal, applyPassSignal, createDefaultProfile } from "../engine/profile";
import { clearSessionDraft, loadSessionDraft } from "../services/storage";
import { saveLastAnswers } from "../services/storage";
import { trackEvent } from "../services/analytics";
import { apiGateUserMessage } from "../services/apiErrors";
import type { OnboardingAnswers, SessionState, TasteProfile } from "../types";
import { cloneProfile, cloneSession, mergeCatalog } from "../utils/appState";
import { sessionReducer } from "../state/sessionReducer";
import { buildRecommendationDeck } from "../services/deckBuilder";
import { createInitialDeckBuildProgress, type DeckBuildProgress } from "../services/deckBuildProgress";
import { nextPair } from "../state/machine";
import { useSessionStore } from "../state/sessionStore";

export function useSessionFlow(params: {
  watchRegion: string;
}) {
  const { watchRegion } = params;
  const { session, setSession, profile, setProfile, catalog, setCatalog, currentTitle, winner } = useSessionStore();

  const [isBuildingDeck, setIsBuildingDeck] = useState(false);
  const [deckBuildError, setDeckBuildError] = useState<string | null>(null);
  const [deckBuildProgress, setDeckBuildProgress] = useState<DeckBuildProgress | null>(null);
  const [lastSwipeSnapshot, setLastSwipeSnapshot] = useState<{ session: SessionState; profile: TasteProfile } | null>(null);

  async function startSwipeRound(overrideAnswers?: OnboardingAnswers) {
    const activeAnswers = overrideAnswers ?? session.answers;
    clearSessionDraft();
    setIsBuildingDeck(true);
    setDeckBuildError(null);
    setDeckBuildProgress(createInitialDeckBuildProgress());
    setLastSwipeSnapshot(null);
    saveLastAnswers({ ...activeAnswers, quickModeId: undefined });
    trackEvent("deck_build_start", {
      watch_region: watchRegion
    });

    try {
      const activeProfile = activeAnswers.usePersonalization ? profile : createDefaultProfile();
      const { deckTitles, deck } = await buildRecommendationDeck({
        answers: activeAnswers,
        profile: activeProfile,
        catalog,
        watchRegion,
        onProgress: setDeckBuildProgress
      });

      if (deckTitles.length > 0) {
        setCatalog((prev) => mergeCatalog(prev, deckTitles));
      }

      setSession((prev) => {
        const withAnswers = sessionReducer(prev, { type: "UPDATE_ANSWERS", next: activeAnswers });
        return sessionReducer(withAnswers, { type: "DECK_READY", deck });
      });
    } catch (error) {
      const gateMessage = apiGateUserMessage(error);
      setDeckBuildError(
        gateMessage ?? (error instanceof Error ? error.message : "Could not build your deck. Try again.")
      );
    } finally {
      setIsBuildingDeck(false);
      setDeckBuildProgress(null);
    }
  }

  function clearDeckBuildError() {
    setDeckBuildError(null);
    setDeckBuildProgress(null);
  }

  function handleSwipe(action: "keep" | "pass") {
    const titleId = currentTitle?.id;
    if (!titleId) return;
    setLastSwipeSnapshot({
      session: cloneSession(session),
      profile: cloneProfile(profile)
    });

    if (action === "keep") {
      setProfile((prev) => applyKeepSignal(prev, currentTitle!));
    } else {
      setProfile((prev) => applyPassSignal(prev, currentTitle!));
    }

    setSession((prev) => sessionReducer(prev, { type: "SWIPE", action, titleId }));
  }

  function handleUndoSwipe() {
    if (!lastSwipeSnapshot) return;
    setSession(lastSwipeSnapshot.session);
    setProfile(lastSwipeSnapshot.profile);
    setLastSwipeSnapshot(null);
  }

  function handleShowdownPick(winnerPick: "left" | "right") {
    const pair = nextPair(session.showdownQueue);
    if (!pair) return;
    const [leftId, rightId] = pair;
    const winnerId = winnerPick === "left" ? leftId : rightId;
    const loserId = winnerPick === "left" ? rightId : leftId;

    setSession((prev) => sessionReducer(prev, { type: "SHOWDOWN_PICK", winnerId, loserId }));
  }

  function finalizeDecision() {
    if (!winner) return;
    setProfile((prev) => applyDecisionSignal(prev, winner));
  }

  function resetAndStartNewRound() {
    clearSessionDraft();
    setLastSwipeSnapshot(null);
    setSession((prev) => sessionReducer(prev, { type: "RESET_ROUND" }));
  }

  function resumeDraftSession() {
    const draft = loadSessionDraft();
    if (!draft) return false;
    setCatalog((prev) => mergeCatalog(prev, draft.catalog));
    setSession({ ...draft.session });
    setLastSwipeSnapshot(null);
    return true;
  }

  return {
    isBuildingDeck,
    deckBuildError,
    deckBuildProgress,
    clearDeckBuildError,
    canUndo: Boolean(lastSwipeSnapshot),
    startSwipeRound,
    handleSwipe,
    handleUndoSwipe,
    handleShowdownPick,
    finalizeDecision,
    resetAndStartNewRound,
    resumeDraftSession
  };
}
