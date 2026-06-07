import { useMemo, useState } from "react";
import {
  createGroupRoom,
  getGroupRoomStatus,
  joinGroupRoom,
  startGroupCompromiseShowdown,
  submitGroupCompromisePick,
  submitGroupFinalPick,
  submitGroupShortlist,
  type GroupRoomStatus
} from "../services/groupRooms";
import type { OnboardingAnswers, Title } from "../types";
import { nextPair } from "../state/machine";

type GroupPhase = "idle" | "joining" | "lobby" | "swipe" | "waiting" | "showdown" | "result";
type GroupRole = "host" | "guest";

interface GroupFlowState {
  phase: GroupPhase;
  role?: GroupRole;
  roomCode?: string;
  shareUrl?: string;
  participantId?: string;
  deck: Title[];
  deckCursor: number;
  shortlist: string[];
  passed: string[];
  showdownQueue: string[];
  winnerId?: string;
  backupId?: string;
  myPickId?: string;
  partnerPickId?: string;
  mutualMatchIds: string[];
  showdownMode: "personal" | "compromise";
  finalPickShared: boolean;
  compromiseShared: boolean;
  compromisePickId?: string;
  partnerCompromisePickId?: string;
  partnerRequestedCompromise: boolean;
  sharedCompromiseId?: string;
  compromiseMatched: boolean;
  status?: GroupRoomStatus;
  submitted: boolean;
}

function initialState(): GroupFlowState {
  return {
    phase: "idle",
    deck: [],
    deckCursor: 0,
    shortlist: [],
    passed: [],
    showdownQueue: [],
    mutualMatchIds: [],
    showdownMode: "personal",
    finalPickShared: false,
    compromiseShared: false,
    partnerRequestedCompromise: false,
    compromiseMatched: false,
    submitted: false
  };
}

