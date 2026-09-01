export interface CloudSong {
  id: string;
  publicId: string;
  assetFolder: string;
  displayName: string;

  title: string;
  artist: string;
  album: string;

  albumArt: string | null;
  remoteAlbumArt?: string | null;
  videoUrl: string | null;
  uri: string;

  duration: number;

  genre: string | null;
  year: number | null;
  trackNumber: number | null;

  format: string;
  bytes: number;
  createdAt: string | null;
}

interface SongsResponse {
  count: number;
  folder: string;
  songs: CloudSong[];
}

interface SearchResponse {
  query: string;
  count: number;
  songs: CloudSong[];
}

interface AlbumsResponse {
  count: number;
  albums: CloudAlbum[];
}

export interface CloudAlbum {
  id: string;
  name: string;
  albumArt: string | null;
  songCount: number;
  duration: number;
  songs: CloudSong[];
}

/*
 * ------------------------------------------------------------
 * Production backend
 * ------------------------------------------------------------
 *
 * Netlify Functions API.
 *
 * Cloudinary credentials remain on the backend only.
 * The Android app receives catalogue metadata and secure
 * Cloudinary media URLs from this API.
 */

const API_BASE_URL =
  "https://audio-beat-api.netlify.app";

/*
 * ------------------------------------------------------------
 * Persistent offline catalogue + artwork cache
 * ------------------------------------------------------------
 *
 * Catalogue metadata is kept in localStorage.
 *
 * Album artwork bytes are kept in IndexedDB so large image
 * data is not stored inside localStorage.
 */

const CLOUD_CATALOGUE_STORAGE_KEY =
  "audio-beat-cloudinary-catalogue";

const ARTWORK_DB_NAME =
  "audio-beat-cloudinary-cache";

const ARTWORK_DB_VERSION =
  1;

const ARTWORK_STORE_NAME =
  "artwork";

const artworkObjectUrls =
  new Map<string, string>();

function getCachedCatalogue():
  CloudSong[] {
  try {
    const raw =
      window.localStorage.getItem(
        CLOUD_CATALOGUE_STORAGE_KEY
      );

    if (!raw) {
      return [];
    }

    const parsed: unknown =
      JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (
        song
      ): song is CloudSong =>
        typeof song ===
          "object" &&
        song !== null &&
        "id" in song &&
        typeof song.id ===
          "string" &&
        "uri" in song &&
        typeof song.uri ===
          "string"
    );
  } catch (error) {
    console.warn(
      "Unable to read cached Cloudinary catalogue:",
      error
    );

    return [];
  }
}

function saveCatalogue(
  songs: CloudSong[]
): void {
  try {
    const persistableSongs =
      songs.map(
        (
          song:
            CloudSong
        ): CloudSong => ({
          ...song,

          /*
           * Object URLs are valid only for the current
           * WebView session. Persist the original Cloudinary
           * artwork URL instead.
           */
          albumArt:
            song.remoteAlbumArt ??
            song.albumArt,

          remoteAlbumArt:
            undefined,
        })
      );

    window.localStorage.setItem(
      CLOUD_CATALOGUE_STORAGE_KEY,
      JSON.stringify(
        persistableSongs
      )
    );
  } catch (error) {
    console.warn(
      "Unable to save Cloudinary catalogue cache:",
      error
    );
  }
}

function openArtworkDatabase():
  Promise<IDBDatabase | null> {
  return new Promise(
    (resolve) => {
      if (
        typeof indexedDB ===
        "undefined"
      ) {
        resolve(null);
        return;
      }

      const request =
        indexedDB.open(
          ARTWORK_DB_NAME,
          ARTWORK_DB_VERSION
        );

      request.onupgradeneeded =
        () => {
          const database =
            request.result;

          if (
            !database.objectStoreNames.contains(
              ARTWORK_STORE_NAME
            )
          ) {
            database.createObjectStore(
              ARTWORK_STORE_NAME
            );
          }
        };

      request.onsuccess =
        () => {
          resolve(
            request.result
          );
        };

      request.onerror =
        () => {
          console.warn(
            "Unable to open artwork cache:",
            request.error
          );

          resolve(null);
        };
    }
  );
}

