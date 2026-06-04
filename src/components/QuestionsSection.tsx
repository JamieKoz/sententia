import { useEffect, useState, type ReactNode } from "react";
import { DeckBuildingOverlay } from "./DeckBuildingOverlay";
import {
  EXCLUSION_OPTIONS,
  FAMILIARITY_OPTIONS,
  LANGUAGE_OPTIONS,
  MOOD_CHIPS,
  PROVIDER_OPTIONS,
  RELEASE_WINDOW_OPTIONS,
  RUNTIME_OPTIONS,
  TYPE_OPTIONS,
  YEAR_MAX,
  YEAR_MIN
} from "../config/options";
import type { OnboardingAnswers } from "../types";

type OnboardingStep =
  | "welcome"
  | "mood"
  | "type"
  | "runtime"
  | "release"
  | "language"
  | "discovery"
  | "provider"
  | "avoid"
  | "keywords";

type TransitionDirection = "forward" | "back";

const STEP_ORDER: OnboardingStep[] = [
  "welcome",
  "mood",
  "type",
  "runtime",
  "release",
  "language",
  "discovery",
  "provider",
  "avoid",
  "keywords"
];

function stepIndex(step: OnboardingStep) {
  return STEP_ORDER.indexOf(step);
}

function nextStep(step: OnboardingStep): OnboardingStep | null {
  const idx = stepIndex(step);
  return idx < STEP_ORDER.length - 1 ? STEP_ORDER[idx + 1]! : null;
}

function prevStep(step: OnboardingStep): OnboardingStep | null {
  const idx = stepIndex(step);
  return idx > 0 ? STEP_ORDER[idx - 1]! : null;
}

function OnboardingSettings({ onClearCache }: { onClearCache: () => void }) {
  return (
    <details className="group relative ml-auto">
      <summary className="summary-no-marker list-none cursor-pointer rounded-full border border-white/30 bg-zinc-900/60 p-2 text-sm text-zinc-100 backdrop-blur-md transition hover:border-white/50 hover:bg-zinc-800/70">
        <span className="sr-only">Settings</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.325 4.317a1.724 1.724 0 0 1 3.35 0 1.724 1.724 0 0 0 2.573 1.066 1.724 1.724 0 0 1 2.49 2.49 1.724 1.724 0 0 0 1.065 2.573 1.724 1.724 0 0 1 0 3.35 1.724 1.724 0 0 0-1.066 2.573 1.724 1.724 0 0 1-2.49 2.49 1.724 1.724 0 0 0-2.573 1.065 1.724 1.724 0 0 1-3.35 0 1.724 1.724 0 0 0-2.573-1.066 1.724 1.724 0 0 1-2.49-2.49 1.724 1.724 0 0 0-1.065-2.573 1.724 1.724 0 0 1 0-3.35 1.724 1.724 0 0 0 1.066-2.573 1.724 1.724 0 0 1 2.49-2.49 1.724 1.724 0 0 0 2.573-1.065Z"
          />
          <circle cx="12" cy="12" r="3.25" />
        </svg>
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-44 rounded-xl border border-white/20 bg-zinc-900/90 p-2 shadow-2xl backdrop-blur-xl">
        <button
          className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-100 transition hover:bg-zinc-800/80"
          onClick={onClearCache}
        >
          Clear cache
        </button>
      </div>
    </details>
  );
}