function createParticipantId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useGroupSessionFlow(params: { watchRegion: string }) {
  const { watchRegion } = params;
  const [state, setState] = useState<GroupFlowState>(() => initialState());
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastSwipeSnapshot, setLastSwipeSnapshot] = useState<Pick<GroupFlowState, "deckCursor" | "shortlist" | "passed"> | null>(null);

  const titlesById = useMemo(() => {
    return new Map(state.deck.map((title) => [title.id, title]));
  }, [state.deck]);

  const currentTitle = state.phase === "swipe" ? state.deck[state.deckCursor] : undefined;
  const nextSwipeTitle = state.phase === "swipe" ? state.deck[state.deckCursor + 1] : undefined;
  const showdownPair = state.phase === "showdown" ? nextPair(state.showdownQueue) : null;
  const showdownLeft = showdownPair ? titlesById.get(showdownPair[0]) : undefined;
  const showdownRight = showdownPair ? titlesById.get(showdownPair[1]) : undefined;
  const winner = state.winnerId ? titlesById.get(state.winnerId) : undefined;
  const backup = state.backupId ? titlesById.get(state.backupId) : undefined;
  const myPick = state.myPickId ? titlesById.get(state.myPickId) : undefined;
  const partnerPick = state.partnerPickId ? titlesById.get(state.partnerPickId) : undefined;
  const compromisePick = state.compromisePickId ? titlesById.get(state.compromisePickId) : undefined;
  const partnerCompromisePick = state.partnerCompromisePickId
    ? titlesById.get(state.partnerCompromisePickId)
    : undefined;
  const sharedCompromise = state.sharedCompromiseId ? titlesById.get(state.sharedCompromiseId) : undefined;

  function resolvePicksFromStatus(status: GroupRoomStatus, participantId: string | undefined) {
    if (!participantId) {
      return {
        myPickId: undefined,
        partnerPickId: undefined,
        partnerCompromisePickId: undefined,
        partnerRequestedCompromise: false
      };
    }
    return {
      myPickId: status.participantFinalPicks.find((pick) => pick.participantId === participantId)?.titleId,
      partnerPickId: status.participantFinalPicks.find((pick) => pick.participantId !== participantId)?.titleId,
      partnerCompromisePickId: status.participantCompromisePicks.find((pick) => pick.participantId !== participantId)
        ?.titleId,
      partnerRequestedCompromise: Boolean(
        status.participantCompromiseRequests.find((request) => request.participantId !== participantId)?.requested
      )
    };
  }

  async function startHostedGroupRound(input: {
    answers: OnboardingAnswers;
  }) {
    setIsBusy(true);
    setError(null);
    setNotice(null);
    try {
      const created = await createGroupRoom({
        answers: input.answers,
        watchRegion
      });

      if (created.deck.length === 0) {
        throw new Error("Could not build a shared deck for this room.");
      }

      persistRoomParticipant(created.roomCode, created.participantId);
      const initialStatus = await getGroupRoomStatus(created.roomCode, created.participantId);
      const everyoneJoined = initialStatus.participantsTotal >= initialStatus.maxParticipants;
      setState({
        phase: everyoneJoined ? "swipe" : "lobby",
        role: "host",
        roomCode: created.roomCode,
        shareUrl: created.shareUrl,
        participantId: created.participantId,
        deck: created.deck,
        deckCursor: 0,
        shortlist: [],
        passed: [],
        showdownQueue: [],
        mutualMatchIds: [],
        showdownMode: "personal",
        finalPickShared: false,
        compromiseShared: false,
        compromiseMatched: false,
        compromisePickId: undefined,
        partnerCompromisePickId: undefined,
        partnerRequestedCompromise: false,
        sharedCompromiseId: undefined,
        submitted: false,
        status: initialStatus
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not create group room.");
    } finally {
      setIsBusy(false);
    }
  }

  async function joinRoom(roomCode: string) {
    setIsBusy(true);
    setError(null);
    setNotice(null);
    setState((prev) => ({ ...prev, phase: "joining" }));
    try {
      const resumedParticipantId = loadRoomParticipant(roomCode);
      const participantIdForJoin = resumedParticipantId ?? createParticipantId();
      // Persist before join to make repeated effect calls idempotent in dev/StrictMode.
      persistRoomParticipant(roomCode, participantIdForJoin);
      const joined = await joinGroupRoom(roomCode, participantIdForJoin);
      persistRoomParticipant(joined.roomCode, joined.participantId);
      const initialStatus = await getGroupRoomStatus(joined.roomCode, joined.participantId);
      const everyoneJoined = initialStatus.participantsTotal >= initialStatus.maxParticipants;
      setState({
        phase: everyoneJoined ? "swipe" : "lobby",
        role: "guest",
        roomCode: joined.roomCode,
        participantId: joined.participantId,
        deck: joined.deck,
        deckCursor: 0,
        shortlist: [],
        passed: [],
        showdownQueue: [],
        mutualMatchIds: [],
        showdownMode: "personal",
        finalPickShared: false,
        compromiseShared: false,
        compromiseMatched: false,
        compromisePickId: undefined,
        partnerCompromisePickId: undefined,
        partnerRequestedCompromise: false,
        sharedCompromiseId: undefined,
        submitted: false,
        status: initialStatus
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not join this room.");
      setState((prev) => ({ ...prev, phase: "idle" }));
    } finally {
      setIsBusy(false);
    }
  }

  function startRoomSwipe() {
    setState((prev) => {
      if (prev.phase !== "lobby") return prev;
      return { ...prev, phase: "swipe" };
    });
  }

  async function loadRoomStatus(): Promise<GroupRoomStatus | undefined> {
    if (!state.roomCode) return undefined;
    try {
      const status = await getGroupRoomStatus(state.roomCode, state.participantId);
      const everyoneJoined = status.participantsTotal >= status.maxParticipants;
      const resolvedPicks = resolvePicksFromStatus(status, state.participantId);
      setState((prev) => ({
        ...prev,
        status,
        myPickId: resolvedPicks.myPickId ?? prev.myPickId,
        partnerPickId: resolvedPicks.partnerPickId ?? prev.partnerPickId,
        partnerCompromisePickId: resolvedPicks.partnerCompromisePickId ?? prev.partnerCompromisePickId,
        partnerRequestedCompromise: resolvedPicks.partnerRequestedCompromise,
        mutualMatchIds: status.overlapTitleIds.length > 0 ? [...status.overlapTitleIds] : prev.mutualMatchIds,
        sharedCompromiseId: status.sharedCompromiseId ?? (status.overlapTitleIds.length === 1 ? status.overlapTitleIds[0] : undefined),
        compromiseMatched: status.compromiseMatched,
        phase: prev.phase === "lobby" && everyoneJoined ? "swipe" : prev.phase
      }));
      if (state.phase === "lobby") {
        if (!everyoneJoined) {
          setNotice(`Waiting for partner to join (${status.participantsTotal}/${status.maxParticipants}).`);
        } else {
          setNotice(null);
        }
      }
      if (state.phase === "waiting") {
        if (status.readyToReveal) {
          setNotice(null);
        } else {
          setNotice(`Waiting for everyone to finish (${status.participantsReady}/${status.maxParticipants} ready).`);
        }
      }
      if (state.phase === "showdown") {
        setNotice(null);
      }
      if (state.phase !== "lobby" && state.phase !== "waiting" && status.readyToReveal) {
        setNotice(null);
      }
      return status;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not load room status.");
      return undefined;
    }
  }

  function handleSwipe(action: "keep" | "pass") {
    if (state.phase !== "swipe" || !currentTitle) return;
    setLastSwipeSnapshot({
      deckCursor: state.deckCursor,
      shortlist: [...state.shortlist],
      passed: [...state.passed]
    });

    setState((prev) => {
      if (prev.phase !== "swipe") return prev;
      const shortlist = action === "keep" ? [...prev.shortlist, currentTitle.id] : prev.shortlist;
      const passed = action === "pass" ? [...prev.passed, currentTitle.id] : prev.passed;
      const nextCursor = prev.deckCursor + 1;
      if (nextCursor >= prev.deck.length) {
        if (shortlist.length >= 2) {
          return {
            ...prev,
            phase: "showdown",
            showdownMode: "personal",
            showdownQueue: [...shortlist],
            deckCursor: nextCursor,
            shortlist,
            passed
          };
        }
        if (shortlist.length === 1) {
          return {
            ...prev,
            phase: "result",
            deckCursor: nextCursor,
            shortlist,
            passed,
            winnerId: shortlist[0],
            myPickId: shortlist[0],
            backupId: passed[0],
            showdownMode: "personal"
          };
        }
        return {
          ...prev,
          phase: "result",
          deckCursor: nextCursor,
          shortlist,
          passed,
          showdownMode: "personal"
        };
      }
      return {
        ...prev,
        deckCursor: nextCursor,
        shortlist,
        passed
      };
    });
  }

  function handleUndoSwipe() {
    if (!lastSwipeSnapshot) return;
    setState((prev) => {
      if (prev.phase !== "swipe") return prev;
      return {
        ...prev,
        deckCursor: lastSwipeSnapshot.deckCursor,
        shortlist: [...lastSwipeSnapshot.shortlist],
        passed: [...lastSwipeSnapshot.passed]
      };
    });
    setLastSwipeSnapshot(null);
  }

  async function submitAndPollStatus(): Promise<GroupRoomStatus | undefined> {
    if (!state.roomCode || !state.participantId) return undefined;
    setIsBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (!state.submitted) {
        await submitGroupShortlist(state.roomCode, state.participantId, state.shortlist);
        setState((prev) => ({ ...prev, submitted: true }));
      }
      const status = await getGroupRoomStatus(state.roomCode, state.participantId);
      const everyoneJoined = status.participantsTotal >= status.maxParticipants;
      const resolvedPicks = resolvePicksFromStatus(status, state.participantId);
      setState((prev) => ({
        ...prev,
        status,
        myPickId: resolvedPicks.myPickId ?? prev.myPickId,
        partnerPickId: resolvedPicks.partnerPickId ?? prev.partnerPickId,
        partnerCompromisePickId: resolvedPicks.partnerCompromisePickId ?? prev.partnerCompromisePickId,
        partnerRequestedCompromise: resolvedPicks.partnerRequestedCompromise,
        mutualMatchIds: status.overlapTitleIds.length > 0 ? [...status.overlapTitleIds] : prev.mutualMatchIds,
        sharedCompromiseId: status.sharedCompromiseId ?? (status.overlapTitleIds.length === 1 ? status.overlapTitleIds[0] : undefined),
        compromiseMatched: status.compromiseMatched,
        phase: prev.phase === "lobby" && everyoneJoined ? "swipe" : prev.phase
      }));
      if (state.phase === "result" && !status.readyToReveal) {
        setNotice(
          `Waiting for everyone to finish (${status.participantsReady}/${status.maxParticipants} ready).`
        );
      } else {
        setNotice(null);
      }
      return status;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not sync room status.");
      return undefined;
    } finally {
      setIsBusy(false);
    }
  }

  function handleShowdownPick(winnerPick: "left" | "right") {
    setState((prev) => {
      if (prev.phase !== "showdown") return prev;
      const pair = nextPair(prev.showdownQueue);
      if (!pair) return prev;
      const [leftId, rightId] = pair;
      const winnerId = winnerPick === "left" ? leftId : rightId;
      const loserId = winnerPick === "left" ? rightId : leftId;
      const [, , ...rest] = prev.showdownQueue;
      const nextQueue = [...rest, winnerId];
      if (nextQueue.length === 1) {
        if (prev.showdownMode === "compromise") {
          return {
            ...prev,
            phase: "result",
            showdownQueue: nextQueue,
            compromisePickId: winnerId,
            compromiseShared: false
          };
        }
        return {
          ...prev,
          phase: "result",
          showdownQueue: nextQueue,
          winnerId,
          backupId: loserId,
          myPickId: winnerId
        };
      }
      return {
        ...prev,
        showdownQueue: nextQueue
      };
    });
  }

  async function startCompromiseShowdown() {
    if (state.roomCode && state.participantId) {
      try {
        const response = await startGroupCompromiseShowdown(state.roomCode, state.participantId);
        const partnerRequestedCompromise = Boolean(
          response.participantCompromiseRequests.find((request) => request.participantId !== state.participantId)?.requested
        );
        setState((prev) => ({
          ...prev,
          partnerRequestedCompromise
        }));
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Could not start compromise showdown.");
      }
    }
    setState((prev) => {
      if (prev.mutualMatchIds.length < 2) return prev;
      return {
        ...prev,
        phase: "showdown",
        showdownMode: "compromise",
        showdownQueue: [...prev.mutualMatchIds],
        compromisePickId: undefined,
        compromiseShared: false
      };
    });
  }

  function reset() {
    setState(initialState());
    setError(null);
    setNotice(null);
    setLastSwipeSnapshot(null);
  }

  async function shareFinalPick(): Promise<void> {
    if (!state.roomCode || !state.participantId || !state.myPickId || state.finalPickShared) return;
    try {
      const response = await submitGroupFinalPick(state.roomCode, state.participantId, state.myPickId);
      const myPickId = response.participantFinalPicks.find((pick) => pick.participantId === state.participantId)?.titleId;
      const partnerPickId = response.participantFinalPicks.find((pick) => pick.participantId !== state.participantId)?.titleId;
      setState((prev) => ({
        ...prev,
        myPickId: myPickId ?? prev.myPickId,
        partnerPickId: partnerPickId ?? prev.partnerPickId,
        finalPickShared: true
      }));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not share final pick.");
    }
  }

  async function shareCompromisePick(): Promise<void> {
    if (!state.roomCode || !state.participantId || !state.compromisePickId || state.compromiseShared) return;
    try {
      const response = await submitGroupCompromisePick(state.roomCode, state.participantId, state.compromisePickId);
      const partnerCompromisePickId = response.participantCompromisePicks.find(
        (pick) => pick.participantId !== state.participantId
      )?.titleId;
      setState((prev) => ({
        ...prev,
        partnerCompromisePickId: partnerCompromisePickId ?? prev.partnerCompromisePickId,
        partnerRequestedCompromise: Boolean(
          response.participantCompromiseRequests.find((pick) => pick.participantId !== state.participantId)?.requested
        ),
        sharedCompromiseId: response.sharedCompromiseId,
        compromiseMatched: response.compromiseMatched,
        compromiseShared: true
      }));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not share compromise pick.");
    }
  }

  return {
    state,
    isBusy,
    error,
    notice,
    currentTitle,
    nextSwipeTitle,
    showdownLeft,
    showdownRight,
    winner,
    backup,
    myPick,
    partnerPick,
    compromisePick,
    partnerCompromisePick,
    partnerRequestedCompromise: state.partnerRequestedCompromise,
    sharedCompromise,
    compromiseMatched: state.compromiseMatched,
    canUndo: Boolean(lastSwipeSnapshot),
    startHostedGroupRound,
    joinRoom,
    startRoomSwipe,
    handleSwipe,
    handleUndoSwipe,
    submitAndPollStatus,
    loadRoomStatus,
    handleShowdownPick,
    startCompromiseShowdown,
    shareFinalPick,
    shareCompromisePick,
    reset
  };
}

function roomParticipantStorageKey(roomCode: string): string {
  return `group-room-participant:${roomCode.trim().toUpperCase()}`;
}

function persistRoomParticipant(roomCode: string, participantId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(roomParticipantStorageKey(roomCode), participantId);
}

function loadRoomParticipant(roomCode: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(roomParticipantStorageKey(roomCode));
}
