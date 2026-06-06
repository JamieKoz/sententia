import { memo, useEffect, useMemo, useRef, useState } from "react";
import { THUMBNAIL_PATHS } from "../data/thumbnailManifest";

const ROW_COUNT = 7;
const BASE_DURATIONS = [140, 95, 115, 70, 100, 55, 85];

function buildRows(paths: readonly string[], rowCount: number): string[][] {
  const rows: string[][] = Array.from({ length: rowCount }, () => []);
  paths.forEach((path, index) => {
    rows[index % rowCount]!.push(path);
  });
  return rows.map((row, rowIndex) => {
    const rotated = [...row.slice(rowIndex % Math.max(row.length, 1)), ...row.slice(0, rowIndex % Math.max(row.length, 1))];
    const minPerStrip = 14;
    const strip: string[] = [];
    while (strip.length < minPerStrip) {
      strip.push(...rotated);
    }
    return strip;
  });
}

type ThumbnailRowProps = {
  images: string[];
  reverse: boolean;
  durationSec: number;
  depth: number;
  scrollOffset: number;
};

const ThumbnailRow = memo(function ThumbnailRow({
  images,
  reverse,
  durationSec,
  depth,
  scrollOffset
}: ThumbnailRowProps) {
  const loop = [...images, ...images];

  return (
    <div
      className="thumbnail-row"
      style={{
        transform: `translateY(${scrollOffset * (0.04 + depth * 0.018)}px)`,
        opacity: 0.35 + depth * 0.1
      }}
    >
      <div
        className={`thumbnail-row-track${reverse ? " thumbnail-row-track--reverse" : ""}`}
        style={{ animationDuration: `${durationSec}s` }}
      >
        {loop.map((src, index) => (
          <img
            key={`${src}-${index}`}
            src={src}
            alt=""
            className="thumbnail-row-poster"
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        ))}
      </div>
    </div>
  );
});

export function ThumbnailBackdrop() {
  const [scrollY, setScrollY] = useState(() => (typeof window === "undefined" ? 0 : window.scrollY));
  const frameRef = useRef<number | null>(null);

  const rows = useMemo(() => buildRows(THUMBNAIL_PATHS, ROW_COUNT), []);

  useEffect(() => {
    const onScroll = () => {
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        setScrollY(window.scrollY);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, []);

  return (
    <div className="thumbnail-backdrop" aria-hidden="true">
      <div className="thumbnail-backdrop-rows">
        {rows.map((images, rowIndex) => (
          <ThumbnailRow
            key={rowIndex}
            images={images}
            reverse={rowIndex % 2 === 1}
            durationSec={BASE_DURATIONS[rowIndex] ?? 90}
            depth={rowIndex / (ROW_COUNT - 1)}
            scrollOffset={scrollY}
          />
        ))}
      </div>
    </div>
  );
}
