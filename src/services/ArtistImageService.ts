interface AudioDbArtist {
  strArtist?: string | null;
  strArtistThumb?: string | null;
  strArtistWideThumb?: string | null;
  strArtistFanart?: string | null;
  strArtistFanart2?: string | null;
  strArtistFanart3?: string | null;
}

interface AudioDbResponse {
  artists?: AudioDbArtist[] | null;
}

interface CachedArtistImage {
  image: string | null;
  expiresAt: number;
}

const CACHE_PREFIX =
  "music-player-artist-image:";

const SUCCESS_CACHE_MS =
  30 * 24 * 60 * 60 * 1000;

const MISSING_CACHE_MS =
  7 * 24 * 60 * 60 * 1000;

const REQUEST_SPACING_MS = 2100;

const inFlightRequests =
  new Map<string, Promise<string | null>>();

let nextRequestTime = 0;

function normaliseName(
  name: string
): string {
  return name.trim().replace(/\s+/g, " ");
}

function getCacheKey(
  name: string
): string {
  return `${CACHE_PREFIX}${encodeURIComponent(
    name.toLocaleLowerCase()
  )}`;
}

function readCache(
  name: string
): string | null | undefined {
  try {
    const raw =
      localStorage.getItem(
        getCacheKey(name)
      );

    if (!raw) return undefined;

    const cached =
      JSON.parse(raw) as CachedArtistImage;

    if (
      typeof cached.expiresAt !== "number" ||
      cached.expiresAt <= Date.now()
    ) {
      localStorage.removeItem(
        getCacheKey(name)
      );
      return undefined;
    }

    return typeof cached.image === "string"
      ? cached.image
      : null;
  } catch {
    return undefined;
  }
}

function writeCache(
  name: string,
  image: string | null
): void {
  try {
    localStorage.setItem(
      getCacheKey(name),
      JSON.stringify({
        image,
        expiresAt:
          Date.now() +
          (image
            ? SUCCESS_CACHE_MS
            : MISSING_CACHE_MS),
      } satisfies CachedArtistImage)
    );
  } catch {
    // Ignore unavailable/full localStorage.
  }
}

async function waitForSlot():
  Promise<void> {
  const now = Date.now();
  const wait =
    Math.max(0, nextRequestTime - now);

  nextRequestTime =
    Math.max(nextRequestTime, now) +
    REQUEST_SPACING_MS;

  if (wait > 0) {
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, wait);
    });
  }
}

function chooseImage(
  artist: AudioDbArtist
): string | null {
  return [
    artist.strArtistThumb,
    artist.strArtistWideThumb,
    artist.strArtistFanart,
    artist.strArtistFanart2,
    artist.strArtistFanart3,
  ].find(
    (value): value is string =>
      typeof value === "string" &&
      value.trim().length > 0
  ) ?? null;
}

async function fetchArtistImage(
  name: string
): Promise<string | null> {
  await waitForSlot();

  const response =
    await fetch(
      `https://www.theaudiodb.com/api/v1/json/123/search.php?s=${encodeURIComponent(
        name
      )}`
    );

  if (response.status === 429) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Artist request failed: ${response.status}`
    );
  }

  const data =
    await response.json() as AudioDbResponse;

  const artists =
    Array.isArray(data.artists)
      ? data.artists
      : [];

  const exact =
    artists.find((artist) =>
      artist.strArtist
        ?.trim()
        .localeCompare(
          name,
          undefined,
          { sensitivity: "base" }
        ) === 0
    );

  const image =
    exact
      ? chooseImage(exact)
      : artists[0]
        ? chooseImage(artists[0])
        : null;

  writeCache(name, image);
  return image;
}

export const ArtistImageService = {
  async getArtistImage(
    rawName: string
  ): Promise<string | null> {
    const name =
      normaliseName(rawName);

    const key =
      name.toLocaleLowerCase();

    if (
      !name ||
      key === "unknown artist" ||
      key === "<unknown>" ||
      key === "various artists"
    ) {
      return null;
    }

    const cached =
      readCache(name);

    if (cached !== undefined) {
      return cached;
    }

    const existing =
      inFlightRequests.get(key);

    if (existing) {
      return existing;
    }

    const request =
      fetchArtistImage(name)
        .catch((error) => {
          console.warn(
            `Unable to load artist image for "${name}":`,
            error
          );
          return null;
        })
        .finally(() => {
          inFlightRequests.delete(key);
        });

    inFlightRequests.set(key, request);
    return request;
  },
};
