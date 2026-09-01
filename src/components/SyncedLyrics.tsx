import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  Song,
} from "../types";

interface Props {
  song: Song;
  progress: number;
  mode: "preview" | "full";
  onSeek?: (seconds: number) => void;
}

interface LyricDisplayItem {
  id: string;
  type: "lyric" | "instrumental";
  time: number;
  text: string;
  lyricIndex?: number;
}

const MIN_INSTRUMENTAL_GAP_SECONDS = 6;
const LYRIC_VISIBLE_SECONDS = 3.5;
const MANUAL_SCROLL_LOCK_MS = 4000;

const DEFAULT_ZOOM_PERCENT = 100;
const MIN_ZOOM_PERCENT = 75;
const MAX_ZOOM_PERCENT = 150;
const ZOOM_INDICATOR_HIDE_MS = 700;

function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      value
    )
  );
}

function touchDistance(
  first: React.Touch,
  second: React.Touch
): number {
  return Math.hypot(
    second.clientX -
      first.clientX,
    second.clientY -
      first.clientY
  );
}

function activeLyricIndex(
  song: Song,
  progress: number
): number {
  const lyrics =
    song.lyrics ?? [];

  let index = 0;

  for (
    let i = 0;
    i < lyrics.length;
    i += 1
  ) {
    if (
      progress >=
      lyrics[i].time
    ) {
      index = i;
    } else {
      break;
    }
  }

  return index;
}

function createDisplayItems(
  song: Song
): LyricDisplayItem[] {
  const lyrics =
    song.lyrics ?? [];

  if (
    lyrics.length === 0
  ) {
    return [];
  }

  const items:
    LyricDisplayItem[] = [];

  /*
   * Intro instrumental.
   */
  const firstLyric =
    lyrics[0];

  if (
    firstLyric.time >=
    MIN_INSTRUMENTAL_GAP_SECONDS
  ) {
    items.push({
      id: "instrumental-intro",
      type: "instrumental",
      time: 0,
      text: "♪",
    });
  }

  lyrics.forEach(
    (
      line,
      index
    ) => {
      items.push({
        id: `lyric-${line.time}-${index}`,
        type: "lyric",
        time: line.time,
        text: line.text,
        lyricIndex: index,
      });

      const nextLine =
        lyrics[
          index + 1
        ];

      if (!nextLine) {
        return;
      }

      const gap =
        nextLine.time -
        line.time;

      if (
        gap <
        MIN_INSTRUMENTAL_GAP_SECONDS
      ) {
        return;
      }

      const instrumentalStart =
        Math.min(
          nextLine.time - 1,
          line.time +
            LYRIC_VISIBLE_SECONDS
        );

      if (
        instrumentalStart >
        line.time
      ) {
        items.push({
          id: `instrumental-${line.time}-${index}`,
          type:
            "instrumental",
          time:
            instrumentalStart,
          text: "♪",
        });
      }
    }
  );

  /*
   * Outro instrumental.
   *
   * SyncedLyrics does not receive the total
   * track duration, so the final ♪ becomes
   * active a short time after the last lyric
   * and remains active until the song ends.
   */
  const lastLyric =
    lyrics[
      lyrics.length - 1
    ];

  if (lastLyric) {
    items.push({
      id: "instrumental-outro",
      type: "instrumental",
      time:
        lastLyric.time +
        LYRIC_VISIBLE_SECONDS,
      text: "♪",
    });
  }

  return items.sort(
    (
      first,
      second
    ) =>
      first.time -
      second.time
  );
}

function activeDisplayIndex(
  items: LyricDisplayItem[],
  progress: number
): number {
  let index = 0;

  for (
    let i = 0;
    i < items.length;
    i += 1
  ) {
    if (
      progress >=
      items[i].time
    ) {
      index = i;
    } else {
      break;
    }
  }

  return index;
}

function lyricVisibilityClass(
  isActive: boolean
): string {
  return isActive
    ? "text-white opacity-100"
    : "text-white/30 opacity-70";
}

