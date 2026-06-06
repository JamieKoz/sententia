import { useEffect, useState, type ReactNode } from "react";
import { DeckBuildingOverlay } from "./DeckBuildingOverlay";
import { AvoidTonightPicker } from "./AvoidTonightPicker";
import { OnboardingSummary } from "./OnboardingSummary";
import { DiscoveryAudiencePicker, DiscoveryPopularityPicker } from "./DiscoveryStylePicker";
import { LanguageMultiSelect } from "./LanguageMultiSelect";
import { ReleaseTimeline } from "./ReleaseTimeline";
import {
  MOOD_CHIPS,
  PROVIDER_OPTIONS,
  RUNTIME_OPTIONS,
  TYPE_OPTIONS
} from "../config/options";
import { SettingsMenu } from "./SettingsMenu";
import type { OnboardingAnswers, ViewerPrefs } from "../types";

type OnboardingStep =
  | "welcome"
  | "mood"
  | "type"
  | "runtime"
  | "release"
  | "language"
  | "discovery"
  | "audience"
  | "provider"
  | "avoid"
  | "keywords"
  | "review";

type TransitionDirection = "forward" | "back";

const STEP_ORDER: OnboardingStep[] = [
  "welcome",
  "mood",
  "type",
  "runtime",
  "release",
  "language",
  "discovery",
  "audience",
  "provider",
  "avoid",
  "keywords",
  "review"
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

function StepFrame({
  step,
  direction,
  title,
  subtitle,
  footer,
  children
}: {
  step: OnboardingStep;
  direction: TransitionDirection;
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section key={step} className={`onboarding-step onboarding-step--${direction} onboarding-step--stacked`}>
      <div className="mb-6 text-center sm:mb-8">
        <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl md:text-3xl">{title}</h2>
        {subtitle ? <p className="mt-2 text-sm text-zinc-300 sm:text-base">{subtitle}</p> : null}
      </div>
      {children}
      {footer}
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

export function QuestionsSection(props: {
  answers: OnboardingAnswers;
  isBuildingDeck: boolean;
  deckBuildError?: string | null;
  onDismissDeckBuildError?: () => void;
  customYearStartPct: number;
  customYearEndPct: number;
  onBegin: () => void;
  onUpdateAnswers: (next: Partial<OnboardingAnswers>) => void;
  onToggleCustomYearRange: () => void;
  onUpdateCustomYearRange: (next: Partial<{ min: number; max: number }>) => void;
  onToggleProvider: (provider: string) => void;
  onToggleExclusion: (exclusion: string) => void;
  onToggleMood: (mood: string) => void;
  viewerPrefs: ViewerPrefs;
  onWatchRegionChange: (watchRegion: string) => void;
  onClearCache: () => void;
  onStart: () => void;
}) {
  const {
    answers,
    isBuildingDeck,
    deckBuildError,
    onDismissDeckBuildError,
    customYearStartPct,
    customYearEndPct,
    onBegin,
    onUpdateAnswers,
    onToggleCustomYearRange,
    onUpdateCustomYearRange,
    onToggleProvider,
    onToggleExclusion,
    onToggleMood,
    viewerPrefs,
    onWatchRegionChange,
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
    if (step === "keywords") {
      commitKeywords(keywordsDraft);
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
  const isLastStep = step === "review";

  const stepNav = (
    <div className="onboarding-nav flex items-center justify-center gap-3">
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
  );

  return (
    <>
      <div className="onboarding-shell">
        <div className="mb-4 flex justify-end sm:mb-6">
          <SettingsMenu
            viewerPrefs={viewerPrefs}
            onWatchRegionChange={onWatchRegionChange}
            onClearCache={onClearCache}
          />
        </div>

        <div className="onboarding-content">
          {step === "welcome" ? (
            <div key="welcome" className="onboarding-step onboarding-step--forward onboarding-welcome">
              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-6xl">CouchPick</h1>
              <p className="mt-4 max-w-md text-base text-zinc-300 sm:text-lg">Stop scrolling. Swipe. Pick. Watch.</p>
              <div className="mt-8">
                <NavButton variant="primary" onClick={goNext}>
                  Begin
                </NavButton>
              </div>
            </div>
          ) : null}

          {step === "mood" ? (
            <StepFrame step="mood" direction={direction} title="What's the mood?" subtitle="Pick one or more." footer={stepNav}>
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
            <StepFrame step="type" direction={direction} title="Movie or series?" subtitle="What are you watching tonight?" footer={stepNav}>
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
            <StepFrame step="runtime" direction={direction} title="How long?" subtitle="Pick a runtime that fits tonight." footer={stepNav}>
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
            <StepFrame step="release" direction={direction} title="Release date" subtitle="When should it have come out?" footer={stepNav}>
              <ReleaseTimeline
                releaseWindow={answers.releaseWindow ?? "any"}
                customYearRange={customYearRange}
                customYearStartPct={customYearStartPct}
                customYearEndPct={customYearEndPct}
                onSelectWindow={(window) => onUpdateAnswers({ releaseWindow: window, customYearRange: null })}
                onToggleCustomYearRange={onToggleCustomYearRange}
                onUpdateCustomYearRange={onUpdateCustomYearRange}
              />
            </StepFrame>
          ) : null}

          {step === "language" ? (
            <StepFrame
              step="language"
              direction={direction}
              title="Language"
              subtitle="English is selected by default — add more from the list."
              footer={stepNav}
            >
              <LanguageMultiSelect
                selected={answers.languages ?? ["en"]}
                onChange={(languages) => onUpdateAnswers({ languages })}
              />
            </StepFrame>
          ) : null}

          {step === "discovery" ? (
            <StepFrame
              step="discovery"
              direction={direction}
              title="Discovery style"
              subtitle="Pick any that apply — or leave on Surprise me for a balanced mix."
              footer={stepNav}
            >
              <DiscoveryPopularityPicker
                familiarities={answers.familiarities}
                onChange={(familiarities) => onUpdateAnswers({ familiarities })}
              />
            </StepFrame>
          ) : null}

          {step === "audience" ? (
            <StepFrame
              step="audience"
              direction={direction}
              title="Who's watching?"
              subtitle="Set the tone for who you're choosing for tonight."
              footer={stepNav}
            >
              <DiscoveryAudiencePicker
                familiarities={answers.familiarities}
                onChange={(familiarities) => onUpdateAnswers({ familiarities })}
              />
            </StepFrame>
          ) : null}

          {step === "provider" ? (
            <StepFrame step="provider" direction={direction} title="Provider" subtitle="Where do you want to watch?" footer={stepNav}>
              <div className="onboarding-provider-layout">
                <button
                  type="button"
                  aria-label="No preference"
                  className={
                    !answers.providers?.length
                      ? "onboarding-provider-card onboarding-provider-card--any onboarding-provider-card--selected"
                      : "onboarding-provider-card onboarding-provider-card--any"
                  }
                  onClick={() => onUpdateAnswers({ providers: [] })}
                >
                  <span className="onboarding-provider-card__any-label">No preference</span>
                </button>
                <div className="onboarding-provider-grid">
                  {PROVIDER_OPTIONS.map((provider) => {
                    const selected = answers.providers?.includes(provider.id);
                    return (
                      <button
                        key={provider.id}
                        type="button"
                        aria-label={provider.label}
                        className={
                          selected
                            ? "onboarding-provider-card onboarding-provider-card--wide onboarding-provider-card--selected"
                            : "onboarding-provider-card onboarding-provider-card--wide"
                        }
                        onClick={() => onToggleProvider(provider.id)}
                      >
                        <img src={provider.logoSrc} alt="" className="onboarding-provider-card__logo" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </StepFrame>
          ) : null}

          {step === "avoid" ? (
            <StepFrame
              step="avoid"
              direction={direction}
              title="Avoid tonight"
              subtitle="Tap genres you don't want in the deck tonight."
              footer={stepNav}
            >
              <AvoidTonightPicker
                selected={answers.hardExclusions ?? []}
                onToggle={onToggleExclusion}
              />
            </StepFrame>
          ) : null}

          {step === "keywords" ? (
            <StepFrame step="keywords" direction={direction} title="Keywords" subtitle="Optional — comma-separated vibes or themes." footer={stepNav}>
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
                      commitKeywords(keywordsDraft);
                      goNext();
                    }
                  }}
                  placeholder="Black and white, Slasher, Feel-good"
                />
              </div>
            </StepFrame>
          ) : null}

          {step === "review" ? (
            <StepFrame
              step="review"
              direction={direction}
              title="Your picks"
              subtitle="Everything looks good? We'll build your deck from this."
              footer={stepNav}
            >
              <OnboardingSummary answers={answers} watchRegion={viewerPrefs.watchRegion} />
            </StepFrame>
          ) : null}
        </div>
      </div>

      {isBuildingDeck || deckBuildError ? (
        <DeckBuildingOverlay error={deckBuildError} onDismiss={onDismissDeckBuildError} />
      ) : null}
    </>
  );
}
