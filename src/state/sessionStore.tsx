import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { MOCK_TITLES } from "../data/mockTitles";
import { createDefaultProfile } from "../engine/profile";
import { loadLastAnswers, loadProfile } from "../services/storage";
import { createInitialAnswers, createSession, nextPair } from "./machine";
import type { SessionState, TasteProfile, Title } from "../types";

interface SessionStoreValue {
  profile: TasteProfile;
  setProfile: React.Dispatch<React.SetStateAction<TasteProfile>>;
  session: SessionState;
  setSession: React.Dispatch<React.SetStateAction<SessionState>>;
  catalog: Title[];
  setCatalog: React.Dispatch<React.SetStateAction<Title[]>>;
  titlesById: Map<string, Title>;
  currentTitle?: Title;
  nextSwipeTitle?: Title;
  showdownLeft?: Title;
  showdownRight?: Title;
  winner?: Title;
  backup?: Title;
  isCardFocusedPhase: boolean;
}

const SessionStoreContext = createContext<SessionStoreValue | null>(null);

export function SessionStoreProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState(() => {
    if (typeof window === "undefined") return createDefaultProfile();
    return loadProfile();
  });

  const [session, setSession] = useState<SessionState>(() => {
    const seed = typeof window === "undefined" ? {} : loadLastAnswers();
    return createSession(createInitialAnswers(seed));
  });

  const [catalog, setCatalog] = useState<Title[]>(MOCK_TITLES);

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

  const value: SessionStoreValue = {
    profile,
    setProfile,
    session,
    setSession,
    catalog,
    setCatalog,
    titlesById,
    currentTitle,
    nextSwipeTitle,
    showdownLeft,
    showdownRight,
    winner,
    backup,
    isCardFocusedPhase
  };

  return <SessionStoreContext.Provider value={value}>{children}</SessionStoreContext.Provider>;
}

export function useSessionStore(): SessionStoreValue {
  const ctx = useContext(SessionStoreContext);
  if (!ctx) {
    throw new Error("useSessionStore must be used within SessionStoreProvider");
  }
  return ctx;
}