function StepFrame({
  step,
  direction,
  title,
  subtitle,
  children
}: {
  step: OnboardingStep;
  direction: TransitionDirection;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section key={step} className={`onboarding-step onboarding-step--${direction} onboarding-step--centered`}>
      <div className="mb-6 text-center sm:mb-8">
        <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl md:text-3xl">{title}</h2>
        {subtitle ? <p className="mt-2 text-sm text-zinc-300 sm:text-base">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function NavButton({
  children,
  onClick,
  disabled,
  variant = "secondary"
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
}) {
  const base =
    variant === "primary"
      ? "rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-7 py-2.5 font-medium text-white shadow-lg shadow-violet-900/40 transition hover:brightness-110 disabled:opacity-50"
      : "rounded-full border border-white/25 bg-zinc-900/60 px-5 py-2.5 text-sm text-zinc-100 transition hover:border-white/45 hover:bg-zinc-800/70 disabled:opacity-50";

  return (
    <button type="button" className={base} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function OptionChip({
  selected,
  onClick,
  children,
  tone = "violet"
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  tone?: "violet" | "rose";
}) {
  const selectedClass =
    tone === "rose"
      ? "rounded-full border border-rose-300/70 bg-rose-500/25 px-3 py-1.5 text-sm transition hover:bg-rose-500/35"
      : "rounded-full border border-violet-300/70 bg-violet-500/30 px-3 py-1.5 text-sm transition hover:bg-violet-500/40";
  const defaultClass =
    "rounded-full border border-white/25 bg-zinc-900/60 px-3 py-1.5 text-sm transition hover:border-white/45 hover:bg-zinc-800/70";

  return (
    <button type="button" className={selected ? selectedClass : defaultClass} onClick={onClick}>
      {children}
    </button>
  );
}

function ChipGroup({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex max-w-2xl flex-wrap justify-center gap-2">{children}</div>;
}

export function QuestionsSection(props: {
  answers: OnboardingAnswers;
  isBuildingDeck: boolean;
  customYearStartPct: number;
  customYearEndPct: number;
  onBegin: () => void;
  onUpdateAnswers: (next: Partial<OnboardingAnswers>) => void;
  onToggleCustomYearRange: () => void;
  onUpdateCustomYearRange: (next: Partial<{ min: number; max: number }>) => void;
  onToggleProvider: (provider: string) => void;
  onToggleExclusion: (exclusion: string) => void;
  onToggleMood: (mood: string) => void;
  onToggleLanguage: (language: string) => void;
  onToggleFamiliarity: (familiarity: "any" | "popular" | "hidden-gems" | "for-kids") => void;
  onClearCache: () => void;
  onStart: () => void;
}) {
  const {
    answers,
    isBuildingDeck,
    customYearStartPct,
    customYearEndPct,
    onBegin,
    onUpdateAnswers,
    onToggleCustomYearRange,
    onUpdateCustomYearRange,
    onToggleProvider,
    onToggleExclusion,
    onToggleMood,
    onToggleLanguage,
    onToggleFamiliarity,
    onClearCache,
    onStart
  } = props;

  const customYearRange = answers.customYearRange;
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [direction, setDirection] = useState<TransitionDirection>("forward");
  const [keywordsDraft, setKeywordsDraft] = useState((answers.keywords ?? []).join(", "));

  useEffect(() => {
    setKeywordsDraft((answers.keywords ?? []).join(", "));
  }, [answers.keywords]);

  function goTo(next: OnboardingStep) {
    setDirection(stepIndex(next) >= stepIndex(step) ? "forward" : "back");
    setStep(next);
  }

  function goNext() {
    if (step === "welcome") {
      onBegin();
    }
    const next = nextStep(step);
    if (next) goTo(next);
  }

  function goBack() {
    const prev = prevStep(step);
    if (prev) goTo(prev);
  }

  function commitKeywords(rawValue: string) {
    const normalizedKeywords = rawValue
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    onUpdateAnswers({ keywords: normalizedKeywords });
    setKeywordsDraft(normalizedKeywords.join(", "));
  }

  function handleStart() {
    commitKeywords(keywordsDraft);
    onStart();
  }

  const canAdvanceFromMood = (answers.moods?.length ?? 0) > 0;
  const isLastStep = step === "keywords";

  return (
    <>
      <div className="onboarding-shell">
        <div className="mb-4 flex justify-end sm:mb-6">
          <OnboardingSettings onClearCache={onClearCache} />
        </div>

        <div className="onboarding-content">
          {step === "welcome" ? (
            <div key="welcome" className="onboarding-step onboarding-step--forward onboarding-step--centered">
              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-6xl">CineMatch</h1>
              <p className="mt-4 max-w-md text-base text-zinc-300 sm:text-lg">Find the match for your next film.</p>
              <div className="mt-8">
                <NavButton variant="primary" onClick={goNext}>
                  Begin
                </NavButton>
              </div>
            </div>
          ) : null}

          {step === "mood" ? (
            <StepFrame step="mood" direction={direction} title="What's the mood?" subtitle="Pick one or more.">
              <div className="mx-auto grid max-w-2xl grid-cols-2 gap-3 sm:gap-4">
                {MOOD_CHIPS.map((mood) => {
                  const selected = answers.moods?.includes(mood.value);
                  return (
                    <button
                      key={mood.value}
                      type="button"
                      className={
                        selected
                          ? "onboarding-choice-card onboarding-choice-card--selected"
                          : "onboarding-choice-card"
                      }
                      onClick={() => onToggleMood(mood.value)}
                    >
                      <span className="text-lg font-semibold text-white sm:text-xl">{mood.label}</span>
                      <span className="mt-2 text-xs text-zinc-300 sm:text-sm">{mood.description}</span>
                    </button>
                  );
                })}
              </div>
            </StepFrame>
          ) : null}

          {step === "type" ? (
            <StepFrame step="type" direction={direction} title="Movie or series?" subtitle="What are you watching tonight?">
              <div className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-3 sm:gap-4">
                {TYPE_OPTIONS.map((typeOption) => {
                  const selected = (answers.preferredType ?? "either") === typeOption.value;
                  return (
                    <button
                      key={typeOption.value}
                      type="button"
                      className={
                        selected
                          ? "onboarding-choice-card onboarding-choice-card--selected onboarding-choice-card--tall"
                          : "onboarding-choice-card onboarding-choice-card--tall"
                      }
                      onClick={() => onUpdateAnswers({ preferredType: typeOption.value })}
                    >
                      <span className="text-xl font-semibold text-white sm:text-2xl">{typeOption.label}</span>
                      <span className="mt-2 text-sm text-zinc-300">{typeOption.description}</span>
                    </button>
                  );
                })}
              </div>
            </StepFrame>
          ) : null}

          {step === "runtime" ? (
            <StepFrame step="runtime" direction={direction} title="How long?" subtitle="Pick a runtime that fits tonight.">
              <div className="mx-auto grid max-w-2xl grid-cols-2 gap-3 sm:gap-4">
                {RUNTIME_OPTIONS.map((runtimeOption) => {
                  const selected = (answers.runtime ?? "any") === runtimeOption.value;
                  return (
                    <button
                      key={runtimeOption.value}
                      type="button"
                      className={
                        selected
                          ? "onboarding-choice-card onboarding-choice-card--selected"
                          : "onboarding-choice-card"
                      }
                      onClick={() => onUpdateAnswers({ runtime: runtimeOption.value })}
                    >
                      <span className="text-lg font-semibold text-white sm:text-xl">{runtimeOption.label}</span>
                      <span className="mt-2 text-xs text-zinc-300 sm:text-sm">{runtimeOption.description}</span>
                    </button>
                  );
                })}
              </div>
            </StepFrame>
          ) : null}

          {step === "release" ? (
            <StepFrame step="release" direction={direction} title="Release date" subtitle="When should it have come out?">
              <div className="mx-auto w-full max-w-2xl">
                <ChipGroup>
                  {RELEASE_WINDOW_OPTIONS.map((window) => {
                    const selected = (answers.releaseWindow ?? "any") === window && !answers.customYearRange;
                    return (
                      <OptionChip
                        key={window}
                        selected={selected}
                        onClick={() => onUpdateAnswers({ releaseWindow: window, customYearRange: null })}
                      >
                        {window === "any"
                          ? "Any"
                          : window === "2020s"
                            ? "2020+"
                            : window === "2010s"
                              ? "2010-2019"
                              : window === "2000s"
                                ? "2000-2009"
                                : "Before 2000"}
                      </OptionChip>
                    );
                  })}
                  <OptionChip selected={Boolean(answers.customYearRange)} onClick={onToggleCustomYearRange}>
                    Custom range
                  </OptionChip>
                </ChipGroup>
                {customYearRange ? (
                  <div className="mt-4 rounded-xl border border-white/20 bg-zinc-900/45 p-3 text-left">
                    <p className="text-xs text-zinc-300">
                      Year range: <span className="font-medium text-zinc-100">{customYearRange.min}</span> -{" "}
                      <span className="font-medium text-zinc-100">{customYearRange.max}</span>
                    </p>
                    <div className="relative mt-3 h-8">
                      <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-zinc-700/70" />
                      <div
                        className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-violet-400/80"
                        style={{
                          left: `${customYearStartPct}%`,
                          right: `${100 - customYearEndPct}%`
                        }}
                      />
                      <input
                        className="dual-range dual-range-min absolute inset-0 w-full"
                        type="range"
                        min={YEAR_MIN}
                        max={YEAR_MAX}
                        value={customYearRange.min}
                        onChange={(event) => onUpdateCustomYearRange({ min: Number(event.target.value) })}
                      />
                      <input
                        className="dual-range dual-range-max absolute inset-0 w-full"
                        type="range"
                        min={YEAR_MIN}
                        max={YEAR_MAX}
                        value={customYearRange.max}
                        onChange={(event) => onUpdateCustomYearRange({ max: Number(event.target.value) })}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-[11px] text-zinc-400">
                      <span>{YEAR_MIN}</span>
                      <span>{YEAR_MAX}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            </StepFrame>
          ) : null}

          {step === "language" ? (
            <StepFrame step="language" direction={direction} title="Language" subtitle="Original language preference.">
              <ChipGroup>
                {LANGUAGE_OPTIONS.map((language) => {
                  const selected = language === "any" ? !answers.languages?.length : answers.languages?.includes(language);
                  return (
                    <OptionChip key={language} selected={Boolean(selected)} onClick={() => onToggleLanguage(language)}>
                      {language === "any" ? "Any language" : language.toUpperCase()}
                    </OptionChip>
                  );
                })}
              </ChipGroup>
            </StepFrame>
          ) : null}

          {step === "discovery" ? (
            <StepFrame step="discovery" direction={direction} title="Discovery style" subtitle="How well-known should picks be?">
              <ChipGroup>
                {FAMILIARITY_OPTIONS.map((familiarity) => {
                  const selected =
                    familiarity === "any" ? !answers.familiarities?.length : answers.familiarities?.includes(familiarity);
                  return (
                    <OptionChip key={familiarity} selected={Boolean(selected)} onClick={() => onToggleFamiliarity(familiarity)}>
                      {familiarity === "any"
                        ? "Any"
                        : familiarity === "popular"
                          ? "Popular picks"
                          : familiarity === "hidden-gems"
                            ? "Hidden gems"
                            : "For kids"}
                    </OptionChip>
                  );
                })}
              </ChipGroup>
            </StepFrame>
          ) : null}

          {step === "provider" ? (
            <StepFrame step="provider" direction={direction} title="Provider" subtitle="Where do you want to watch?">
              <ChipGroup>
                <OptionChip selected={!answers.providers?.length} onClick={() => onUpdateAnswers({ providers: [] })}>
                  No preference
                </OptionChip>
                {PROVIDER_OPTIONS.map((provider) => (
                  <OptionChip
                    key={provider}
                    selected={Boolean(answers.providers?.includes(provider))}
                    onClick={() => onToggleProvider(provider)}
                  >
                    {provider}
                  </OptionChip>
                ))}
              </ChipGroup>
            </StepFrame>
          ) : null}

          {step === "avoid" ? (
            <StepFrame step="avoid" direction={direction} title="Avoid tonight" subtitle="Genres to skip this session.">
              <ChipGroup>
                {EXCLUSION_OPTIONS.map((exclusion) => (
                  <OptionChip
                    key={exclusion}
                    selected={Boolean(answers.hardExclusions?.includes(exclusion))}
                    onClick={() => onToggleExclusion(exclusion)}
                    tone="rose"
                  >
                    {exclusion}
                  </OptionChip>
                ))}
              </ChipGroup>
            </StepFrame>
          ) : null}

          {step === "keywords" ? (
            <StepFrame step="keywords" direction={direction} title="Keywords" subtitle="Optional — comma-separated vibes or themes.">
              <div className="mx-auto w-full max-w-md">
                <input
                  className="w-full rounded-xl border border-white/25 bg-zinc-900/75 px-4 py-3 text-sm text-zinc-100 outline-none backdrop-blur-md placeholder:text-zinc-400"
                  type="text"
                  value={keywordsDraft}
                  onChange={(event) => setKeywordsDraft(event.target.value)}
                  onBlur={() => commitKeywords(keywordsDraft)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleStart();
                    }
                  }}
                  placeholder="animation, black and white, slasher"
                />
              </div>
            </StepFrame>
          ) : null}
        </div>

        {step !== "welcome" ? (
          <div className="onboarding-nav mt-6 flex items-center justify-center gap-3 sm:mt-8">
            <NavButton onClick={goBack}>Back</NavButton>
            {isLastStep ? (
              <NavButton variant="primary" onClick={handleStart} disabled={isBuildingDeck}>
                {isBuildingDeck ? "Building your deck…" : "Start"}
              </NavButton>
            ) : (
              <NavButton variant="primary" onClick={goNext} disabled={step === "mood" && !canAdvanceFromMood}>
                Next
              </NavButton>
            )}
          </div>
        ) : null}
      </div>

      {isBuildingDeck ? <DeckBuildingOverlay /> : null}
    </>
  );
}
