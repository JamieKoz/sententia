import { useState } from "react";
import { ShowdownChoiceCard } from "./ShowdownChoiceCard";
import type { Title } from "../types";

export function ShowdownSection({
  left,
  right,
  onPickLeft,
  onPickRight,
  onShowMoreLeft,
  onShowMoreRight
}: {
  left: Title;
  right: Title;
  onPickLeft: () => void;
  onPickRight: () => void;
  onShowMoreLeft: () => void;
  onShowMoreRight: () => void;
}) {
  const pairKey = `${left.id}:${right.id}`;
  const [pickAnimation, setPickAnimation] = useState<{ pairKey: string; side: "left" | "right" } | null>(null);
  const pickedSide = pickAnimation?.pairKey === pairKey ? pickAnimation.side : null;

  function handlePick(side: "left" | "right", onPick: () => void) {
    if (pickedSide) return;
    setPickAnimation({ pairKey, side });
    window.setTimeout(onPick, 260);
  }

  return (
    <section className="showdown-section rounded-3xl border border-white/20 p-5 shadow-2xl backdrop-blur-lg">
      <div className="showdown-section__header">
        <h2 className="text-xl font-semibold">Final showdown</h2>
        <p className="mt-2 text-sm text-zinc-300">Pick one. Use “Show more” for description and full details.</p>
      </div>
      <div className="showdown-section__grid mt-4">
        <ShowdownChoiceCard
          title={left}
          side="left"
          selectionState={pickedSide ? (pickedSide === "left" ? "picked" : "dismissed") : "idle"}
          onPick={() => handlePick("left", onPickLeft)}
          onShowMore={onShowMoreLeft}
        />
        <div className="showdown-section__versus" aria-hidden="true">
          VS
        </div>
        <ShowdownChoiceCard
          title={right}
          side="right"
          selectionState={pickedSide ? (pickedSide === "right" ? "picked" : "dismissed") : "idle"}
          onPick={() => handlePick("right", onPickRight)}
          onShowMore={onShowMoreRight}
        />
      </div>
    </section>
  );
}
