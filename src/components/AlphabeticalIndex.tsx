import React, {
  useCallback,
  useRef,
  useState,
} from "react";

export const ALPHABETICAL_INDEX_LETTERS = [
  "#",
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ",
] as const;

export type AlphabeticalIndexLetter =
  (typeof ALPHABETICAL_INDEX_LETTERS)[number];

interface AlphabeticalIndexProps {
  activeLetter: AlphabeticalIndexLetter;
  availableLetters: ReadonlySet<AlphabeticalIndexLetter>;
  onSelectLetter: (
    letter: AlphabeticalIndexLetter,
    dragging: boolean
  ) => void;
  ariaLabel: string;
}

export function getAlphabeticalIndexLetter(
  value: string
): AlphabeticalIndexLetter {
  const firstCharacter =
    value.trim().charAt(0).toUpperCase();

  return /^[A-Z]$/.test(firstCharacter)
    ? (firstCharacter as AlphabeticalIndexLetter)
    : "#";
}

export function AlphabeticalIndex({
  activeLetter,
  availableLetters,
  onSelectLetter,
  ariaLabel,
}: AlphabeticalIndexProps) {
  const indexRef =
    useRef<HTMLDivElement | null>(null);

  const [
    touchingLetter,
    setTouchingLetter,
  ] = useState<AlphabeticalIndexLetter | null>(
    null
  );

  const resolveLetterFromPoint =
    useCallback(
      (
        clientY: number
      ): AlphabeticalIndexLetter | null => {
        const index =
          indexRef.current;

        if (!index) {
          return null;
        }

        const bounds =
          index.getBoundingClientRect();

        if (bounds.height <= 0) {
          return null;
        }

        const relativeY = Math.min(
          Math.max(
            clientY - bounds.top,
            0
          ),
          bounds.height - 0.01
        );

        const rawIndex = Math.floor(
          (relativeY / bounds.height) *
            ALPHABETICAL_INDEX_LETTERS.length
        );

        return (
          ALPHABETICAL_INDEX_LETTERS[
            Math.min(
              Math.max(rawIndex, 0),
              ALPHABETICAL_INDEX_LETTERS.length -
                1
            )
          ] ?? null
        );
      },
      []
    );

  function selectFromPoint(
    clientY: number,
    dragging: boolean
  ): void {
    const letter =
      resolveLetterFromPoint(clientY);

    if (!letter) {
      return;
    }

    setTouchingLetter(letter);

    if (
      availableLetters.has(letter)
    ) {
      onSelectLetter(
        letter,
        dragging
      );
    }
  }

  function clearTouchingLetter(): void {
    setTouchingLetter(null);
  }

  return (
    <>
      <div
        ref={indexRef}
        role="navigation"
        aria-label={ariaLabel}
        className="fixed bottom-[calc(5.7rem+env(safe-area-inset-bottom))] right-[max(0.2rem,calc((100vw-430px)/2+0.2rem))] top-[calc(5.25rem+env(safe-area-inset-top))] z-30 flex w-7 touch-none select-none flex-col items-center justify-center py-1"
        onPointerDown={(event) => {
          event.preventDefault();

          event.currentTarget.setPointerCapture(
            event.pointerId
          );

          selectFromPoint(
            event.clientY,
            false
          );
        }}
        onPointerMove={(event) => {
          if (
            !event.currentTarget.hasPointerCapture(
              event.pointerId
            )
          ) {
            return;
          }

          event.preventDefault();

          selectFromPoint(
            event.clientY,
            true
          );
        }}
        onPointerUp={(event) => {
          if (
            event.currentTarget.hasPointerCapture(
              event.pointerId
            )
          ) {
            event.currentTarget.releasePointerCapture(
              event.pointerId
            );
          }

          clearTouchingLetter();
        }}
        onPointerCancel={
          clearTouchingLetter
        }
        onLostPointerCapture={
          clearTouchingLetter
        }
      >
        {ALPHABETICAL_INDEX_LETTERS.map(
          (letter) => {
            const available =
              availableLetters.has(letter);

            const selected =
              activeLetter === letter;

            return (
              <button
                key={letter}
                type="button"
                tabIndex={-1}
                disabled={!available}
                aria-label={
                  available
                    ? `Jump to ${letter}`
                    : `${letter} unavailable`
                }
                className={`flex min-h-0 flex-1 items-center justify-center text-[9px] font-extrabold leading-none transition-transform ${
                  selected
                    ? "scale-125 text-white"
                    : available
                      ? "text-neutral-400"
                      : "text-neutral-700"
                }`}
                onClick={(event) => {
                  event.preventDefault();

                  if (available) {
                    onSelectLetter(
                      letter,
                      false
                    );
                  }
                }}
              >
                {letter}
              </button>
            );
          }
        )}
      </div>

      {touchingLetter ? (
        <div
          className="pointer-events-none fixed left-1/2 top-1/2 z-40 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl bg-neutral-800/95 text-4xl font-black text-white shadow-2xl ring-1 ring-white/10 backdrop-blur"
          aria-hidden="true"
        >
          {touchingLetter}
        </div>
      ) : null}
    </>
  );
}