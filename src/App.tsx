import { useEffect, useState } from "react";
import { AppHeader } from "./components/AppHeader";
import { ThumbnailBackdrop } from "./components/ThumbnailBackdrop";
import { QuestionsSection } from "./components/QuestionsSection";
import { ResultSection } from "./components/ResultSection";
import { GroupResultSection } from "./components/GroupResultSection";
import { ShowdownDetailsModal } from "./components/ShowdownDetailsModal";
import { ShowdownSection } from "./components/ShowdownSection";
import { SwipeSection } from "./components/SwipeSection";
import { createDefaultProfile } from "./engine/profile";
import { useQuickSetup } from "./hooks/useQuickSetup";
import { useShareCurrentTitle } from "./hooks/useShareCurrentTitle";
import { useGroupSessionFlow } from "./hooks/useGroupSessionFlow";
import { useSessionFlow } from "./hooks/useSessionFlow";
import { openWatchUrl } from "./services/affiliate";
import { loadBackendConfig } from "./services/backendConfig";
import {
  bootstrapViewerPrefs,
  loadViewerPrefs,
  saveViewerPrefs,
  setManualWatchRegion
} from "./services/viewerPrefs";
import { resetPersonalization, saveProfile } from "./services/storage";
import type { Title, ViewerPrefs } from "./types";
import { useSessionStore } from "./state/sessionStore";

