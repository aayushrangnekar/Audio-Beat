import type {
  LyricLine,
  Song,
} from "../types";

import {
  parseLrc,
} from "./LrcParser";

interface LrclibLyricsRecord {
  id: number;

  trackName:
    string;

  artistName:
    string;

  albumName:
    string;

  duration:
    number;

  instrumental:
    boolean;

  plainLyrics:
    string | null;

  syncedLyrics:
    string | null;
}

export type LyricsFetchStatus =
  | "loaded"
  | "not-found"
  | "instrumental"
  | "error";

export interface LyricsFetchResult {
  status:
    LyricsFetchStatus;

  lyrics:
    LyricLine[];

  plainLyrics:
    string | null;

  sourceId:
    number | null;

  message:
    string | null;
}

interface CachedLyricsEntry {
  version: 1;

  status:
    Exclude<
      LyricsFetchStatus,
      "error"
    >;

  lyrics:
    LyricLine[];

  plainLyrics:
    string | null;

  sourceId:
    number | null;

  savedAt:
    number;
}

const LRCLIB_BASE_URL =
  "https://lrclib.net/api";

const LRCLIB_CLIENT =
  "Beat Music Player v1.0";

const CACHE_PREFIX =
  "beat-lrclib-lyrics:";

const REQUEST_TIMEOUT_MS =
  15_000;

/*
 * Cache successful matches and
 * not-found results for seven days.
 */
const CACHE_MAX_AGE_MS =
  7 *
  24 *
  60 *
  60 *
  1000;

