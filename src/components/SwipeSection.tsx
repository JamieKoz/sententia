import { TitleCard } from "./TitleCard";
import { useSwipeGesture } from "../hooks/useSwipeGesture";
import type { Title } from "../types";

/** Next card only appears while the user is dragging the top card aside (not at rest). */
const SWIPE_PEEK_THRESHOLD_PX = 16;

export function SwipeSection(props: {
  currentTitle: Title;
  nextSwipeTitle?: Title;
  deckCursor: number;
  deckLength: number;
  shortlistLength: number;
  canUndo: boolean;
  shareFeedback: string | null;
  onPass: () => void;
  onKeep: () => void;
  onUndo: () => void;
  onShare: () => void;
}) {
  const {
    currentTitle,
    nextSwipeTitle,
    deckCursor,
    deckLength,
    shortlistLength,
    canUndo,
    shareFeedback,
    onPass,
    onKeep,
    onUndo,
    onShare
  } = props;
  const {
    swipeDeltaX,
    isDraggingCard,
    isCommitAnimating,
    isAnimatingCard,
    passOverlayOpacity,
    keepOverlayOpacity,
    onSwipePointerDown,
    onSwipePointerMove,
    onSwipePointerEnd,
    onSwipeTransitionEnd,
    triggerButtonSwipe
  } = useSwipeGesture({
    currentTitleId: currentTitle.id,
    onSwipeKeep: onKeep,
    onSwipePass: onPass
  });

  const swipeControlsDisabled = isCommitAnimating;

  const showBehindCard = Boolean(
    nextSwipeTitle && isAnimatingCard && Math.abs(swipeDeltaX) >= SWIPE_PEEK_THRESHOLD_PX
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="relative flex shrink-0 items-center justify-between px-1 pt-0.5 text-xs sm:text-sm swipe-deck-enter">
        <div className="flex items-center gap-2">
          <span
            key={deckCursor}
            className="inline-block animate-pulse text-lg font-bold tracking-tight text-zinc-100 sm:text-xl"
          >
            {deckLength - deckCursor}
          </span>
          <span className="text-zinc-400">remaining</span>
        </div>
        <span className="text-zinc-500">{shortlistLength} shortlisted</span>
      </div>

      <div className="relative mt-1 flex min-h-0 flex-1 items-center justify-center">
        {showBehindCard && nextSwipeTitle ? (
          <div className="pointer-events-none absolute inset-x-0 top-1/2 z-0 w-full -translate-y-1/2 px-0.5">
            <div className="mx-auto w-full max-w-sm translate-y-2 scale-[0.97] overflow-hidden rounded-3xl opacity-25 sm:max-w-md">
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/25 p-2 shadow-xl backdrop-blur-xl sm:p-3">
                <TitleCard title={nextSwipeTitle} noTopMargin compactMobile truncateOverview />
              </div>
            </div>
          </div>
        ) : null}

        <div className="relative z-10 w-full max-w-sm swipe-deck-enter swipe-deck-enter-delay-2 sm:max-w-md">
          <div
            className={
              isDraggingCard
                ? "relative flex flex-col overflow-hidden rounded-3xl border border-white/20 bg-zinc-950/70 p-2 shadow-2xl backdrop-blur-xl touch-pan-y select-none transition-none sm:p-3"
                : "relative flex flex-col overflow-hidden rounded-3xl border border-white/20 bg-zinc-950/70 p-2 shadow-2xl backdrop-blur-xl touch-pan-y select-none transition-transform duration-300 ease-out sm:p-3"
            }
            style={{
              transform: `translateX(${swipeDeltaX}px) rotate(${swipeDeltaX * 0.06}deg)`
            }}
            onDragStart={(event) => event.preventDefault()}
            onPointerDown={onSwipePointerDown}
            onPointerMove={onSwipePointerMove}
            onPointerUp={onSwipePointerEnd}
            onPointerCancel={onSwipePointerEnd}
            onTransitionEnd={onSwipeTransitionEnd}
          >
            <div
              className="pointer-events-none absolute inset-0 bg-rose-300/20 transition-opacity"
              style={{ opacity: passOverlayOpacity * 0.75 }}
            />
            <div
              className="pointer-events-none absolute inset-0 bg-emerald-300/20 transition-opacity"
              style={{ opacity: keepOverlayOpacity * 0.75 }}
            />

            <div className="relative overflow-hidden">
              <div
                className="pointer-events-none absolute left-3 top-3 z-10 rounded-lg border-2 border-rose-300/80 bg-rose-950/40 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-rose-200 sm:left-4 sm:top-4 sm:px-3 sm:py-1 sm:text-xs"
                style={{ opacity: passOverlayOpacity }}
              >
                NOPE
              </div>
              <div
                className="pointer-events-none absolute right-3 top-3 z-10 rounded-lg border-2 border-emerald-300/80 bg-emerald-950/40 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-emerald-200 sm:right-4 sm:top-4 sm:px-3 sm:py-1 sm:text-xs"
                style={{ opacity: keepOverlayOpacity }}
              >
                LIKE
              </div>

              <TitleCard title={currentTitle} noTopMargin compactMobile truncateOverview />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 grid shrink-0 grid-cols-[auto_1fr_auto] items-center gap-2 rounded-2xl p-1 sm:mt-2.5 sm:gap-3 sm:p-1.5 swipe-deck-enter swipe-deck-enter-delay-3">
        <button
          aria-label="Undo"
          className="justify-self-start grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-full border border-white/35 bg-zinc-900/45 text-base sm:text-lg text-zinc-100 transition hover:bg-zinc-800/60 active:scale-90 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={onUndo}
          disabled={!canUndo}
        >
          ↺
        </button>
        <div className="flex items-center justify-center gap-3 sm:gap-8">
          <button
            aria-label="Pass"
            className="grid h-12 w-12 sm:h-16 sm:w-16 place-items-center rounded-full border-2 border-rose-300/60 bg-rose-900/35 text-2xl sm:text-3xl text-rose-200 transition hover:bg-rose-800/55 active:scale-90 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => triggerButtonSwipe("pass")}
            disabled={swipeControlsDisabled}
          >
            ✕
          </button>
          <button
            aria-label="Keep"
            className="grid h-12 w-12 sm:h-16 sm:w-16 place-items-center rounded-full border-2 border-emerald-300/70 bg-emerald-900/45 text-2xl sm:text-3xl text-emerald-200 transition hover:bg-emerald-800/60 active:scale-90 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => triggerButtonSwipe("keep")}
            disabled={swipeControlsDisabled}
          >
            ♥
          </button>
        </div>
        <button
          aria-label="Share"
          className="justify-self-end grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-full border border-white/35 bg-zinc-900/45 text-base sm:text-lg text-zinc-100 transition hover:bg-zinc-800/60 active:scale-90"
          onClick={onShare}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            className="block opacity-90"
          >
            <path
              fill="#fff"
              d="M14 3l7 7-7 7v-4.1c-5.2 0-8.8 1.7-11 5.1.6-6 3.9-10 11-10.9V3z"
            />
          </svg>
        </button>
      </div>
      {shareFeedback ? (
        <p className="mt-0.5 shrink-0 text-center text-[11px] text-zinc-300 sm:text-xs swipe-deck-enter swipe-deck-enter-delay-3">
          {shareFeedback}
        </p>
      ) : null}
    </section>
  );
}