export function App() {
  const {
    profile,
    setProfile,
    session,
    currentTitle,
    nextSwipeTitle,
    showdownLeft,
    showdownRight,
    winner,
    backup,
    isCardFocusedPhase
  } = useSessionStore();
  const [viewerPrefs, setViewerPrefs] = useState<ViewerPrefs>(() => {
    if (typeof window === "undefined") {
      return { version: 1, watchRegion: "US", source: "auto" };
    }
    return loadViewerPrefs();
  });
  const [showdownDetailsTitle, setShowdownDetailsTitle] = useState<Title | null>(null);

  const {
    customYearStartPct,
    customYearEndPct,
    updateAnswers,
    beginOnboarding,
    toggleProvider,
    toggleExclusion,
    toggleMood,
    toggleCustomYearRange,
    updateCustomYearRange
  } = useQuickSetup();

  const {
    isBuildingDeck,
    deckBuildError,
    clearDeckBuildError,
    canUndo,
    startSwipeRound,
    handleSwipe,
    handleUndoSwipe: undoSwipeSessionState,
    handleShowdownPick,
    finalizeDecision,
    resetAndStartNewRound
  } = useSessionFlow({ watchRegion: viewerPrefs.watchRegion });
  const groupFlow = useGroupSessionFlow({ watchRegion: viewerPrefs.watchRegion });

  const activeSwipeTitle = groupFlow.state.phase === "swipe" ? groupFlow.currentTitle : currentTitle;
  const { shareFeedback, handleShareCurrentTitle } = useShareCurrentTitle(activeSwipeTitle);
  const isGroupCardFocusedPhase = groupFlow.state.phase === "swipe" || groupFlow.state.phase === "showdown";
  const [hasAttemptedRoomJoin, setHasAttemptedRoomJoin] = useState(false);

  function handleUndoSwipe() {
    undoSwipeSessionState();
  }

  function handleGroupUndoSwipe() {
    groupFlow.handleUndoSwipe();
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    void loadBackendConfig();
    void bootstrapViewerPrefs().then(setViewerPrefs);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (hasAttemptedRoomJoin) return;
    const roomCode = new URLSearchParams(window.location.search).get("room");
    if (!roomCode || groupFlow.state.phase !== "idle") return;
    setHasAttemptedRoomJoin(true);
    void groupFlow.joinRoom(roomCode);
  }, [groupFlow.state.phase, hasAttemptedRoomJoin]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    saveViewerPrefs(viewerPrefs);
  }, [viewerPrefs]);

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

    if (isCardFocusedPhase || isGroupCardFocusedPhase) {
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
  }, [isCardFocusedPhase, isGroupCardFocusedPhase]);

  function handleResetPersonalization() {
    resetPersonalization();
    setProfile(createDefaultProfile());
    void bootstrapViewerPrefs().then(setViewerPrefs);
  }

  function handleWatchRegionChange(watchRegion: string) {
    setViewerPrefs((prev) => setManualWatchRegion(prev, watchRegion));
  }

  function handleWatchNow() {
    finalizeDecision();
    if (!winner || typeof window === "undefined") return;
    openWatchUrl(winner, viewerPrefs.watchRegion);
  }

  async function handleStartGroup() {
    await groupFlow.startHostedGroupRound({
      answers: session.answers
    });
  }

  const showGroupFlow = groupFlow.state.phase !== "idle";
  const groupWaitingStatus = groupFlow.state.status;

  useEffect(() => {
    if (!showGroupFlow) return;
    if (
      groupFlow.state.phase !== "lobby" &&
      groupFlow.state.phase !== "showdown" &&
      groupFlow.state.phase !== "result"
    ) {
      return;
    }
    void groupFlow.loadRoomStatus();
    const timer = window.setInterval(() => {
      void groupFlow.loadRoomStatus();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [showGroupFlow, groupFlow.state.phase]);

  useEffect(() => {
    if (groupFlow.state.phase !== "showdown" && groupFlow.state.phase !== "result") return;
    if (groupFlow.state.submitted) return;
    void groupFlow.submitAndPollStatus();
  }, [groupFlow.state.phase, groupFlow.state.submitted]);

  useEffect(() => {
    if (groupFlow.state.phase !== "result") return;
    if (!groupFlow.myPick) return;
    void groupFlow.shareFinalPick();
  }, [groupFlow.state.phase, groupFlow.myPick?.id]);

  useEffect(() => {
    if (groupFlow.state.phase !== "result") return;
    if (!groupFlow.compromisePick) return;
    void groupFlow.shareCompromisePick();
  }, [groupFlow.state.phase, groupFlow.compromisePick?.id]);

  return (
    <div className="relative min-h-screen">
      <ThumbnailBackdrop />
      <div className="pointer-events-none fixed inset-0 z-10 bg-[radial-gradient(ellipse_85%_70%_at_50%_45%,rgba(0,0,0,0.15),rgba(0,0,0,0.92))]" />
      <div className="pointer-events-none fixed inset-0 z-10 bg-gradient-to-b from-black/35 via-black/20 to-black/45" />

      <main className="relative z-20 mx-auto max-w-5xl px-3 py-3 text-zinc-100 sm:px-4 sm:py-5 md:py-10 mb-16">
        {!isCardFocusedPhase && session.phase !== "questions" && !showGroupFlow ? (
          <AppHeader
            viewerPrefs={viewerPrefs}
            onWatchRegionChange={handleWatchRegionChange}
            onClearCache={handleResetPersonalization}
          />
        ) : null}

        {session.phase === "questions" && !showGroupFlow ? (
          <QuestionsSection
            answers={session.answers}
            isBuildingDeck={isBuildingDeck || groupFlow.isBusy}
            deckBuildError={deckBuildError}
            onDismissDeckBuildError={clearDeckBuildError}
            customYearStartPct={customYearStartPct}
            customYearEndPct={customYearEndPct}
            onBegin={beginOnboarding}
            onUpdateAnswers={updateAnswers}
            onToggleCustomYearRange={toggleCustomYearRange}
            onUpdateCustomYearRange={updateCustomYearRange}
            onToggleProvider={toggleProvider}
            onToggleExclusion={toggleExclusion}
            onToggleMood={toggleMood}
            viewerPrefs={viewerPrefs}
            onWatchRegionChange={handleWatchRegionChange}
            onClearCache={handleResetPersonalization}
            onStartSolo={startSwipeRound}
            onStartGroup={handleStartGroup}
          />
        ) : null}

        {groupFlow.state.phase === "joining" ? (
          <section className="rounded-3xl border border-white/20 p-6 shadow-2xl backdrop-blur-lg">
            <h2 className="text-xl font-semibold text-white">Joining room…</h2>
            <p className="mt-2 text-sm text-zinc-300">Loading the shared deck.</p>
          </section>
        ) : null}

        {groupFlow.state.phase === "lobby" ? (
          <section className="rounded-3xl border border-white/20 p-6 shadow-2xl backdrop-blur-lg">
            <h2 className="text-xl font-semibold text-white">Room ready: {groupFlow.state.roomCode}</h2>
            <p className="mt-2 text-sm text-zinc-300">
              Share this link. Swiping starts automatically when both participants have joined.
            </p>
            <div className="mt-4 rounded-xl border border-white/15 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-100">
              {groupFlow.state.shareUrl}
            </div>
            {groupWaitingStatus ? (
              <p className="mt-3 text-sm text-zinc-200">
                Joined: {groupWaitingStatus.participantsTotal} / {groupWaitingStatus.maxParticipants}
              </p>
            ) : null}
            <div className="mt-4 flex gap-3">
              <button
                className="rounded-full border border-white/30 bg-zinc-900/60 px-4 py-2 text-sm transition hover:border-white/50 hover:bg-zinc-800/75"
                onClick={async () => {
                  if (!groupFlow.state.shareUrl) return;
                  await navigator.clipboard.writeText(groupFlow.state.shareUrl);
                }}
              >
                Copy invite link
              </button>
            </div>
          </section>
        ) : null}

        {session.phase === "swipe" && currentTitle && !showGroupFlow ? (
          <SwipeSection
            currentTitle={currentTitle}
            nextSwipeTitle={nextSwipeTitle}
            deckCursor={session.deckCursor}
            deckLength={session.deck.length}
            shortlistLength={session.shortlist.length}
            canUndo={canUndo}
            shareFeedback={shareFeedback}
            onPass={() => handleSwipe("pass")}
            onKeep={() => handleSwipe("keep")}
            onUndo={handleUndoSwipe}
            onShare={handleShareCurrentTitle}
          />
        ) : null}

        {groupFlow.state.phase === "swipe" && groupFlow.currentTitle ? (
          <SwipeSection
            currentTitle={groupFlow.currentTitle}
            nextSwipeTitle={groupFlow.nextSwipeTitle}
            deckCursor={groupFlow.state.deckCursor}
            deckLength={groupFlow.state.deck.length}
            shortlistLength={groupFlow.state.shortlist.length}
            canUndo={groupFlow.canUndo}
            shareFeedback={shareFeedback}
            onPass={() => groupFlow.handleSwipe("pass")}
            onKeep={() => groupFlow.handleSwipe("keep")}
            onUndo={handleGroupUndoSwipe}
            onShare={handleShareCurrentTitle}
          />
        ) : null}

        {session.phase === "showdown" && showdownLeft && showdownRight && !showGroupFlow ? (
          <ShowdownSection
            left={showdownLeft}
            right={showdownRight}
            onPickLeft={() => handleShowdownPick("left")}
            onPickRight={() => handleShowdownPick("right")}
            onShowMoreLeft={() => setShowdownDetailsTitle(showdownLeft)}
            onShowMoreRight={() => setShowdownDetailsTitle(showdownRight)}
          />
        ) : null}

        {groupFlow.state.phase === "showdown" && groupFlow.showdownLeft && groupFlow.showdownRight ? (
          <ShowdownSection
            left={groupFlow.showdownLeft}
            right={groupFlow.showdownRight}
            onPickLeft={() => groupFlow.handleShowdownPick("left")}
            onPickRight={() => groupFlow.handleShowdownPick("right")}
            onShowMoreLeft={() => setShowdownDetailsTitle(groupFlow.showdownLeft ?? null)}
            onShowMoreRight={() => setShowdownDetailsTitle(groupFlow.showdownRight ?? null)}
          />
        ) : null}

        {session.phase === "result" && winner && !showGroupFlow ? (
          <ResultSection
            winner={winner}
            backup={backup}
            onWatchNow={handleWatchNow}
            onPickAnother={resetAndStartNewRound}
          />
        ) : null}

        {groupFlow.state.phase === "result" ? (
          <GroupResultSection
            personalPicks={[
              { label: "You", title: groupFlow.myPick ?? groupFlow.winner },
              { label: "Partner", title: groupFlow.partnerPick }
            ]}
            overlapTitles={groupFlow.state.mutualMatchIds
              .map((id) => groupFlow.state.deck.find((title) => title.id === id))
              .filter((title): title is Title => Boolean(title))}
            myCompromisePick={groupFlow.compromisePick}
            partnerCompromisePick={groupFlow.partnerCompromisePick}
            partnerRequestedCompromise={groupFlow.partnerRequestedCompromise}
            sharedCompromise={groupFlow.sharedCompromise}
            compromiseMatched={groupFlow.compromiseMatched}
            onStartCompromiseShowdown={groupFlow.startCompromiseShowdown}
            onWatchNow={(title) => openWatchUrl(title, viewerPrefs.watchRegion)}
            onShowMore={(title) => setShowdownDetailsTitle(title)}
            onStartAnotherRound={groupFlow.reset}
          />
        ) : null}

        {groupFlow.error ? (
          <section className="mt-4 rounded-2xl border border-rose-400/40 bg-rose-950/35 px-4 py-3 text-sm text-rose-200">
            {groupFlow.error}
          </section>
        ) : null}

        {groupFlow.notice ? (
          <section className="mt-4 rounded-2xl border border-blue-300/35 bg-blue-950/30 px-4 py-3 text-sm text-blue-100">
            {groupFlow.notice}
          </section>
        ) : null}

        {showdownDetailsTitle ? <ShowdownDetailsModal title={showdownDetailsTitle} onClose={() => setShowdownDetailsTitle(null)} /> : null}
      </main>
    </div>
  );
}