export function SyncedLyrics({
  song,
  progress,
  mode,
  onSeek,
}: Props) {
  const containerRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const manualScrollTimeoutRef =
    useRef<number | null>(
      null
    );

  const autoScrollingRef =
    useRef<boolean>(
      false
    );

  const pinchStartDistanceRef =
    useRef<number | null>(
      null
    );

  const pinchStartZoomRef =
    useRef<number>(
      DEFAULT_ZOOM_PERCENT
    );

  const zoomIndicatorTimeoutRef =
    useRef<number | null>(
      null
    );

  const [
    autoScrollPaused,
    setAutoScrollPaused,
  ] = useState<boolean>(
    false
  );

  const [
    zoomPercent,
    setZoomPercent,
  ] = useState<number>(
    DEFAULT_ZOOM_PERCENT
  );

  const [
    showZoomIndicator,
    setShowZoomIndicator,
  ] = useState<boolean>(
    false
  );

  const lyrics =
    song.lyrics ?? [];

  const lyricActive =
    activeLyricIndex(
      song,
      progress
    );

  const displayItems =
    useMemo(
      () =>
        createDisplayItems(
          song
        ),
      [
        song.id,
        song.lyrics,
      ]
    );

  const displayActive =
    activeDisplayIndex(
      displayItems,
      progress
    );

  function clearManualScrollTimer():
    void {
    if (
      manualScrollTimeoutRef.current !==
      null
    ) {
      window.clearTimeout(
        manualScrollTimeoutRef.current
      );

      manualScrollTimeoutRef.current =
        null;
    }
  }

  function clearZoomIndicatorTimer():
    void {
    if (
      zoomIndicatorTimeoutRef.current !==
      null
    ) {
      window.clearTimeout(
        zoomIndicatorTimeoutRef.current
      );

      zoomIndicatorTimeoutRef.current =
        null;
    }
  }

  function pauseAutoScrollFromUser():
    void {
    if (
      mode !== "full" ||
      autoScrollingRef.current
    ) {
      return;
    }

    clearManualScrollTimer();

    setAutoScrollPaused(
      true
    );

    manualScrollTimeoutRef.current =
      window.setTimeout(
        () => {
          setAutoScrollPaused(
            false
          );

          manualScrollTimeoutRef.current =
            null;
        },
        MANUAL_SCROLL_LOCK_MS
      );
  }

  function showZoomValue():
    void {
    clearZoomIndicatorTimer();

    setShowZoomIndicator(
      true
    );
  }

  function scheduleZoomIndicatorHide():
    void {
    clearZoomIndicatorTimer();

    zoomIndicatorTimeoutRef.current =
      window.setTimeout(
        () => {
          setShowZoomIndicator(
            false
          );

          zoomIndicatorTimeoutRef.current =
            null;
        },
        ZOOM_INDICATOR_HIDE_MS
      );
  }

  function handleTouchStart(
    event:
      React.TouchEvent<HTMLDivElement>
  ): void {
    pauseAutoScrollFromUser();

    if (
      event.touches.length !== 2
    ) {
      return;
    }

    const distance =
      touchDistance(
        event.touches[0],
        event.touches[1]
      );

    if (
      !Number.isFinite(distance) ||
      distance <= 0
    ) {
      return;
    }

    pinchStartDistanceRef.current =
      distance;

    pinchStartZoomRef.current =
      zoomPercent;

    showZoomValue();
  }

  function handleTouchMove(
    event:
      React.TouchEvent<HTMLDivElement>
  ): void {
    if (
      event.touches.length !== 2 ||
      pinchStartDistanceRef.current ===
        null
    ) {
      return;
    }

    event.preventDefault();

    const distance =
      touchDistance(
        event.touches[0],
        event.touches[1]
      );

    const startDistance =
      pinchStartDistanceRef.current;

    if (
      !Number.isFinite(distance) ||
      distance <= 0 ||
      startDistance <= 0
    ) {
      return;
    }

    const scale =
      distance /
      startDistance;

    const nextZoom =
      Math.round(
        clamp(
          pinchStartZoomRef.current *
            scale,
          MIN_ZOOM_PERCENT,
          MAX_ZOOM_PERCENT
        )
      );

    setZoomPercent(
      nextZoom
    );

    showZoomValue();
  }

  function handleTouchEnd(
    event:
      React.TouchEvent<HTMLDivElement>
  ): void {
    if (
      event.touches.length < 2
    ) {
      pinchStartDistanceRef.current =
        null;

      pinchStartZoomRef.current =
        zoomPercent;

      scheduleZoomIndicatorHide();
    }
  }

  useEffect(() => {
    return () => {
      clearManualScrollTimer();
      clearZoomIndicatorTimer();
    };
  }, []);

  /*
   * Reset lyric zoom for a new song.
   */
  useEffect(() => {
    setZoomPercent(
      DEFAULT_ZOOM_PERCENT
    );

    pinchStartDistanceRef.current =
      null;

    pinchStartZoomRef.current =
      DEFAULT_ZOOM_PERCENT;

    setShowZoomIndicator(
      false
    );

    clearZoomIndicatorTimer();
  }, [song.id]);

  useEffect(() => {
    if (
      mode !== "full" ||
      displayItems.length === 0 ||
      autoScrollPaused
    ) {
      return;
    }

    const element =
      containerRef.current
        ?.querySelector<HTMLElement>(
          `[data-display-line="${displayActive}"]`
        );

    autoScrollingRef.current =
      true;

    element?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    const timer =
      window.setTimeout(
        () => {
          autoScrollingRef.current =
            false;
        },
        450
      );

    return () => {
      window.clearTimeout(
        timer
      );
    };
  }, [
    autoScrollPaused,
    displayActive,
    displayItems.length,
    mode,
  ]);

  if (
    song.lyricsStatus ===
    "loading"
  ) {
    return (
      <div className="text-sm text-white/60">
        Fetching synced lyrics...
      </div>
    );
  }

  if (
    lyrics.length === 0
  ) {
    return (
      <div className="text-sm text-white/60">
        {song.lyricsMessage ||
          "No synced lyrics available for this song."}
      </div>
    );
  }

  /*
   * Preview stays fixed-size.
   * Pinch zoom is only for the full lyrics screen.
   */
  if (
    mode === "preview"
  ) {
    const start =
      Math.max(
        0,
        lyricActive - 1
      );

    const previewLines =
      lyrics.slice(
        start,
        start + 3
      );

    return (
      <div className="space-y-2">
        {previewLines.map(
          (
            line,
            index
          ) => {
            const realIndex =
              start + index;

            return (
              <p
                key={`${line.time}-${realIndex}`}
                className={`text-lg font-bold leading-snug transition-colors ${
                  realIndex ===
                  lyricActive
                    ? "text-white"
                    : "text-white/40"
                }`}
              >
                {line.text}
              </p>
            );
          }
        )}
      </div>
    );
  }

  const lyricFontSize =
    24 *
    (
      zoomPercent /
      100
    );

  const instrumentalFontSize =
    30 *
    (
      zoomPercent /
      100
    );

  return (
    <div className="relative h-full">
      <div
        ref={containerRef}
        className="h-full overflow-y-auto no-scrollbar"
        style={{
          touchAction: "pan-y",
        }}
        onScroll={
          pauseAutoScrollFromUser
        }
        onPointerDown={
          pauseAutoScrollFromUser
        }
        onTouchStart={
          handleTouchStart
        }
        onTouchMove={
          handleTouchMove
        }
        onTouchEnd={
          handleTouchEnd
        }
        onTouchCancel={
          handleTouchEnd
        }
        onWheel={
          pauseAutoScrollFromUser
        }
      >
        <div className="space-y-1 pt-3 pb-24">
          {displayItems.map(
            (
              item,
              index
            ) => {
              const isActive =
                index ===
                displayActive;

              const visibilityClass =
                lyricVisibilityClass(
                  isActive
                );

              if (
                item.type ===
                "instrumental"
              ) {
                return (
                  <div
                    key={item.id}
                    data-display-line={
                      index
                    }
                    aria-hidden="true"
                    className={`w-full px-2 py-3 text-left font-extrabold leading-snug transition-all duration-300 ${visibilityClass} ${
                      isActive
                        ? "scale-100"
                        : "scale-95"
                    }`}
                    style={{
                      fontSize:
                        `${instrumentalFontSize}px`,
                    }}
                  >
                    <span
                      className={
                        isActive
                          ? "inline-block animate-pulse"
                          : "inline-block"
                      }
                    >
                      ♪
                    </span>
                  </div>
                );
              }

              const lyricIndex =
                item.lyricIndex ??
                0;

              const lineDepthClass =
                isActive
                  ? "scale-[1.035]"
                  : index <
                      displayActive
                    ? "scale-[0.96]"
                    : index ===
                        displayActive +
                          1
                      ? "scale-[0.985]"
                      : "scale-[0.97]";

              const lineClassName =
                `w-full origin-left px-2 py-2 text-left font-extrabold leading-snug transition-[color,opacity,transform] duration-500 ease-out ${visibilityClass} ${lineDepthClass}`;

              if (!onSeek) {
                return (
                  <p
                    key={item.id}
                    data-display-line={
                      index
                    }
                    data-line={
                      lyricIndex
                    }
                    className={
                      lineClassName
                    }
                    style={{
                      fontSize:
                        `${lyricFontSize}px`,
                    }}
                  >
                    {item.text}
                  </p>
                );
              }

              return (
                <button
                  key={item.id}
                  type="button"
                  data-display-line={
                    index
                  }
                  data-line={
                    lyricIndex
                  }
                  onClick={() =>
                    onSeek(
                      item.time
                    )
                  }
                  className={`${lineClassName} cursor-pointer appearance-none border-0 bg-transparent outline-none focus:bg-transparent focus:outline-none focus-visible:bg-transparent focus-visible:outline-none active:bg-transparent`}
                  style={{
                    fontSize:
                      `${lyricFontSize}px`,
                    WebkitTapHighlightColor:
                      "transparent",
                  }}
                  aria-label={`Seek to ${item.text}`}
                >
                  {item.text}
                </button>
              );
            }
          )}
        </div>
      </div>

      <div
        aria-hidden="true"
        className={`pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 transition-all duration-150 ${
          showZoomIndicator
            ? "scale-100 opacity-100"
            : "scale-90 opacity-0"
        }`}
      >
        <div className="flex min-w-[84px] items-center justify-center rounded-2xl bg-black/80 px-5 py-3 text-xl font-black tabular-nums text-white shadow-2xl ring-1 ring-white/10 backdrop-blur">
          {zoomPercent}%
        </div>
      </div>
    </div>
  );
}