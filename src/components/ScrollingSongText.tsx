import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

interface ScrollingSongTextProps {
  title: string;
  artist: string;
  restartKey: string;
  titleClassName?: string;
  artistClassName?: string;
  className?: string;
  initialDelaySeconds?: number;
  pauseSeconds?: number;
  pixelsPerSecond?: number;
}

interface ScrollingTextProps {
  text: string;
  restartKey: string;
  textClassName?: string;
  className?: string;
  initialDelaySeconds?: number;
  pauseSeconds?: number;
  pixelsPerSecond?: number;
}

interface MarqueeLineProps {
  text: string;
  restartKey: string;
  textClassName: string;
  initialDelaySeconds: number;
  pauseSeconds: number;
  pixelsPerSecond: number;
}

function MarqueeLine({
  text,
  restartKey,
  textClassName,
  initialDelaySeconds,
  pauseSeconds,
  pixelsPerSecond,
}: MarqueeLineProps) {
  const viewportRef =
    useRef<HTMLDivElement | null>(null);

  const trackRef =
    useRef<HTMLDivElement | null>(null);

  const firstCopyRef =
    useRef<HTMLDivElement | null>(null);

  const measurementRef =
    useRef<HTMLDivElement | null>(null);

  const animationRef =
    useRef<Animation | null>(null);

  const [shouldScroll, setShouldScroll] =
    useState<boolean>(false);

  function stopAnimation(): void {
    animationRef.current?.cancel();
    animationRef.current = null;

    if (trackRef.current) {
      trackRef.current.style.transform =
        "translate3d(0, 0, 0)";
    }
  }

  const measureOverflow =
    useCallback((): void => {
      const viewport = viewportRef.current;
      const measurement =
        measurementRef.current;

      if (!viewport || !measurement) {
        return;
      }

      const availableWidth =
        viewport.clientWidth;

      const textWidth =
        measurement.getBoundingClientRect()
          .width;

      const nextShouldScroll =
        textWidth > availableWidth + 2;

      setShouldScroll(
        (currentValue) =>
          currentValue === nextShouldScroll
            ? currentValue
            : nextShouldScroll
      );
    }, []);

  const startAnimation =
    useCallback((): void => {
      stopAnimation();

      const track = trackRef.current;
      const firstCopy = firstCopyRef.current;

      if (
        !shouldScroll ||
        !track ||
        !firstCopy
      ) {
        return;
      }

      const trackStyles =
        window.getComputedStyle(track);

      const gap =
        Number.parseFloat(
          trackStyles.columnGap ||
            trackStyles.gap ||
            "0"
        ) || 0;

      const firstCopyWidth =
        firstCopy.getBoundingClientRect().width;

      const travelDistance =
        firstCopyWidth + gap;

      if (travelDistance <= 0) {
        return;
      }

      const movementSeconds = Math.max(
        2.5,
        travelDistance / pixelsPerSecond
      );

      const cycleSeconds =
        pauseSeconds + movementSeconds;

      const pauseOffset =
        pauseSeconds / cycleSeconds;

      animationRef.current = track.animate(
        [
          {
            transform:
              "translate3d(0, 0, 0)",
            offset: 0,
          },
          {
            transform:
              "translate3d(0, 0, 0)",
            offset: pauseOffset,
          },
          {
            transform: `translate3d(-${travelDistance}px, 0, 0)`,
            offset: 1,
          },
        ],
        {
          delay:
            initialDelaySeconds * 1000,
          duration:
            cycleSeconds * 1000,
          iterations: Infinity,
          easing: "linear",
          fill: "both",
        }
      );
    }, [
      shouldScroll,
      initialDelaySeconds,
      pauseSeconds,
      pixelsPerSecond,
    ]);

  useLayoutEffect(() => {
    measureOverflow();
  }, [
    text,
    restartKey,
    textClassName,
    measureOverflow,
  ]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const measurement =
      measurementRef.current;

    if (!viewport || !measurement) {
      return;
    }

    const resizeObserver =
      new ResizeObserver(() => {
        measureOverflow();
      });

    resizeObserver.observe(viewport);
    resizeObserver.observe(measurement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [measureOverflow]);

  useLayoutEffect(() => {
    if (!shouldScroll) {
      stopAnimation();
      return;
    }

    const frameId =
      window.requestAnimationFrame(() => {
        startAnimation();
      });

    return () => {
      window.cancelAnimationFrame(frameId);
      stopAnimation();
    };
  }, [
    shouldScroll,
    text,
    restartKey,
    startAnimation,
  ]);

  return (
    <div
      ref={viewportRef}
      className="relative min-w-0 overflow-hidden"
    >
      <div
        ref={measurementRef}
        aria-hidden="true"
        className={`pointer-events-none invisible absolute left-0 top-0 w-max whitespace-nowrap ${textClassName}`}
      >
        {text}
      </div>

      {shouldScroll ? (
        <div
          ref={trackRef}
          className="flex w-max items-center gap-12 will-change-transform"
        >
          <div
            ref={firstCopyRef}
            className={`shrink-0 whitespace-nowrap ${textClassName}`}
            title={text}
          >
            {text}
          </div>

          <div
            aria-hidden="true"
            className={`shrink-0 whitespace-nowrap ${textClassName}`}
          >
            {text}
          </div>
        </div>
      ) : (
        <div
          className={`min-w-0 whitespace-nowrap ${textClassName}`}
          title={text}
        >
          {text}
        </div>
      )}
    </div>
  );
}

export function ScrollingText({
  text,
  restartKey,
  textClassName = "",
  className = "",
  initialDelaySeconds = 1.25,
  pauseSeconds = 1,
  pixelsPerSecond = 30,
}: ScrollingTextProps) {
  return (
    <div className={`min-w-0 ${className}`}>
      <MarqueeLine
        text={text}
        restartKey={restartKey}
        textClassName={textClassName}
        initialDelaySeconds={
          initialDelaySeconds
        }
        pauseSeconds={pauseSeconds}
        pixelsPerSecond={pixelsPerSecond}
      />
    </div>
  );
}

export function ScrollingSongText({
  title,
  artist,
  restartKey,
  titleClassName = "",
  artistClassName = "",
  className = "",
  initialDelaySeconds = 1.25,
  pauseSeconds = 1,
  pixelsPerSecond = 30,
}: ScrollingSongTextProps) {
  return (
    <div className={`min-w-0 ${className}`}>
      <MarqueeLine
        text={title}
        restartKey={`${restartKey}-title`}
        textClassName={titleClassName}
        initialDelaySeconds={
          initialDelaySeconds
        }
        pauseSeconds={pauseSeconds}
        pixelsPerSecond={pixelsPerSecond}
      />

      <MarqueeLine
        text={artist}
        restartKey={`${restartKey}-artist`}
        textClassName={artistClassName}
        initialDelaySeconds={
          initialDelaySeconds
        }
        pauseSeconds={pauseSeconds}
        pixelsPerSecond={pixelsPerSecond}
      />
    </div>
  );
}
