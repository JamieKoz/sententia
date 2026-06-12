import { useEffect, useMemo, useRef, useState } from "react";
import { AppHeader } from "./components/AppHeader";
import { LibraryPanel } from "./components/LibraryPanel";
import { ThumbnailBackdrop } from "./components/ThumbnailBackdrop";
import { QuestionsSection } from "./components/QuestionsSection";
import { ResultSection } from "./components/ResultSection";
import { GroupResultSection } from "./components/GroupResultSection";
import { ShowdownDetailsModal } from "./components/ShowdownDetailsModal";
import { ShowdownSection } from "./components/ShowdownSection";
import { SwipeSection } from "./components/SwipeSection";
import { applyWatchedSignal, createDefaultProfile } from "./engine/profile";
import { useQuickSetup } from "./hooks/useQuickSetup";
import { useShareCurrentTitle } from "./hooks/useShareCurrentTitle";
import { useGroupSessionFlow } from "./hooks/useGroupSessionFlow";
import { useSessionFlow } from "./hooks/useSessionFlow";
import { openTrailerUrl, openWatchUrl } from "./services/affiliate";
import { loadBackendConfig } from "./services/backendConfig";
import { buildWhyThisPick } from "./services/personalizationInsights";
import { hasResumableSessionDraft } from "./services/sessionDraft";
import {
  loadLastAnswers,
  loadGroupHistory,
  loadSavedPicks,
  loadSoloHistory,
  loadWatchedTitles,
  markSoloHistoryFollowUpDone,
  markTitleWatched,
  resetPersonalization,
  saveProfile,
  saveSoloResult,
  toggleSavedPick,
  updateWatchedReaction,
  upsertGroupHistory
} from "./services/storage";
import {
  bootstrapViewerPrefs,
  loadViewerPrefs,
  saveViewerPrefs,
  setManualWatchRegion
} from "./services/viewerPrefs";
import type { Title, ViewerPrefs } from "./types";
import type { SoloHistoryEntry } from "./services/storage";

