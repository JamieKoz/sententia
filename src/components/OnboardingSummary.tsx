import { formatOnboardingSummary } from "../utils/onboardingSummary";
import type { OnboardingAnswers } from "../types";

export function OnboardingSummary({ answers }: { answers: OnboardingAnswers }) {
  const rows = formatOnboardingSummary(answers);

  return (
    <dl className="onboarding-summary">
      {rows.map((row) => (
        <div key={row.label} className="onboarding-summary__row">
          <dt className="onboarding-summary__label">{row.label}</dt>
          <dd className="onboarding-summary__value">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
