import { DECK_SIZE } from "../state/machine";

export interface DeckBuildPreviewTitle {
  name: string;
  type: "movie" | "series";
  posterPath?: string | null;
}

export type DeckBuildPhase = "starting" | "suggesting" | "resolving" | "finalizing" | "fallback";

export interface DeckBuildProgress {
  phase: DeckBuildPhase;
  suggestedCount: number;
  resolvedCount: number;
  targetCount: number;
  recentSuggestions: string[];
  recentResolved: DeckBuildPreviewTitle[];
}

const MAX_RECENT = 8;

export function createInitialDeckBuildProgress(
  targetCount = DECK_SIZE
): DeckBuildProgress {
  return {
    phase: "starting",
    suggestedCount: 0,
    resolvedCount: 0,
    targetCount,
    recentSuggestions: [],
    recentResolved: []
  };
}

export function deckBuildStatusLine(progress: DeckBuildProgress | null | undefined): string {
  if (!progress) return "Asking AI to think about your vibe…";

  if (progress.phase === "finalizing") return "Polishing posters and streaming details…";
  if (progress.phase === "fallback") return "Curating strong matches from your taste profile…";
  if (progress.resolvedCount > 0) {
    return `Locked in ${progress.resolvedCount} of ${progress.targetCount} picks…`;
  }
  if (progress.suggestedCount > 0) {
    return `Considering ${progress.suggestedCount} title ideas from AI…`;
  }
  return "Asking AI to think about your vibe…";
}

export class DeckBuildProgressReporter {
  private state: DeckBuildProgress;

  constructor(
    private readonly onProgress?: (progress: DeckBuildProgress) => void,
    targetCount = DECK_SIZE
  ) {
    this.state = createInitialDeckBuildProgress(targetCount);
    this.emit();
  }

  setPhase(phase: DeckBuildPhase) {
    this.state = { ...this.state, phase };
    this.emit();
  }

  noteSuggestion(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    this.state = {
      ...this.state,
      phase: "suggesting",
      suggestedCount: this.state.suggestedCount + 1,
      recentSuggestions: prependUnique(this.state.recentSuggestions, trimmed, MAX_RECENT)
    };
    this.emit();
  }

  noteResolved(title: DeckBuildPreviewTitle) {
    const trimmed = title.name.trim();
    if (!trimmed) return;
    this.state = {
      ...this.state,
      phase: "resolving",
      resolvedCount: this.state.resolvedCount + 1,
      recentResolved: prependUniquePreview(this.state.recentResolved, { ...title, name: trimmed }, MAX_RECENT)
    };
    this.emit();
  }

  private emit() {
    this.onProgress?.({ ...this.state });
  }
}

function prependUnique(items: string[], value: string, max: number): string[] {
  const next = [value, ...items.filter((item) => item !== value)];
  return next.slice(0, max);
}

function prependUniquePreview(
  items: DeckBuildPreviewTitle[],
  value: DeckBuildPreviewTitle,
  max: number
): DeckBuildPreviewTitle[] {
  const next = [value, ...items.filter((item) => item.name !== value.name)];
  return next.slice(0, max);
}
