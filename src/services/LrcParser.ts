import type {
  LyricLine,
} from "../types";

const TIMESTAMP_PATTERN =
  /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

function fractionToSeconds(
  fraction: string | undefined
): number {
  if (!fraction) {
    return 0;
  }

  /*
   * LRC supports timestamps such as:
   *
   * [01:20.4]   -> 400 ms
   * [01:20.45]  -> 450 ms
   * [01:20.450] -> 450 ms
   */
  if (fraction.length === 1) {
    return Number(fraction) / 10;
  }

  if (fraction.length === 2) {
    return Number(fraction) / 100;
  }

  return Number(
    fraction.slice(0, 3)
  ) / 1000;
}

export function parseLrc(
  lrcText: string
): LyricLine[] {
  if (
    typeof lrcText !== "string" ||
    lrcText.trim().length === 0
  ) {
    return [];
  }

  const parsedLines:
    LyricLine[] = [];

  const sourceLines =
    lrcText.split(/\r?\n/);

  for (
    const sourceLine of
      sourceLines
  ) {
    TIMESTAMP_PATTERN.lastIndex =
      0;

    const timestamps:
      number[] = [];

    let match:
      RegExpExecArray | null;

    while (
      (
        match =
          TIMESTAMP_PATTERN.exec(
            sourceLine
          )
      ) !== null
    ) {
      const minutes =
        Number(match[1]);

      const seconds =
        Number(match[2]);

      const fraction =
        fractionToSeconds(
          match[3]
        );

      if (
        !Number.isFinite(
          minutes
        ) ||
        !Number.isFinite(
          seconds
        )
      ) {
        continue;
      }

      timestamps.push(
        minutes * 60 +
          seconds +
          fraction
      );
    }

    if (
      timestamps.length === 0
    ) {
      continue;
    }

    const text =
      sourceLine
        .replace(
          TIMESTAMP_PATTERN,
          ""
        )
        .trim();

    /*
     * Empty timed lines are ignored.
     * They commonly appear at the end
     * of LRC files.
     */
    if (!text) {
      continue;
    }

    for (
      const timestamp of
        timestamps
    ) {
      parsedLines.push({
        time:
          Math.max(
            0,
            timestamp
          ),

        text,
      });
    }
  }

  return parsedLines
    .filter(
      (
        line:
          LyricLine
      ) =>
        Number.isFinite(
          line.time
        ) &&
        line.text.length >
          0
    )
    .sort(
      (
        firstLine:
          LyricLine,
        secondLine:
          LyricLine
      ) =>
        firstLine.time -
        secondLine.time
    )
    .filter(
      (
        line:
          LyricLine,
        index:
          number,
        lines:
          LyricLine[]
      ) => {
        if (
          index === 0
        ) {
          return true;
        }

        const previousLine =
          lines[index - 1];

        return !(
          previousLine.time ===
            line.time &&
          previousLine.text ===
            line.text
        );
      }
    );
}