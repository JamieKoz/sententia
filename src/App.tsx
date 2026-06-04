import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "./components/AppHeader";
import { ThumbnailBackdrop } from "./components/ThumbnailBackdrop";
import { QuestionsSection } from "./components/QuestionsSection";
import { ResultSection } from "./components/ResultSection";
import { ShowdownDetailsModal } from "./components/ShowdownDetailsModal";
import { ShowdownSection } from "./components/ShowdownSection";
import { SwipeSection } from "./components/SwipeSection";
import { MOCK_TITLES } from "./data/mockTitles";
import { createDefaultProfile } from "./engine/profile";
import { useQuickSetup } from "./hooks/useQuickSetup";
import { useShareCurrentTitle } from "./hooks/useShareCurrentTitle";
import { useSessionFlow } from "./hooks/useSessionFlow";
import { useSwipeGesture } from "./hooks/useSwipeGesture";
import { loadLastAnswers, loadProfile, resetPersonalization, saveProfile } from "./services/storage";
import { createInitialAnswers, createSession, nextPair } from "./state/machine";
import type { SessionState, Title } from "./types";

export function App() {
  const [profile, setProfile] = useState(() => {
    if (typeof window === "undefined") return createDefaultProfile();
    return loadProfile();
  });

  const [session, setSession] = useState<SessionState>(() => {
    const seed = typeof window === "undefined" ? {} : loadLastAnswers();
    return createSession(createInitialAnswers(seed));
  });

  const [catalog, setCatalog] = useState<Title[]>(MOCK_TITLES);
  const [showdownDetailsTitle, setShowdownDetailsTitle] = useState<Title | null>(null);

  const titlesById = useMemo(() => {
    return new Map(catalog.map((title) => [title.id, title]));
  }, [catalog]);

  const currentTitle = session.phase === "swipe" ? titlesById.get(session.deck[session.deckCursor]) : undefined;
  const nextSwipeTitle = session.phase === "swipe" ? titlesById.get(session.deck[session.deckCursor + 1]) : undefined;
  const showdownPair = session.phase === "showdown" ? nextPair(session.showdownQueue) : null;
  const showdownLeft = showdownPair ? titlesById.get(showdownPair[0]) : undefined;
  const showdownRight = showdownPair ? titlesById.get(showdownPair[1]) : undefined;
  const winner = session.winnerId ? titlesById.get(session.winnerId) : undefined;
  const backup = session.backupId ? titlesById.get(session.backupId) : undefined;
  const isCardFocusedPhase = session.phase === "swipe" || session.phase === "showdown";

  const {
    customYearStartPct,
    customYearEndPct,
    updateAnswers,
    beginOnboarding,
    toggleProvider,
    toggleExclusion,
    toggleMood,
    toggleLanguage,
    toggleFamiliarity,
    toggleCustomYearRange,
    updateCustomYearRange
  } = useQuickSetup({
    answers: session.answers,
    profile,
    setSession
  });

  const {
    isBuildingDeck,
    canUndo,
    startSwipeRound,
    handleSwipe,
    handleUndoSwipe: undoSwipeSessionState,
    handleShowdownPick,
    finalizeDecision,
    resetAndStartNewRound
  } = useSessionFlow({
    session,
    setSession,
    profile,
    setProfile,
    catalog,
    setCatalog,
    currentTitle,
    showdownLeft,
    showdownRight,
    winner
  });

  const {
    swipeDeltaX,
    isDraggingCard,
    passOverlayOpacity,
    keepOverlayOpacity,
    onSwipePointerDown,
    onSwipePointerMove,
    onSwipePointerEnd,
    resetSwipeGesture
  } = useSwipeGesture({
    currentTitleId: currentTitle?.id,
    onSwipeKeep: () => handleSwipe("keep"),
    onSwipePass: () => handleSwipe("pass")
  });

  const { shareFeedback, handleShareCurrentTitle } = useShareCurrentTitle(currentTitle);

  function handleUndoSwipe() {
    undoSwipeSessionState();
    resetSwipeGesture();
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    saveProfile(profile);
  }, [profile]);

  useEffect(() => {
    if (session.phase !== "showdown") {
      setShowdownDetailsTitle(null);
    }
  }, [session.phase]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    if (isCardFocusedPhase) {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isCardFocusedPhase]);

  function handleResetPersonalization() {
    resetPersonalization();
    setProfile(createDefaultProfile());
  }

  function handleWatchNow() {
    finalizeDecision();
    if (!winner || typeof window === "undefined") return;
    const query = encodeURIComponent(`${winner.name} ${winner.releaseYear}`);
    window.open(`https://www.justwatch.com/us/search?q=${query}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="relative min-h-screen">
      <ThumbnailBackdrop />
      <div className="pointer-events-none fixed inset-0 z-10 bg-[radial-gradient(ellipse_85%_70%_at_50%_45%,rgba(0,0,0,0.15),rgba(0,0,0,0.92))]" />
      <div className="pointer-events-none fixed inset-0 z-10 bg-gradient-to-b from-black/55 via-black/35 to-black/85" />

      <main className="relative z-20 mx-auto max-w-5xl px-3 py-3 text-zinc-100 sm:px-4 sm:py-5 md:py-10 mb-16">
        {!isCardFocusedPhase && session.phase !== "questions" ? (
          <AppHeader onClearCache={handleResetPersonalization} />
        ) : null}

        {session.phase === "questions" ? (
          <QuestionsSection
            answers={session.answers}
            isBuildingDeck={isBuildingDeck}
            customYearStartPct={customYearStartPct}
            customYearEndPct={customYearEndPct}
            onBegin={beginOnboarding}
            onUpdateAnswers={updateAnswers}
            onToggleCustomYearRange={toggleCustomYearRange}
            onUpdateCustomYearRange={updateCustomYearRange}
            onToggleProvider={toggleProvider}
            onToggleExclusion={toggleExclusion}
            onToggleMood={toggleMood}
            onToggleLanguage={toggleLanguage}
            onToggleFamiliarity={toggleFamiliarity}
            onClearCache={handleResetPersonalization}
            onStart={startSwipeRound}
          />
        ) : null}

        {session.phase === "swipe" && currentTitle ? (
          <SwipeSection
            currentTitle={currentTitle}
            nextSwipeTitle={nextSwipeTitle}
            deckCursor={session.deckCursor}
            deckLength={session.deck.length}
            shortlistLength={session.shortlist.length}
            isDraggingCard={isDraggingCard}
            swipeDeltaX={swipeDeltaX}
            passOverlayOpacity={passOverlayOpacity}
            keepOverlayOpacity={keepOverlayOpacity}
            canUndo={canUndo}
            shareFeedback={shareFeedback}
            onPointerDown={onSwipePointerDown}
            onPointerMove={onSwipePointerMove}
            onPointerUp={onSwipePointerEnd}
            onPointerCancel={onSwipePointerEnd}
            onPass={() => handleSwipe("pass")}
            onKeep={() => handleSwipe("keep")}
            onUndo={handleUndoSwipe}
            onShare={handleShareCurrentTitle}
          />
        ) : null}

        {session.phase === "showdown" && showdownLeft && showdownRight ? (
          <ShowdownSection
            left={showdownLeft}
            right={showdownRight}
            onPickLeft={() => handleShowdownPick("left")}
            onPickRight={() => handleShowdownPick("right")}
            onShowMoreLeft={() => setShowdownDetailsTitle(showdownLeft)}
            onShowMoreRight={() => setShowdownDetailsTitle(showdownRight)}
          />
        ) : null}

        {session.phase === "result" && winner ? (
          <ResultSection
            winner={winner}
            backup={backup}
            onWatchNow={handleWatchNow}
            onPickAnother={resetAndStartNewRound}
          />
        ) : null}

        {showdownDetailsTitle ? <ShowdownDetailsModal title={showdownDetailsTitle} onClose={() => setShowdownDetailsTitle(null)} /> : null}
      </main>
    </div>
  );
}
