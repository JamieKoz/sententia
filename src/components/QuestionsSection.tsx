import { useState, type ReactNode } from "react";
import { DeckBuildingOverlay } from "./DeckBuildingOverlay";
import type { DeckBuildProgress } from "../services/deckBuildProgress";
import { AvoidTonightPicker } from "./AvoidTonightPicker";
import { DiscoveryAudiencePicker, DiscoveryPopularityPicker } from "./DiscoveryStylePicker";
import { LanguageMultiSelect } from "./LanguageMultiSelect";
import { OnboardingSummary } from "./OnboardingSummary";
import { ReleaseTimeline } from "./ReleaseTimeline";
import {
  PROVIDER_OPTIONS,
  QUICK_PRESETS,
  RUNTIME_OPTIONS,
  TYPE_OPTIONS
} from "../config/options";
import type { OnboardingAnswers, Title, ViewerPrefs } from "../types";

type OnboardingStep = "welcome" | "vibe" | "basics" | "review";

type TransitionDirection = "forward" | "back";

const STEP_ORDER: OnboardingStep[] = ["welcome", "vibe", "basics", "review"];
const QUESTION_STEPS = STEP_ORDER.filter((step): step is Exclude<OnboardingStep, "welcome"> => step !== "welcome");
const NO_PREFERENCE_PRESET_ID = "no-preference";
const STEP_DISPLAY_LABELS: Record<Exclude<OnboardingStep, "welcome">, string> = {
  vibe: "Vibe",
  basics: "Basics",
  review: "Review"
};
const NEXT_STEP_LABELS: Record<Exclude<OnboardingStep, "welcome">, string> = {
  vibe: "Basics",
  basics: "Review",
  review: "Finish"
};

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
  step: Exclude<OnboardingStep, "welcome">;
  direction: TransitionDirection;
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const progressIndex = QUESTION_STEPS.indexOf(step);
  const progressValue = progressIndex >= 0 ? progressIndex + 1 : 1;
  const progressTotal = QUESTION_STEPS.length;
  const progressPct = Math.round((progressValue / progressTotal) * 100);
  const stepDisplayLabel = STEP_DISPLAY_LABELS[step];
  const nextStepLabel = NEXT_STEP_LABELS[step];

  return (
    <section key={step} className={`onboarding-step onboarding-step--${direction} flex w-full max-w-[64rem] flex-col items-center pt-[14dvh] text-center`}>
      <div className="onboarding-progress" aria-label={`Step ${progressValue} of ${progressTotal}`}>
        <div className="onboarding-progress__meta">
          <span>{`${stepDisplayLabel}`}</span>
          <span>{`${nextStepLabel}`}</span>
        </div>
        <div className="onboarding-progress__track" role="progressbar" aria-valuemin={1} aria-valuemax={progressTotal} aria-valuenow={progressValue}>
          <span className="onboarding-progress__fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>
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
      ? "rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-7 py-2.5 font-medium text-white shadow-lg shadow-violet-900/40 transition hover:brightness-110 active:scale-95 active:brightness-95 disabled:opacity-50"
      : "rounded-full border border-white/25 bg-zinc-900/60 px-5 py-2.5 text-sm text-zinc-100 transition hover:border-white/45 hover:bg-zinc-800/70 active:scale-95 disabled:opacity-50";

  return (
    <button type="button" className={base} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="onboarding-section-heading">
      <h3>{title}</h3>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
  );
}

