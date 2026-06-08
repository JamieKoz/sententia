import { runtimeBucketFromMinutes } from "./scoring";
import type { TasteProfile, Title } from "../types";

const MIN_AFFINITY = -5;
const MAX_AFFINITY = 5;
const MAX_IDS = 300;

export function createDefaultProfile(): TasteProfile {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    runtimeAffinity: {
      short: 0,
      standard: 0,
      long: 0
    },
    moodAffinity: {},
    genreAffinity: {},
    languageAffinity: {},
    providerAffinity: {},
    typeAffinity: {
      movie: 0,
      series: 0
    },
    likedIds: [],
    rejectedIds: [],
    seenIds: [],
    sessionCount: 0
  };
}

export function applyKeepSignal(profile: TasteProfile, title: Title): TasteProfile {
  const next = cloneProfile(profile);
  adjustTitleSignals(next, title, 2);
  next.likedIds = pushCapped(next.likedIds, title.id);
  next.seenIds = pushCapped(next.seenIds, title.id);
  touch(next);
  return next;
}

export function applyPassSignal(profile: TasteProfile, title: Title): TasteProfile {
  const next = cloneProfile(profile);
  adjustTitleSignals(next, title, -1);
  next.rejectedIds = pushCapped(next.rejectedIds, title.id);
  next.seenIds = pushCapped(next.seenIds, title.id);
  touch(next);
  return next;
}

export function applyDecisionSignal(profile: TasteProfile, winner: Title): TasteProfile {
  const next = cloneProfile(profile);
  adjustTitleSignals(next, winner, 4);
  next.lastChosenTitle = winner.id;
  next.sessionCount += 1;
  touch(next);
  return next;
}

export function applyWatchedSignal(profile: TasteProfile, title: Title, rating: number): TasteProfile {
  const next = cloneProfile(profile);
  const normalized = Math.max(1, Math.min(5, Math.round(rating)));
  const delta = normalized - 3;
  if (delta !== 0) {
    adjustTitleSignals(next, title, delta);
  }
  next.seenIds = pushCapped(next.seenIds, title.id);
  next.lastChosenTitle = title.id;
  touch(next);
  return next;
}

function adjustTitleSignals(profile: TasteProfile, title: Title, delta: number): void {
  for (const genre of title.genres) {
    profile.genreAffinity[genre] = clamp((profile.genreAffinity[genre] ?? 0) + delta * 0.5);
  }

  for (const mood of title.moods) {
    profile.moodAffinity[mood] = clamp((profile.moodAffinity[mood] ?? 0) + delta * 0.6);
  }

  profile.runtimeAffinity[runtimeBucketFromMinutes(title.runtimeMinutes)] = clamp(
    profile.runtimeAffinity[runtimeBucketFromMinutes(title.runtimeMinutes)] + delta * 0.4
  );

  profile.typeAffinity[title.type] = clamp(profile.typeAffinity[title.type] + delta * 0.5);
  profile.languageAffinity[title.language] = clamp((profile.languageAffinity[title.language] ?? 0) + delta * 0.25);

  for (const provider of title.providers) {
    profile.providerAffinity[provider] = clamp((profile.providerAffinity[provider] ?? 0) + delta * 0.2);
  }
}

function cloneProfile(profile: TasteProfile): TasteProfile {
  return {
    ...profile,
    runtimeAffinity: { ...profile.runtimeAffinity },
    moodAffinity: { ...profile.moodAffinity },
    genreAffinity: { ...profile.genreAffinity },
    languageAffinity: { ...profile.languageAffinity },
    providerAffinity: { ...profile.providerAffinity },
    typeAffinity: { ...profile.typeAffinity },
    likedIds: [...profile.likedIds],
    rejectedIds: [...profile.rejectedIds],
    seenIds: [...profile.seenIds]
  };
}

function pushCapped(ids: string[], id: string): string[] {
  const deduped = ids.filter((value) => value !== id);
  deduped.push(id);
  return deduped.slice(-MAX_IDS);
}

function touch(profile: TasteProfile): void {
  profile.updatedAt = new Date().toISOString();
}

function clamp(value: number): number {
  if (value < MIN_AFFINITY) return MIN_AFFINITY;
  if (value > MAX_AFFINITY) return MAX_AFFINITY;
  return Number(value.toFixed(2));
}
