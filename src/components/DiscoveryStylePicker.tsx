import {
  buildDiscoveryFamiliarities,
  DISCOVERY_AUDIENCE_OPTIONS,
  DISCOVERY_POPULARITY_OPTIONS,
  getDiscoveryAudience,
  getPopularityTokens,
  type DiscoveryPopularity,
  type FamiliarityToken
} from "../config/options";
import type { OnboardingAnswers } from "../types";

export function DiscoveryPopularityPicker({
  familiarities,
  onChange
}: {
  familiarities: OnboardingAnswers["familiarities"];
  onChange: (familiarities: OnboardingAnswers["familiarities"]) => void;
}) {
  const popTokens = getPopularityTokens(familiarities);
  const audience = getDiscoveryAudience(familiarities);

  function togglePopularity(id: DiscoveryPopularity) {
    if (id === "balanced") {
      onChange(buildDiscoveryFamiliarities([], audience));
      return;
    }

    const token = id as FamiliarityToken;
    const next = popTokens.includes(token) ? popTokens.filter((t) => t !== token) : [...popTokens, token];
    onChange(buildDiscoveryFamiliarities(next, audience));
  }

  return (
    <div className="discovery-style__grid discovery-style__grid--popularity">
      {DISCOVERY_POPULARITY_OPTIONS.map((option) => {
        const selected =
          option.id === "balanced" ? popTokens.length === 0 : popTokens.includes(option.id as FamiliarityToken);
        return (
          <button
            key={option.id}
            type="button"
            className={
              selected ? "onboarding-choice-card onboarding-choice-card--selected" : "onboarding-choice-card"
            }
            onClick={() => togglePopularity(option.id)}
            aria-pressed={selected}
          >
            <span className="text-base font-semibold text-white sm:text-lg">{option.label}</span>
            <span className="mt-2 text-xs text-zinc-300 sm:text-sm">{option.description}</span>
          </button>
        );
      })}
    </div>
  );
}

export function DiscoveryAudiencePicker({
  familiarities,
  onChange
}: {
  familiarities: OnboardingAnswers["familiarities"];
  onChange: (familiarities: OnboardingAnswers["familiarities"]) => void;
}) {
  const popTokens = getPopularityTokens(familiarities);
  const audience = getDiscoveryAudience(familiarities);

  return (
    <div className="discovery-style__grid discovery-style__grid--audience">
      {DISCOVERY_AUDIENCE_OPTIONS.map((option) => {
        const selected = audience === option.id;
        return (
          <button
            key={option.id}
            type="button"
            className={
              selected
                ? "onboarding-choice-card onboarding-choice-card--selected onboarding-choice-card--tall"
                : "onboarding-choice-card onboarding-choice-card--tall"
            }
            onClick={() => onChange(buildDiscoveryFamiliarities(popTokens, option.id))}
            aria-pressed={selected}
          >
            <span className="text-base font-semibold text-white sm:text-lg">{option.label}</span>
            <span className="mt-2 text-xs text-zinc-300 sm:text-sm">{option.description}</span>
          </button>
        );
      })}
    </div>
  );
}
