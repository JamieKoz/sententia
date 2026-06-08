import { useState, type ReactNode } from "react";
import { DeckBuildingOverlay } from "./DeckBuildingOverlay";
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
import { SettingsMenu } from "./SettingsMenu";
import type { OnboardingAnswers, ViewerPrefs } from "../types";

type OnboardingStep = "welcome" | "vibe" | "basics" | "review";

type TransitionDirection = "forward" | "back";

const STEP_ORDER: OnboardingStep[] = ["welcome", "vibe", "basics", "review"];

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
  onDismissDeckBuildError?: () => void;
  customYearStartPct: number;
  customYearEndPct: number;
  onBegin: () => void;
  onUpdateAnswers: (next: Partial<OnboardingAnswers>) => void;
  onToggleCustomYearRange: () => void;
  onUpdateCustomYearRange: (next: Partial<{ min: number; max: number }>) => void;
  onToggleProvider: (provider: string) => void;
  onToggleExclusion: (exclusion: string) => void;
  viewerPrefs: ViewerPrefs;
  onWatchRegionChange: (watchRegion: string) => void;
  onClearCache: () => void;
  onStartSolo: () => void;
  onStartGroup: () => void;
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
    viewerPrefs,
    onWatchRegionChange,
    onClearCache,
    onStartSolo,
    onStartGroup
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

  async function handleStart() {
    commitKeywords(keywordsDraft);
    if (watchMode === "solo") {
      onStartSolo();
      return;
    }
    onStartGroup();
  }

  const canAdvanceFromVibe = (answers.moods?.length ?? 0) > 0;

  const vibeNav = (
    <div className="onboarding-nav flex items-center justify-center gap-3">
      <NavButton onClick={goBack}>Back</NavButton>
      <NavButton variant="primary" onClick={goNext} disabled={!canAdvanceFromVibe}>
        Continue
      </NavButton>
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

          {step === "vibe" ? (
            <StepFrame
              step="vibe"
              direction={direction}
              title="What kind of night is it?"
              subtitle="Choose the setup that best matches tonight."
              footer={vibeNav}
            >
              <div className="onboarding-quick-presets">
                {QUICK_PRESETS.map((preset) => {
                  const selected = answers.quickModeId === preset.id;
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
            </StepFrame>
          ) : null}

          {step === "basics" ? (
            <StepFrame
              step="basics"
              direction={direction}
              title="Ready when you are"
              subtitle="Confirm the basics. Add more filters only if you want them."
            >
              <div className="onboarding-basics">
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

                <SectionHeading title="Watching" />
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

                <details className="onboarding-filter-panel">
                  <summary className="summary-no-marker onboarding-filter-panel__summary">
                    <span>
                      <strong>Additional filters</strong>
                      <small>Provider, language, release date, audience, avoids, and keywords</small>
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
                      <SectionHeading title="Provider" subtitle="No preference is fine." />
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
        <DeckBuildingOverlay error={deckBuildError} onDismiss={onDismissDeckBuildError} />
      ) : null}
    </>
  );
}
