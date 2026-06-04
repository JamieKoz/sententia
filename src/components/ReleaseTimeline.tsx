import { RELEASE_TIMELINE_SEGMENTS, YEAR_MAX, YEAR_MIN } from "../config/options";
import type { OnboardingAnswers } from "../types";

type ReleaseWindow = NonNullable<OnboardingAnswers["releaseWindow"]>;

export function ReleaseTimeline(props: {
  releaseWindow: ReleaseWindow;
  customYearRange: { min: number; max: number } | null | undefined;
  customYearStartPct: number;
  customYearEndPct: number;
  onSelectWindow: (window: ReleaseWindow) => void;
  onToggleCustomYearRange: () => void;
  onUpdateCustomYearRange: (next: Partial<{ min: number; max: number }>) => void;
}) {
  const {
    releaseWindow,
    customYearRange,
    customYearStartPct,
    customYearEndPct,
    onSelectWindow,
    onToggleCustomYearRange,
    onUpdateCustomYearRange
  } = props;

  const isAny = !customYearRange && (releaseWindow === "any" || !releaseWindow);
  const segmentIndex = customYearRange
    ? -1
    : RELEASE_TIMELINE_SEGMENTS.findIndex((segment) => segment.value === releaseWindow);

  const segmentCount = RELEASE_TIMELINE_SEGMENTS.length;
  const segmentWidthPct = 100 / segmentCount;

  let fillLeft = "0%";
  let fillWidth = "0%";
  if (customYearRange) {
    fillLeft = `${customYearStartPct}%`;
    fillWidth = `${customYearEndPct - customYearStartPct}%`;
  } else if (segmentIndex >= 0) {
    fillLeft = `${segmentIndex * segmentWidthPct}%`;
    fillWidth = `${segmentWidthPct}%`;
  } else if (isAny) {
    fillLeft = "0%";
    fillWidth = "100%";
  }

  return (
    <div className="release-timeline">
      <button
        type="button"
        className={
          isAny
            ? "release-timeline__any release-timeline__any--selected"
            : "release-timeline__any"
        }
        onClick={() => onSelectWindow("any")}
      >
        Any era
      </button>

      <div className="release-timeline__track" role="group" aria-label="Release era">
        <div className="release-timeline__rail" aria-hidden="true">
          <div
            className={`release-timeline__rail-fill${isAny && !customYearRange ? " release-timeline__rail-fill--any" : ""}${customYearRange ? " release-timeline__rail-fill--custom" : ""}`}
            style={{ left: fillLeft, width: fillWidth }}
          />
        </div>

        {RELEASE_TIMELINE_SEGMENTS.map((segment) => {
          const selected = !customYearRange && releaseWindow === segment.value;
          return (
            <button
              key={segment.value}
              type="button"
              className={
                selected
                  ? "release-timeline__segment release-timeline__segment--selected"
                  : "release-timeline__segment"
              }
              style={{ width: `${segmentWidthPct}%` }}
              onClick={() => onSelectWindow(segment.value as ReleaseWindow)}
              aria-pressed={selected}
            >
              <span className="release-timeline__dot" aria-hidden="true" />
              <span className="release-timeline__label">{segment.label}</span>
              <span className="release-timeline__hint">{segment.hint}</span>
            </button>
          );
        })}
      </div>

      <div className="release-timeline__bounds" aria-hidden="true">
        <span>{YEAR_MIN}</span>
        <span>{YEAR_MAX}</span>
      </div>

      <button
        type="button"
        className={
          customYearRange
            ? "release-timeline__custom-toggle release-timeline__custom-toggle--active"
            : "release-timeline__custom-toggle"
        }
        onClick={onToggleCustomYearRange}
      >
        Custom range
      </button>

      {customYearRange ? (
        <div className="release-timeline__custom-panel">
          <p className="release-timeline__custom-label">
            <span className="font-medium text-zinc-100">{customYearRange.min}</span>
            <span className="text-zinc-500"> – </span>
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
        </div>
      ) : null}
    </div>
  );
}