async function getCachedArtwork(
  url: string
): Promise<Blob | null> {
  const database =
    await openArtworkDatabase();

  if (!database) {
    return null;
  }

  return new Promise(
    (resolve) => {
      const transaction =
        database.transaction(
          ARTWORK_STORE_NAME,
          "readonly"
        );

      const request =
        transaction
          .objectStore(
            ARTWORK_STORE_NAME
          )
          .get(
            url
          );

      request.onsuccess =
        () => {
          resolve(
            request.result instanceof
              Blob
              ? request.result
              : null
          );
        };

      request.onerror =
        () => {
          resolve(null);
        };

      transaction.oncomplete =
        () => {
          database.close();
        };

      transaction.onerror =
        () => {
          database.close();
        };

      transaction.onabort =
        () => {
          database.close();
        };
    }
  );
}

async function saveArtwork(
  url: string,
  blob: Blob
): Promise<void> {
  const database =
    await openArtworkDatabase();

  if (!database) {
    return;
  }

  await new Promise<void>(
    (resolve) => {
      const transaction =
        database.transaction(
          ARTWORK_STORE_NAME,
          "readwrite"
        );

      transaction
        .objectStore(
          ARTWORK_STORE_NAME
        )
        .put(
          blob,
          url
        );

      transaction.oncomplete =
        () => {
          database.close();
          resolve();
        };

      transaction.onerror =
        () => {
          console.warn(
            "Unable to save cached album artwork:",
            transaction.error
          );

          database.close();
          resolve();
        };

      transaction.onabort =
        () => {
          database.close();
          resolve();
        };
    }
  );
}

function createArtworkObjectUrl(
  remoteUrl: string,
  blob: Blob
): string {
  const existing =
    artworkObjectUrls.get(
      remoteUrl
    );

  if (existing) {
    return existing;
  }

  const objectUrl =
    URL.createObjectURL(
      blob
    );

  artworkObjectUrls.set(
    remoteUrl,
    objectUrl
  );

  return objectUrl;
}

async function resolveAlbumArt(
  albumArt: string | null
): Promise<string | null> {
  const remoteUrl =
    albumArt?.trim();

  if (!remoteUrl) {
    return null;
  }

  const existingObjectUrl =
    artworkObjectUrls.get(
      remoteUrl
    );

  if (existingObjectUrl) {
    return existingObjectUrl;
  }

  const cachedArtwork =
    await getCachedArtwork(
      remoteUrl
    );

  if (cachedArtwork) {
    return createArtworkObjectUrl(
      remoteUrl,
      cachedArtwork
    );
  }

  try {
    const response =
      await fetch(
        remoteUrl,
        {
          cache:
            "force-cache",
        }
      );

    if (!response.ok) {
      return remoteUrl;
    }

    const blob =
      await response.blob();

    await saveArtwork(
      remoteUrl,
      blob
    );

    return createArtworkObjectUrl(
      remoteUrl,
      blob
    );
  } catch {
    /*
     * If the app is offline and this artwork has never been
     * cached, retain the original URL. Existing UI fallback
     * behaviour can continue unchanged.
     */
    return remoteUrl;
  }
}

async function hydrateSong(
  song: CloudSong
): Promise<CloudSong> {
  const remoteAlbumArt =
    song.remoteAlbumArt ??
    song.albumArt;

  return {
    ...song,

    remoteAlbumArt,

    albumArt:
      await resolveAlbumArt(
        remoteAlbumArt
      ),
  };
}

async function hydrateSongs(
  songs: CloudSong[]
): Promise<CloudSong[]> {
  return Promise.all(
    songs.map(
      hydrateSong
    )
  );
}