import { useSessionStore } from "./state/sessionStore";
import { TasteProfileCard } from "./components/TasteProfileCard";
import { createInitialAnswers } from "./state/machine";

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
  const [showTastePanel, setShowTastePanel] = useState(false);
  const [showLibraryPanel, setShowLibraryPanel] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [savedPicks, setSavedPicks] = useState(() => loadSavedPicks());
  const [watchedTitles, setWatchedTitles] = useState(() => loadWatchedTitles());
  const [groupHistory, setGroupHistory] = useState(() => loadGroupHistory());
  const recordedRoomCodesRef = useRef<Set<string>>(new Set());
  const [roomShareFeedback, setRoomShareFeedback] = useState<string | null>(null);

  const {
    customYearStartPct,
    customYearEndPct,
    updateAnswers,
    beginOnboarding,
    toggleProvider,
    toggleExclusion,
    toggleCustomYearRange,
    updateCustomYearRange
  } = useQuickSetup();

  const {
    isBuildingDeck,
    deckBuildError,
    deckBuildProgress,
    clearDeckBuildError,
    canUndo,
    startSwipeRound,
    handleSwipe,
    handleUndoSwipe: undoSwipeSessionState,
    handleShowdownPick,
    finalizeDecision,
    resetAndStartNewRound,
    resumeDraftSession
  } = useSessionFlow({ watchRegion: viewerPrefs.watchRegion });
  const groupFlow = useGroupSessionFlow({ watchRegion: viewerPrefs.watchRegion });

  const activeSwipeTitle = groupFlow.state.phase === "swipe" ? groupFlow.currentTitle : currentTitle;
  const { shareFeedback, handleShareCurrentTitle } = useShareCurrentTitle(activeSwipeTitle);
  const isGroupCardFocusedPhase = groupFlow.state.phase === "swipe" || groupFlow.state.phase === "showdown";
  const [hasAttemptedRoomJoin, setHasAttemptedRoomJoin] = useState(false);
  const [soloHistory, setSoloHistory] = useState<SoloHistoryEntry[]>(() => loadSoloHistory());
  const showGroupFlow = groupFlow.state.phase !== "idle";
  const groupWaitingStatus = groupFlow.state.status;
  const savedIds = useMemo(() => new Set(savedPicks.map((entry) => entry.title.id)), [savedPicks]);
  const winnerReasons = winner ? buildWhyThisPick(winner, session.answers, profile) : [];
  const sharedCompromiseReasons =
    groupFlow.sharedCompromise ? buildWhyThisPick(groupFlow.sharedCompromise, session.answers, profile) : [];

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

  // Auto-save solo result when entering the result phase
  useEffect(() => {
    if (session.phase === "result" && winner && !showGroupFlow && typeof window !== "undefined") {
      saveSoloResult({
        id: crypto.randomUUID?.() ?? `${Date.now()}`,
        winner,
        reasons: winnerReasons,
        recordedAt: new Date().toISOString()
      });
      setSoloHistory(loadSoloHistory());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.phase]);

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
    refreshLibrary();
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

  function handleWatchTrailer(title: Title) {
    if (typeof window === "undefined") return;
    openTrailerUrl(title);
  }

  async function handleStartGroup() {
    await groupFlow.startHostedGroupRound({
      answers: session.answers
    });
  }

  function refreshLibrary() {
    setSavedPicks(loadSavedPicks());
    setWatchedTitles(loadWatchedTitles());
    setGroupHistory(loadGroupHistory());
  }

  function openTastePage() {
    setShowTastePanel(true);
    setShowLibraryPanel(false);
    setShowHistoryPanel(false);
  }

  function openLibraryPage() {
    setShowLibraryPanel(true);
    setShowTastePanel(false);
    setShowHistoryPanel(false);
  }

  function openHistoryPage() {
    setShowHistoryPanel(true);
    setShowTastePanel(false);
    setShowLibraryPanel(false);
  }

  function closeUtilityPage() {
    setShowTastePanel(false);
    setShowLibraryPanel(false);
    setShowHistoryPanel(false);
  }

  function handleToggleSave(title: Title, source: "solo" | "group") {
    toggleSavedPick(title, source);
    refreshLibrary();
  }

  function handleSeenIt(title: Title, reaction?: "up" | "down", source: "solo" | "group" = "solo") {
    markTitleWatched(title, { source, reaction });
    setProfile((prev) => applyWatchedSignal(prev, title, reaction));
    refreshLibrary();
  }

  function handleWatchedReaction(titleId: string, reaction?: "up" | "down") {
    const updated = updateWatchedReaction(titleId, reaction);
    if (updated) {
      setProfile((prev) => applyWatchedSignal(prev, updated.title, reaction));
      refreshLibrary();
    }
  }

  const followUpCandidate = useMemo(() => {
    const latest = soloHistory[0];
    if (!latest || latest.followUpDone) return null;
    const alreadySeen = watchedTitles.some((entry) => entry.title.id === latest.winner.id);
    if (alreadySeen) return null;
    return latest;
  }, [soloHistory, watchedTitles]);

  const hasLastAnswers = Object.keys(loadLastAnswers()).length > 0;
  const hasDraftSession = session.phase === "questions" && hasResumableSessionDraft();
  const showUtilityPage = showTastePanel || showLibraryPanel || showHistoryPanel;

  function handleStartFromLastTime() {
    const seeded = createInitialAnswers(loadLastAnswers());
    void startSwipeRound(seeded);
  }

  function handleFollowUpResponse(reaction?: "up" | "down") {
    if (!followUpCandidate) return;
    if (reaction) {
      handleSeenIt(followUpCandidate.winner, reaction, "solo");
    }
    markSoloHistoryFollowUpDone(followUpCandidate.id);
    setSoloHistory(loadSoloHistory());
  }

  function handleClearTasteSignal(type: "genre" | "mood" | "provider", key: string) {
    setProfile((prev) => {
      const next = {
        ...prev,
        genreAffinity: { ...prev.genreAffinity },
        moodAffinity: { ...prev.moodAffinity },
        providerAffinity: { ...prev.providerAffinity }
      };
      if (type === "genre") next.genreAffinity[key] = 0;
      if (type === "mood") next.moodAffinity[key] = 0;
      if (type === "provider") next.providerAffinity[key] = 0;
      return next;
    });
  }

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

  useEffect(() => {
    if (groupFlow.state.phase !== "result") return;
    const roomCode = groupFlow.state.roomCode;
    if (!roomCode || recordedRoomCodesRef.current.has(roomCode)) return;
    if (!groupFlow.myPick && !groupFlow.partnerPick && !groupFlow.sharedCompromise) return;
    upsertGroupHistory({
      roomCode,
      recordedAt: new Date().toISOString(),
      myPick: groupFlow.myPick,
      partnerPick: groupFlow.partnerPick,
      sharedCompromise: groupFlow.sharedCompromise,
      overlapTitles: groupFlow.state.mutualMatchIds
        .map((id) => groupFlow.state.deck.find((title) => title.id === id))
        .filter((title): title is Title => Boolean(title))
    });
    recordedRoomCodesRef.current.add(roomCode);
    refreshLibrary();
  }, [
    groupFlow.state.phase,
    groupFlow.state.roomCode,
    groupFlow.myPick?.id,
    groupFlow.partnerPick?.id,
    groupFlow.sharedCompromise?.id,
    groupFlow.state.mutualMatchIds.join("|")
  ]);

  useEffect(() => {
    if (!roomShareFeedback) return;
    const timer = window.setTimeout(() => setRoomShareFeedback(null), 1800);
    return () => window.clearTimeout(timer);
  }, [roomShareFeedback]);

  async function handleCopyRoomInvite() {
    const shareUrl = groupFlow.state.shareUrl;
    if (!shareUrl) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = shareUrl;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setRoomShareFeedback("Link copied!");
    } catch {
      setRoomShareFeedback("Unable to copy link");
    }
  }

  async function handleShareRoomInvite() {
    const shareUrl = groupFlow.state.shareUrl;
    if (!shareUrl) return;
    const inviteText = "Someone wants you to help decide what film to watch tonight. Join the room!";
    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await navigator.share({
          title: "Join my Sententia room",
          text: inviteText,
          url: shareUrl
        });
        setRoomShareFeedback("Invite shared!");
        return;
      }

      await handleCopyRoomInvite();
    } catch {
      setRoomShareFeedback("Unable to share invite");
    }
  }

  return (
    <div className="relative min-h-screen">
      <ThumbnailBackdrop />
      <div className="pointer-events-none fixed inset-0 z-10 bg-[radial-gradient(ellipse_85%_70%_at_50%_45%,rgba(0,0,0,0.15),rgba(0,0,0,0.92))]" />
      <div className="pointer-events-none fixed inset-0 z-10 bg-gradient-to-b from-black/35 via-black/20 to-black/45" />

      <main className="relative z-20 mx-auto max-w-5xl px-3 py-3 text-zinc-100 sm:px-4 sm:py-5 md:py-10 mb-16">
        <AppHeader
          viewerPrefs={viewerPrefs}
          onWatchRegionChange={handleWatchRegionChange}
          onClearCache={handleResetPersonalization}
          onToggleTasteProfile={openTastePage}
          onToggleLibrary={openLibraryPage}
          onToggleHistory={openHistoryPage}
          savedCount={savedPicks.length}
          watchedCount={watchedTitles.length}
          compact={isCardFocusedPhase || session.phase === "questions" || showGroupFlow || false}
        />

        {!showGroupFlow && showUtilityPage ? (
          <section className="utility-page-shell mx-auto max-w-5xl rounded-3xl border border-white/20 bg-zinc-950/45 p-5 shadow-2xl backdrop-blur-lg">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  {showTastePanel ? "Your profile: Taste" : showHistoryPanel ? "Your profile: History" : "Your profile: Library"}
                </h2>
                <p className="mt-1 text-sm text-zinc-300">
                  {showTastePanel
                    ? "How your swipes are shaping recommendations."
                    : showHistoryPanel
                      ? "Timeline of your solo and group movie nights."
                      : "Saved picks and your like/dislike reactions."}
                </p>
              </div>
              <button
                type="button"
                className="rounded-full border border-white/30 bg-zinc-900/60 px-4 py-2 text-sm transition hover:border-white/50 hover:bg-zinc-800/75 active:scale-95"
                onClick={closeUtilityPage}
              >
                Back
              </button>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition active:scale-95 ${showTastePanel
                    ? "border-violet-300/60 bg-violet-500/20 text-violet-100"
                    : "border-white/20 bg-zinc-900/60 text-zinc-200 hover:border-white/40"
                  }`}
                onClick={openTastePage}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                  <path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2m1 5h-2v6l5.25 3.15 1-1.64-4.25-2.51Z" />
                </svg>
                Taste
              </button>
              <button
                type="button"
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition active:scale-95 ${showLibraryPanel
                    ? "border-violet-300/60 bg-violet-500/20 text-violet-100"
                    : "border-white/20 bg-zinc-900/60 text-zinc-200 hover:border-white/40"
                  }`}
                onClick={openLibraryPage}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                  <path fill="currentColor" d="M5 3h14a2 2 0 0 1 2 2v14l-4-2-4 2-4-2-4 2V5a2 2 0 0 1 2-2" />
                </svg>
                Library
              </button>
              <button
                type="button"
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition active:scale-95 ${showHistoryPanel
                    ? "border-violet-300/60 bg-violet-500/20 text-violet-100"
                    : "border-white/20 bg-zinc-900/60 text-zinc-200 hover:border-white/40"
                  }`}
                onClick={openHistoryPage}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                  <path fill="currentColor" d="M12 2a10 10 0 1 0 10 10h-2a8 8 0 1 1-8-8V2zm1 5h-2v6l4.5 2.6 1-1.73-3.5-2.02z" />
                </svg>
                History
              </button>
            </div>

            <div key={showTastePanel ? "taste" : showHistoryPanel ? "history" : "library"} className="utility-page-panel">
              {showTastePanel ? (
                <TasteProfileCard
                  profile={profile}
                  savedCount={savedPicks.length}
                  ratedCount={watchedTitles.length}
                  onClearSignal={handleClearTasteSignal}
                />
              ) : showHistoryPanel ? (
                <LibraryPanel
                  saved={[]}
                  watched={[]}
                  soloHistory={soloHistory}
                  history={groupHistory}
                  onOpenTitle={(title) => setShowdownDetailsTitle(title)}
                  onToggleSave={(title) => handleToggleSave(title, "solo")}
                  onSetSeenReaction={handleWatchedReaction}
                  mode="history"
                />
              ) : (
                <LibraryPanel
                  saved={savedPicks}
                  watched={watchedTitles}
                  soloHistory={soloHistory}
                  history={groupHistory}
                  onOpenTitle={(title) => setShowdownDetailsTitle(title)}
                  onToggleSave={(title) => handleToggleSave(title, "solo")}
                  onSetSeenReaction={handleWatchedReaction}
                  mode="library"
                />
              )}
            </div>
          </section>
        ) : null}

        {session.phase === "questions" && !showGroupFlow && !showUtilityPage ? (
          <QuestionsSection
            answers={session.answers}
            isBuildingDeck={isBuildingDeck || groupFlow.isBusy}
            deckBuildError={deckBuildError}
            deckBuildProgress={deckBuildProgress}
            onDismissDeckBuildError={clearDeckBuildError}
            customYearStartPct={customYearStartPct}
            customYearEndPct={customYearEndPct}
            onBegin={beginOnboarding}
            hasLastAnswers={hasLastAnswers}
            hasDraftSession={hasDraftSession}
            followUpTitle={followUpCandidate?.winner}
            onUpdateAnswers={updateAnswers}
            onToggleCustomYearRange={toggleCustomYearRange}
            onUpdateCustomYearRange={updateCustomYearRange}
            onToggleProvider={toggleProvider}
            onToggleExclusion={toggleExclusion}
            viewerPrefs={viewerPrefs}
            onWatchRegionChange={handleWatchRegionChange}
            onClearCache={handleResetPersonalization}
            onToggleTasteProfile={openTastePage}
            onToggleLibrary={openLibraryPage}
            onToggleHistory={openHistoryPage}
            savedCount={savedPicks.length}
            watchedCount={watchedTitles.length}
            onStartSolo={startSwipeRound}
            onStartGroup={handleStartGroup}
            onStartFromLastTime={handleStartFromLastTime}
            onResumeSession={resumeDraftSession}
            onFollowUpResponse={handleFollowUpResponse}
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
                onClick={() => {
                  void handleCopyRoomInvite();
                }}
              >
                Copy invite link
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-zinc-900/60 px-4 py-2 text-sm transition hover:border-white/50 hover:bg-zinc-800/75"
                onClick={() => {
                  void handleShareRoomInvite();
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M14 3l7 7-7 7v-4.1c-5.2 0-8.8 1.7-11 5.1.6-6 3.9-10 11-10.9V3z"
                  />
                </svg>
                Share invite
              </button>
            </div>
            {roomShareFeedback ? <p className="mt-2 text-xs text-zinc-300">{roomShareFeedback}</p> : null}
          </section>
        ) : null}

        {session.phase === "swipe" && currentTitle && !showGroupFlow && !showUtilityPage ? (
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

        {session.phase === "showdown" && showdownLeft && showdownRight && !showGroupFlow && !showUtilityPage ? (
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

        {session.phase === "result" && winner && !showGroupFlow && !showUtilityPage ? (
          <ResultSection
            winner={winner}
            backup={backup}
            whyThisPick={winnerReasons}
            isSaved={savedIds.has(winner.id)}
            onToggleSave={() => handleToggleSave(winner, "solo")}
            seenReaction={watchedTitles.find((entry) => entry.title.id === winner.id)?.reaction}
            onSetSeenReaction={(reaction) => handleSeenIt(winner, reaction, "solo")}
            onWatchNow={handleWatchNow}
            onWatchTrailer={() => handleWatchTrailer(winner)}
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
            whySharedPick={sharedCompromiseReasons}
            isTitleSaved={(titleId) => savedIds.has(titleId)}
            onToggleSaveTitle={(title) => handleToggleSave(title, "group")}
            onReactTitle={(title, reaction) => handleSeenIt(title, reaction, "group")}
            titleRatings={Object.fromEntries(
              watchedTitles.map((e) => [e.title.id, e.reaction])
            )}
            onStartCompromiseShowdown={groupFlow.startCompromiseShowdown}
            onWatchNow={(title) => openWatchUrl(title, viewerPrefs.watchRegion)}
            onWatchTrailer={(title) => handleWatchTrailer(title)}
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