export function QuestionsSection(props: {
  answers: OnboardingAnswers;
  isBuildingDeck: boolean;
  deckBuildError?: string | null;
  deckBuildProgress?: DeckBuildProgress | null;
  onDismissDeckBuildError?: () => void;
  customYearStartPct: number;
  customYearEndPct: number;
  onBegin: () => void;
  hasLastAnswers?: boolean;
  hasDraftSession?: boolean;
  followUpTitle?: Title;
  onUpdateAnswers: (next: Partial<OnboardingAnswers>) => void;
  onToggleCustomYearRange: () => void;
  onUpdateCustomYearRange: (next: Partial<{ min: number; max: number }>) => void;
  onToggleProvider: (provider: string) => void;
  onToggleExclusion: (exclusion: string) => void;
  viewerPrefs: ViewerPrefs;
  onWatchRegionChange: (watchRegion: string) => void;
  onClearCache: () => void;
  onToggleTasteProfile: () => void;
  onToggleLibrary: () => void;
  onToggleHistory?: () => void;
  savedCount: number;
  watchedCount: number;
  onStartSolo: () => void;
  onStartGroup: () => void;
  onStartFromLastTime?: () => void;
  onResumeSession?: () => void;
  onFollowUpResponse?: (reaction?: "up" | "down") => void;
}) {
  const {
    answers,
    isBuildingDeck,
    deckBuildError,
    deckBuildProgress,
    onDismissDeckBuildError,
    customYearStartPct,
    customYearEndPct,
    onBegin,
    hasLastAnswers,
    hasDraftSession,
    followUpTitle,
    onUpdateAnswers,
    onToggleCustomYearRange,
    onUpdateCustomYearRange,
    onToggleProvider,
    onToggleExclusion,
    viewerPrefs,
    onStartSolo,
    onStartGroup,
    onStartFromLastTime,
    onResumeSession,
    onFollowUpResponse
  } = props;

  const customYearRange = answers.customYearRange;
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [direction, setDirection] = useState<TransitionDirection>("forward");
  const [keywordsDraft, setKeywordsDraft] = useState((answers.keywords ?? []).join(", "));
  const [watchMode, setWatchMode] = useState<"solo" | "group">("solo");

  function goTo(next: OnboardingStep) {
    setDirection(stepIndex(next) >= stepIndex(step) ? "forward" : "back");
    setStep(next);
  }

  function goNext() {
    if (step === "welcome") {
      onBegin();
    }
    if (step === "vibe" && !answers.quickModeId) {
      applyNoPreference();
    }
    if (step === "basics") {
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

  function applyQuickPreset(preset: (typeof QUICK_PRESETS)[number]) {
    onUpdateAnswers({
      moods: [],
      preferredType: "either",
      runtime: "any",
      releaseWindow: "any",
      customYearRange: null,
      familiarities: [],
      ...preset.values,
      quickModeId: preset.id
    });
  }

  function applyNoPreference() {
    onUpdateAnswers({
      moods: [],
      preferredType: "either",
      runtime: "any",
      releaseWindow: "any",
      customYearRange: null,
      familiarities: [],
      quickModeId: NO_PREFERENCE_PRESET_ID
    });
  }

  async function handleStart() {
    commitKeywords(keywordsDraft);
    if (watchMode === "solo") {
      onStartSolo();
      return;
    }
    onStartGroup();
  }

  const activeQuickModeId = answers.quickModeId ?? NO_PREFERENCE_PRESET_ID;

  const vibeNav = (
    <div className="onboarding-nav flex items-center justify-center gap-3">
      <NavButton onClick={goBack}>Back</NavButton>
      <NavButton variant="primary" onClick={goNext}>
        Continue
      </NavButton>
    </div>
  );

  return (
    <>
      <div className="onboarding-shell">

        <div className="onboarding-content">
          {step === "welcome" ? (
            <div key="welcome" className="onboarding-step onboarding-step--forward flex w-full flex-col items-center justify-start pt-[25dvh] text-center">
              <h1 className="mt-4 max-w-md text-[3rem] text-white">Your next watch<br />Decided now</h1>
              <h1 className="mt-4 max-w-md text-base text-white">Stop scrolling. Start watching.</h1>
              {followUpTitle ? (
                <div className="follow-up-slide-in mt-6 max-w-md rounded-2xl border border-violet-300/35 bg-violet-900/20 px-4 py-3 text-left">
                  <p className="mt-1 text-sm text-zinc-100">
                    Your last pick was <span className="font-medium">{followUpTitle.name}</span>. Did you watch it?
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="rounded-full border border-emerald-300/55 bg-emerald-900/40 px-3 py-1 text-xs text-emerald-100 transition hover:bg-emerald-800/60 active:scale-95"
                      onClick={() => onFollowUpResponse?.("up")}
                    >
                      👍 Yes, liked it
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-rose-300/55 bg-rose-900/40 px-3 py-1 text-xs text-rose-100 transition hover:bg-rose-800/60 active:scale-95"
                      onClick={() => onFollowUpResponse?.("down")}
                    >
                      👎 Yes, not for me
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-white/25 bg-zinc-900/60 px-3 py-1 text-xs text-zinc-100 transition hover:bg-zinc-800/70 active:scale-95"
                      onClick={() => onFollowUpResponse?.(undefined)}
                    >
                      Didn&apos;t watch it
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                {hasLastAnswers && onStartFromLastTime ? (
                  <NavButton onClick={onStartFromLastTime}>Repeat previous</NavButton>
                ) : null}
                {hasDraftSession && onResumeSession ? (
                  <NavButton onClick={onResumeSession}>Resume where you left off</NavButton>
                ) : null}
                <NavButton variant="primary" onClick={goNext}>
                  Begin
                </NavButton>
              </div>
            </div>
          ) : null}

          {step === "vibe" ? (
            <StepFrame
              step="vibe"
              direction={direction}
              title="What kind of night is it?"
              subtitle="Choose a preset for your vibe."
              footer={vibeNav}
            >
              <div className="onboarding-quick-presets">
                <button
                  type="button"
                  className={
                    activeQuickModeId === NO_PREFERENCE_PRESET_ID
                      ? "onboarding-choice-card onboarding-choice-card--compact onboarding-choice-card--wide-row onboarding-choice-card--selected"
                      : "onboarding-choice-card onboarding-choice-card--compact onboarding-choice-card--wide-row"
                  }
                  onClick={applyNoPreference}
                  aria-pressed={activeQuickModeId === NO_PREFERENCE_PRESET_ID}
                >
                  <span className="text-base font-semibold text-white sm:text-lg">No strong preference</span>
                  <span className="mt-2 text-xs text-zinc-300 sm:text-sm">Keep options broad and decide from defaults.</span>
                </button>
                <div className="onboarding-quick-presets__grid">
                  {QUICK_PRESETS.map((preset) => {
                    const selected = activeQuickModeId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        className={
                          selected
                            ? "onboarding-choice-card onboarding-choice-card--compact onboarding-choice-card--selected"
                            : "onboarding-choice-card onboarding-choice-card--compact"
                        }
                        onClick={() => applyQuickPreset(preset)}
                        aria-pressed={selected}
                      >
                        <span className="text-base font-semibold text-white sm:text-lg">{preset.label}</span>
                        <span className="mt-2 text-xs text-zinc-300 sm:text-sm">{preset.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </StepFrame>
          ) : null}

          {step === "basics" ? (
            <StepFrame
              step="basics"
              direction={direction}
              title="Ready when you are"
              subtitle="Your vibe pre-fills these settings. Keep them or tweak anything."
            >
              <div className="onboarding-basics">

                <SectionHeading title="Watching setup" subtitle="Choose solo or group before building the deck." />
                <div className="onboarding-segment-grid onboarding-segment-grid--two">
                  <button
                    type="button"
                    className={watchMode === "solo" ? "onboarding-segment onboarding-segment--selected" : "onboarding-segment"}
                    onClick={() => setWatchMode("solo")}
                    aria-pressed={watchMode === "solo"}
                  >
                    <span>Solo</span>
                    <small>Your personal deck</small>
                  </button>
                  <button
                    type="button"
                    className={watchMode === "group" ? "onboarding-segment onboarding-segment--selected" : "onboarding-segment"}
                    onClick={() => setWatchMode("group")}
                    aria-pressed={watchMode === "group"}
                  >
                    <span>Group</span>
                    <small>Create a shareable room</small>
                  </button>
                </div>

                <SectionHeading title="Format" />
                <div className="onboarding-segment-grid onboarding-segment-grid--three">
                  {TYPE_OPTIONS.map((typeOption) => {
                    const selected = (answers.preferredType ?? "either") === typeOption.value;
                    return (
                      <button
                        key={typeOption.value}
                        type="button"
                        className={selected ? "onboarding-segment onboarding-segment--selected" : "onboarding-segment"}
                        onClick={() => onUpdateAnswers({ preferredType: typeOption.value, quickModeId: undefined })}
                        aria-pressed={selected}
                      >
                        <span>{typeOption.label}</span>
                        <small>{typeOption.description}</small>
                      </button>
                    );
                  })}
                </div>

                <SectionHeading title="Length" />
                <div className="onboarding-segment-grid onboarding-segment-grid--four">
                  {RUNTIME_OPTIONS.map((runtimeOption) => {
                    const selected = (answers.runtime ?? "any") === runtimeOption.value;
                    return (
                      <button
                        key={runtimeOption.value}
                        type="button"
                        className={selected ? "onboarding-segment onboarding-segment--selected" : "onboarding-segment"}
                        onClick={() => onUpdateAnswers({ runtime: runtimeOption.value, quickModeId: undefined })}
                        aria-pressed={selected}
                      >
                        <span>{runtimeOption.label}</span>
                        <small>{runtimeOption.description}</small>
                      </button>
                    );
                  })}
                </div>

                <div className="onboarding-filter-block mt-4">
                  <SectionHeading title="Provider" subtitle="Shown upfront because this usually matters most." />
                  <div className="onboarding-provider-layout">
                    <button
                      type="button"
                      aria-label="No preference"
                      aria-pressed={!answers.providers?.length}
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
                            aria-pressed={selected}
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
                </div>

                <details className="onboarding-filter-panel">
                  <summary className="summary-no-marker onboarding-filter-panel__summary">
                    <span>
                      <strong>Additional filters</strong>
                      <small>Language, release date, discovery style, avoids, and keywords</small>
                    </span>
                    <span aria-hidden="true">+</span>
                  </summary>

                  <div className="onboarding-filter-panel__content">

                    <div className="onboarding-filter-block">
                      <SectionHeading title="Release date" subtitle="Leave on Any era for the broadest deck." />
                      <ReleaseTimeline
                        releaseWindow={answers.releaseWindow ?? "any"}
                        customYearRange={customYearRange}
                        customYearStartPct={customYearStartPct}
                        customYearEndPct={customYearEndPct}
                        onSelectWindow={(window) =>
                          onUpdateAnswers({ releaseWindow: window, customYearRange: null, quickModeId: undefined })
                        }
                        onToggleCustomYearRange={onToggleCustomYearRange}
                        onUpdateCustomYearRange={onUpdateCustomYearRange}
                      />
                    </div>

                    <div className="onboarding-filter-block">
                      <SectionHeading title="Discovery style" />
                      <DiscoveryPopularityPicker
                        familiarities={answers.familiarities}
                        onChange={(familiarities) => onUpdateAnswers({ familiarities, quickModeId: undefined })}
                      />
                    </div>

                    <div className="onboarding-filter-block">
                      <SectionHeading title="Who's watching?" />
                      <DiscoveryAudiencePicker
                        familiarities={answers.familiarities}
                        onChange={(familiarities) => onUpdateAnswers({ familiarities, quickModeId: undefined })}
                      />
                    </div>

                    <div className="onboarding-filter-block">
                      <SectionHeading title="Avoid tonight" subtitle="Tap genres you do not want in the deck." />
                      <AvoidTonightPicker selected={answers.hardExclusions ?? []} onToggle={onToggleExclusion} />
                    </div>

                    <div className="onboarding-filter-block">
                      <SectionHeading title="Language" subtitle="English is selected by default." />
                      <LanguageMultiSelect
                        selected={answers.languages ?? ["en"]}
                        onChange={(languages) => onUpdateAnswers({ languages })}
                      />
                    </div>

                    <div className="onboarding-filter-block">
                      <SectionHeading title="Keywords" subtitle="Optional comma-separated vibes or themes." />
                      <input
                        className="onboarding-keywords-input"
                        type="text"
                        value={keywordsDraft}
                        onChange={(event) => setKeywordsDraft(event.target.value)}
                        onBlur={() => commitKeywords(keywordsDraft)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            commitKeywords(keywordsDraft);
                          }
                        }}
                        placeholder="Black and white, Slasher, Feel-good"
                      />
                      {keywordsDraft
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean)
                        .slice(0, 8)
                        .map((keyword, idx) => (
                          <span
                            key={`${keyword}-${idx}`}
                            className="mr-2 mt-2 inline-flex rounded-full border border-violet-300/35 bg-violet-500/20 px-2.5 py-1 text-xs text-violet-100"
                          >
                            {keyword.toLowerCase()}
                          </span>
                        ))}
                    </div>
                  </div>
                </details>

                <div className="onboarding-nav flex items-center justify-center gap-3">
                  <NavButton onClick={goBack}>Back</NavButton>
                  <NavButton variant="primary" onClick={goNext}>
                    Review
                  </NavButton>
                </div>
              </div>
            </StepFrame>
          ) : null}

          {step === "review" ? (
            <StepFrame
              step="review"
              direction={direction}
              title="Your picks"
              subtitle="Everything looks good? We'll build your deck from this."
            >
              <div className="mb-4 flex flex-wrap items-center justify-center gap-2 text-xs text-zinc-300">
                <button
                  type="button"
                  className="rounded-full border border-white/20 bg-zinc-900/45 px-3 py-1.5 transition hover:border-white/40 hover:bg-zinc-800/70"
                  onClick={() => goTo("vibe")}
                >
                  Edit vibe
                </button>
                <button
                  type="button"
                  className="rounded-full border border-white/20 bg-zinc-900/45 px-3 py-1.5 transition hover:border-white/40 hover:bg-zinc-800/70"
                  onClick={() => goTo("basics")}
                >
                  Edit basics
                </button>
              </div>
              <OnboardingSummary answers={answers} watchRegion={viewerPrefs.watchRegion} />
              <div className="onboarding-nav flex items-center justify-center gap-3">
                <NavButton onClick={goBack}>Back</NavButton>
                <NavButton
                  variant="primary"
                  onClick={() => {
                    void handleStart();
                  }}
                  disabled={isBuildingDeck}
                >
                  {isBuildingDeck ? "Loading…" : watchMode === "group" ? "Create room" : "Start swiping"}
                </NavButton>
              </div>
            </StepFrame>
          ) : null}
        </div>
      </div>

      {isBuildingDeck || deckBuildError ? (
        <DeckBuildingOverlay
          error={deckBuildError}
          progress={deckBuildProgress}
          onDismiss={onDismissDeckBuildError}
        />
      ) : null}
    </>
  );
}