function searchCatalogue(
  songs: CloudSong[],
  query: string
): CloudSong[] {
  const cleanedQuery =
    query
      .trim()
      .toLocaleLowerCase();

  if (!cleanedQuery) {
    return [];
  }

  return songs.filter(
    (
      song:
        CloudSong
    ) => {
      const searchable =
        [
          song.title,
          song.artist,
          song.album,
          song.genre,
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase();

      return searchable.includes(
        cleanedQuery
      );
    }
  );
}

function buildAlbums(
  songs: CloudSong[]
): CloudAlbum[] {
  const albumMap =
    new Map<
      string,
      CloudAlbum
    >();

  for (
    const song of songs
  ) {
    const albumName =
      song.album?.trim() ||
      "Unknown album";

    const albumId =
      albumName
        .toLocaleLowerCase();

    const existing =
      albumMap.get(
        albumId
      );

    if (existing) {
      existing.songs.push(
        song
      );

      existing.songCount =
        existing.songs.length;

      existing.duration +=
        Number.isFinite(
          song.duration
        )
          ? song.duration
          : 0;

      if (
        !existing.albumArt &&
        song.albumArt
      ) {
        existing.albumArt =
          song.albumArt;
      }

      continue;
    }

    albumMap.set(
      albumId,
      {
        id:
          albumId,

        name:
          albumName,

        albumArt:
          song.albumArt,

        songCount:
          1,

        duration:
          Number.isFinite(
            song.duration
          )
            ? song.duration
            : 0,

        songs: [
          song,
        ],
      }
    );
  }

  return Array.from(
    albumMap.values()
  ).sort(
    (
      first,
      second
    ) =>
      first.name.localeCompare(
        second.name,
        undefined,
        {
          sensitivity:
            "base",
        }
      )
  );
}

class CloudMusicService {
  /*
   * ----------------------------------------------------------
   * Get complete Cloudinary catalogue
   * ----------------------------------------------------------
   */

  async getSongs(): Promise<CloudSong[]> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/songs`
      );

      if (!response.ok) {
        throw new Error(
          `Unable to load cloud songs: ${response.status}`
        );
      }

      const data =
        (await response.json()) as SongsResponse;

      const songs =
        Array.isArray(data.songs)
          ? data.songs
          : [];

      saveCatalogue(
        songs
      );

      return hydrateSongs(
        songs
      );
    } catch (error) {
      const cachedSongs =
        getCachedCatalogue();

      if (
        cachedSongs.length >
        0
      ) {
        console.warn(
          "Cloudinary catalogue unavailable. Using cached catalogue.",
          error
        );

        return hydrateSongs(
          cachedSongs
        );
      }

      throw error;
    }
  }

  /*
   * ----------------------------------------------------------
   * Backend search
   * ----------------------------------------------------------
   */

  async searchSongs(
    query: string
  ): Promise<CloudSong[]> {
    const cleanedQuery =
      query.trim();

    if (!cleanedQuery) {
      return [];
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/search?q=${encodeURIComponent(
          cleanedQuery
        )}`
      );

      if (!response.ok) {
        throw new Error(
          `Unable to search cloud songs: ${response.status}`
        );
      }

      const data =
        (await response.json()) as SearchResponse;

      return hydrateSongs(
        Array.isArray(
          data.songs
        )
          ? data.songs
          : []
      );
    } catch (error) {
      const cachedSongs =
        getCachedCatalogue();

      if (
        cachedSongs.length >
        0
      ) {
        console.warn(
          "Cloudinary search unavailable. Searching cached catalogue.",
          error
        );

        return hydrateSongs(
          searchCatalogue(
            cachedSongs,
            cleanedQuery
          )
        );
      }

      throw error;
    }
  }

  /*
   * ----------------------------------------------------------
   * Albums
   * ----------------------------------------------------------
   */

  async getAlbums(): Promise<CloudAlbum[]> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/albums`
      );

      if (!response.ok) {
        throw new Error(
          `Unable to load cloud albums: ${response.status}`
        );
      }

      const data =
        (await response.json()) as AlbumsResponse;

      const albums =
        Array.isArray(data.albums)
          ? data.albums
          : [];

      return Promise.all(
        albums.map(
          async (
            album:
              CloudAlbum
          ): Promise<CloudAlbum> => {
            const songs =
              await hydrateSongs(
                Array.isArray(
                  album.songs
                )
                  ? album.songs
                  : []
              );

            const remoteAlbumArt =
              album.albumArt ??
              songs.find(
                (
                  song:
                    CloudSong
                ) =>
                  Boolean(
                    song.remoteAlbumArt ??
                    song.albumArt
                  )
              )?.remoteAlbumArt ??
              null;

            return {
              ...album,

              albumArt:
                await resolveAlbumArt(
                  remoteAlbumArt
                ),

              songs,
            };
          }
        )
      );
    } catch (error) {
      const cachedSongs =
        getCachedCatalogue();

      if (
        cachedSongs.length >
        0
      ) {
        console.warn(
          "Cloudinary albums unavailable. Building albums from cached catalogue.",
          error
        );

        return buildAlbums(
          await hydrateSongs(
            cachedSongs
          )
        );
      }

      throw error;
    }
  }

  /*
   * ----------------------------------------------------------
   * Health/test helper
   * ----------------------------------------------------------
   */

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/songs`
      );

      return response.ok;
    } catch {
      return false;
    }
  }
}

export const cloudMusicService =
  new CloudMusicService();

export default cloudMusicService;