function cleanMetadata(
  value:
    string | undefined
): string {
  if (
    typeof value !== "string"
  ) {
    return "";
  }

  return value
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function isUnknownValue(
  value: string
): boolean {
  const normalised =
    value
      .trim()
      .toLowerCase();

  return (
    normalised === "" ||
    normalised ===
      "unknown" ||
    normalised ===
      "unknown artist" ||
    normalised ===
      "unknown album" ||
    normalised ===
      "<unknown>"
  );
}

function createCacheKey(
  song: Song,
  duration:
    number
): string {
  const title =
    cleanMetadata(
      song.title
    ).toLowerCase();

  const artist =
    cleanMetadata(
      song.artist
    ).toLowerCase();

  const album =
    cleanMetadata(
      song.album
    ).toLowerCase();

  return [
    CACHE_PREFIX,
    encodeURIComponent(
      title
    ),
    encodeURIComponent(
      artist
    ),
    encodeURIComponent(
      album
    ),
    Math.round(
      duration
    ).toString(),
  ].join(":");
}

function readCachedLyrics(
  cacheKey: string
): LyricsFetchResult | null {
  try {
    const savedValue =
      window.localStorage.getItem(
        cacheKey
      );

    if (!savedValue) {
      return null;
    }

    const parsedValue:
      unknown =
        JSON.parse(
          savedValue
        );

    if (
      typeof parsedValue !==
        "object" ||
      parsedValue ===
        null
    ) {
      return null;
    }

    const entry =
      parsedValue as
        Partial<
          CachedLyricsEntry
        >;

    if (
      entry.version !== 1 ||
      typeof entry.savedAt !==
        "number" ||
      Date.now() -
        entry.savedAt >
        CACHE_MAX_AGE_MS ||
      !Array.isArray(
        entry.lyrics
      ) ||
      (
        entry.status !==
          "loaded" &&
        entry.status !==
          "not-found" &&
        entry.status !==
          "instrumental"
      )
    ) {
      window.localStorage.removeItem(
        cacheKey
      );

      return null;
    }

    return {
      status:
        entry.status,

      lyrics:
        entry.lyrics.filter(
          (
            line
          ): line is
            LyricLine =>
            typeof line ===
              "object" &&
            line !==
              null &&
            "time" in
              line &&
            typeof line.time ===
              "number" &&
            Number.isFinite(
              line.time
            ) &&
            "text" in
              line &&
            typeof line.text ===
              "string"
        ),

      plainLyrics:
        typeof entry.plainLyrics ===
          "string"
          ? entry.plainLyrics
          : null,

      sourceId:
        typeof entry.sourceId ===
          "number"
          ? entry.sourceId
          : null,

      message:
        null,
    };
  } catch (error) {
    console.warn(
      "Unable to read cached lyrics:",
      error
    );

    return null;
  }
}

function saveCachedLyrics(
  cacheKey: string,
  result:
    LyricsFetchResult
): void {
  if (
    result.status ===
      "error"
  ) {
    return;
  }

  const entry:
    CachedLyricsEntry = {
      version: 1,

      status:
        result.status,

      lyrics:
        result.lyrics,

      plainLyrics:
        result.plainLyrics,

      sourceId:
        result.sourceId,

      savedAt:
        Date.now(),
  };

  try {
    window.localStorage.setItem(
      cacheKey,
      JSON.stringify(
        entry
      )
    );
  } catch (error) {
    console.warn(
      "Unable to cache lyrics:",
      error
    );
  }
}

async function requestExactLyrics(
  song: Song,
  duration:
    number,
  signal:
    AbortSignal
): Promise<
  LrclibLyricsRecord | null
> {
  const title =
    cleanMetadata(
      song.title
    );

  const artist =
    cleanMetadata(
      song.artist
    );

  const album =
    cleanMetadata(
      song.album
    );

  if (
    !title ||
    isUnknownValue(
      title
    ) ||
    !artist ||
    isUnknownValue(
      artist
    ) ||
    !album ||
    isUnknownValue(
      album
    )
  ) {
    return null;
  }

  const params =
    new URLSearchParams({
      track_name:
        title,

      artist_name:
        artist,

      album_name:
        album,

      duration:
        Math.round(
          duration
        ).toString(),
    });

  const response =
    await fetch(
      `${LRCLIB_BASE_URL}/get?${params.toString()}`,
      {
        method:
          "GET",

        headers: {
          Accept:
            "application/json",

          "Lrclib-Client":
            LRCLIB_CLIENT,
        },

        signal,
      }
    );

  if (
    response.status === 404
  ) {
    return null;
  }

  if (
    response.status === 429
  ) {
    const retryAfter =
      response.headers.get(
        "Retry-After"
      );

    throw new Error(
      retryAfter
        ? `LRCLIB rate limit reached. Retry after ${retryAfter} seconds.`
        : "LRCLIB rate limit reached."
    );
  }

  if (!response.ok) {
    throw new Error(
      `LRCLIB request failed with HTTP ${response.status}.`
    );
  }

  return await response.json() as
    LrclibLyricsRecord;
}

async function requestSearchFallback(
  song: Song,
  duration:
    number,
  signal:
    AbortSignal
): Promise<
  LrclibLyricsRecord | null
> {
  const title =
    cleanMetadata(
      song.title
    );

  const artist =
    cleanMetadata(
      song.artist
    );

  if (
    !title ||
    isUnknownValue(
      title
    )
  ) {
    return null;
  }

  const params =
    new URLSearchParams({
      track_name:
        title,
  });

  if (
    artist &&
    !isUnknownValue(
      artist
    )
  ) {
    params.set(
      "artist_name",
      artist
    );
  }

  const response =
    await fetch(
      `${LRCLIB_BASE_URL}/search?${params.toString()}`,
      {
        method:
          "GET",

        headers: {
          Accept:
            "application/json",

          "Lrclib-Client":
            LRCLIB_CLIENT,
        },

        signal,
      }
    );

  if (
    response.status === 429
  ) {
    const retryAfter =
      response.headers.get(
        "Retry-After"
      );

    throw new Error(
      retryAfter
        ? `LRCLIB rate limit reached. Retry after ${retryAfter} seconds.`
        : "LRCLIB rate limit reached."
    );
  }

  if (!response.ok) {
    throw new Error(
      `LRCLIB search failed with HTTP ${response.status}.`
    );
  }

  const records =
    await response.json() as
      LrclibLyricsRecord[];

  if (
    !Array.isArray(
      records
    ) ||
    records.length === 0
  ) {
    return null;
  }

  const normalisedTitle =
    title.toLowerCase();

  const normalisedArtist =
    artist.toLowerCase();

  const candidates =
    records
      .filter(
        (
          record:
            LrclibLyricsRecord
        ) =>
          Boolean(
            record.syncedLyrics
          ) ||
          record.instrumental
      )
      .map(
        (
          record:
            LrclibLyricsRecord
        ) => {
          const titleMatches =
            record.trackName
              .trim()
              .toLowerCase() ===
            normalisedTitle;

          const artistMatches =
            !normalisedArtist ||
            record.artistName
              .trim()
              .toLowerCase()
              .includes(
                normalisedArtist
              ) ||
            normalisedArtist.includes(
              record.artistName
                .trim()
                .toLowerCase()
            );

          const durationDifference =
            Math.abs(
              record.duration -
                duration
            );

          let score = 0;

          if (
            titleMatches
          ) {
            score += 100;
          }

          if (
            artistMatches
          ) {
            score += 50;
          }

          if (
            durationDifference <=
              2
          ) {
            score += 40;
          } else if (
            durationDifference <=
              5
          ) {
            score += 20;
          } else if (
            durationDifference <=
              10
          ) {
            score += 5;
          }

          if (
            record.syncedLyrics
          ) {
            score += 10;
          }

          return {
            record,
            score,
            durationDifference,
          };
        }
      )
      .filter(
        (
          candidate
        ) =>
          candidate.score >=
          100 &&
          candidate.durationDifference <=
          10
      )
      .sort(
        (
          firstCandidate,
          secondCandidate
        ) =>
          secondCandidate.score -
            firstCandidate.score ||
          firstCandidate.durationDifference -
            secondCandidate.durationDifference
      );

  return (
    candidates[0]
      ?.record ??
    null
  );
}

function convertRecordToResult(
  record:
    LrclibLyricsRecord | null
): LyricsFetchResult {
  if (!record) {
    return {
      status:
        "not-found",

      lyrics: [],

      plainLyrics:
        null,

      sourceId:
        null,

      message:
        "No lyrics were found for this song.",
    };
  }

  if (
    record.instrumental
  ) {
    return {
      status:
        "instrumental",

      lyrics: [],

      plainLyrics:
        null,

      sourceId:
        record.id,

      message:
        "This track is marked as instrumental.",
    };
  }

  const parsedLyrics =
    parseLrc(
      record.syncedLyrics ??
        ""
    );

  if (
    parsedLyrics.length ===
    0
  ) {
    return {
      status:
        "not-found",

      lyrics: [],

      plainLyrics:
        record.plainLyrics,

      sourceId:
        record.id,

      message:
        record.plainLyrics
          ? "Only unsynchronised lyrics are available."
          : "No synced lyrics were found for this song.",
    };
  }

  return {
    status:
      "loaded",

    lyrics:
      parsedLyrics,

    plainLyrics:
      record.plainLyrics,

    sourceId:
      record.id,

    message:
      null,
  };
}

export const LyricsService = {
  async getSyncedLyrics(
    song: Song,
    knownDuration?:
      number
  ): Promise<
    LyricsFetchResult
  > {
    const duration =
      Number.isFinite(
        knownDuration
      ) &&
      (
        knownDuration ??
        0
      ) > 0
        ? knownDuration as number
        : song.duration;

    if (
      !Number.isFinite(
        duration
      ) ||
      duration <= 0
    ) {
      return {
        status:
          "error",

        lyrics: [],

        plainLyrics:
          null,

        sourceId:
          null,

        message:
          "The song duration is required to find synced lyrics.",
      };
    }

    const cacheKey =
      createCacheKey(
        song,
        duration
      );

    const cachedResult =
      readCachedLyrics(
        cacheKey
      );

    if (
      cachedResult
    ) {
      return cachedResult;
    }

    const controller =
      new AbortController();

    const timeoutId =
      window.setTimeout(
        () => {
          controller.abort();
        },
        REQUEST_TIMEOUT_MS
      );

    try {
      let record =
        await requestExactLyrics(
          song,
          duration,
          controller.signal
        );

      /*
       * Exact matching requires album
       * metadata. Search is used only as
       * a controlled fallback.
       */
      if (!record) {
        record =
          await requestSearchFallback(
            song,
            duration,
            controller.signal
          );
      }

      const result =
        convertRecordToResult(
          record
        );

      saveCachedLyrics(
        cacheKey,
        result
      );

      return result;
    } catch (error) {
      if (
        error instanceof
          DOMException &&
        error.name ===
          "AbortError"
      ) {
        return {
          status:
            "error",

          lyrics: [],

          plainLyrics:
            null,

          sourceId:
            null,

          message:
            "The lyrics request timed out.",
        };
      }

      console.error(
        "Unable to fetch lyrics from LRCLIB:",
        error
      );

      return {
        status:
          "error",

        lyrics: [],

        plainLyrics:
          null,

        sourceId:
          null,

        message:
          error instanceof
            Error
            ? error.message
            : "Unable to fetch lyrics.",
      };
    } finally {
      window.clearTimeout(
        timeoutId
      );
    }
  },
};