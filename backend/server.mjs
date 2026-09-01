import "dotenv/config";

import express from "express";
import cors from "cors";
import { v2 as cloudinary } from "cloudinary";

const app = express();

const PORT =
  Number(process.env.PORT) ||
  3000;

const SONG_FOLDER =
  (
    process.env.CLOUDINARY_SONG_FOLDER ||
    "audio-beat/songs"
  )
    .trim()
    .replace(/\/+$/, "");

cloudinary.config({
  cloud_name:
    process.env.CLOUDINARY_CLOUD_NAME,

  api_key:
    process.env.CLOUDINARY_API_KEY,

  api_secret:
    process.env.CLOUDINARY_API_SECRET,

  secure: true,
});

app.use(
  cors({
    origin: true,
  })
);

app.use(express.json());

/*
 * ------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------
 */

function stringValue(
  value,
  fallback = ""
) {
  if (
    value === null ||
    value === undefined
  ) {
    return fallback;
  }

  const result =
    String(value).trim();

  return result || fallback;
}

function numericValue(
  value,
  fallback = 0
) {
  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function getContext(resource) {
  return (
    resource?.context?.custom ??
    resource?.context ??
    {}
  );
}

function getMetadata(resource) {
  return (
    resource?.metadata ??
    {}
  );
}

function metadataValue(
  resource,
  keys,
  fallback = ""
) {
  const context =
    getContext(resource);

  const metadata =
    getMetadata(resource);

  for (const key of keys) {
    const metadataItem =
      metadata[key];

    if (
      metadataItem !== undefined &&
      metadataItem !== null
    ) {
      if (
        typeof metadataItem ===
          "object" &&
        "value" in metadataItem
      ) {
        const result =
          stringValue(
            metadataItem.value
          );

        if (result) {
          return result;
        }
      }

      const result =
        stringValue(
          metadataItem
        );

      if (result) {
        return result;
      }
    }

    const contextValue =
      stringValue(
        context[key]
      );

    if (contextValue) {
      return contextValue;
    }
  }

  return fallback;
}

function fileNameFromResource(
  resource
) {
  const displayName =
    stringValue(
      resource.display_name
    );

  if (displayName) {
    return displayName;
  }

  const publicId =
    stringValue(
      resource.public_id
    );

  const fileName =
    publicId
      .split("/")
      .pop() ??
    publicId;

  return fileName
    .replace(
      /[-_]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function normalizeAlbumArt(
  resource
) {
  return metadataValue(
    resource,
    [
      "album_art",
      "albumArt",
      "cover",
      "cover_art",
      "artwork",
      "artwork_url",
    ],
    ""
  );
}

function normalizeVideoUrl(
  resource
) {
  return metadataValue(
    resource,
    [
      "video_url",
      "videoUrl",
      "video",
    ],
    ""
  );
}

/*
 * Convert one Cloudinary resource into the Song object
 * Audio Beat will use.
 */
function normalizeSong(
  resource
) {
  const title =
    metadataValue(
      resource,
      [
        "song_title",
        "title",
        "track_title",
      ],
      fileNameFromResource(
        resource
      ) ||
        "Unknown title"
    );

  const artist =
    metadataValue(
      resource,
      [
        "artist",
        "artist_name",
      ],
      "Unknown artist"
    );

  const album =
    metadataValue(
      resource,
      [
        "album",
        "album_name",
      ],
      "Unknown album"
    );

  const albumArt =
    normalizeAlbumArt(
      resource
    );

  const videoUrl =
    normalizeVideoUrl(
      resource
    );

  const genre =
    metadataValue(
      resource,
      [
        "genre",
      ],
      ""
    );

  const year =
    metadataValue(
      resource,
      [
        "year",
        "release_year",
      ],
      ""
    );

  const trackNumber =
    metadataValue(
      resource,
      [
        "track_number",
        "track",
      ],
      ""
    );

  return {
    /*
     * asset_id is immutable, so it is a safer app ID
     * than public_id.
     */
    id:
      stringValue(
        resource.asset_id,
        resource.public_id
      ),

    publicId:
      stringValue(
        resource.public_id
      ),

    assetFolder:
      stringValue(
        resource.asset_folder
      ),

    displayName:
      stringValue(
        resource.display_name
      ),

    title,

    artist,

    album,

    albumArt:
      albumArt || null,

    videoUrl:
      videoUrl || null,

    /*
     * This is the HTTPS Cloudinary media URL
     * that Media3/ExoPlayer will stream.
     */
    uri:
      stringValue(
        resource.secure_url
      ),

    duration:
      numericValue(
        resource.duration,
        numericValue(
      metadataValue(
        resource,
        ["duration"],
        0
      )
    )
  ),

    genre:
      genre || null,

    year:
      year
        ? numericValue(
            year,
            null
          )
        : null,

    trackNumber:
      trackNumber
        ? numericValue(
            trackNumber,
            null
          )
        : null,

    format:
      stringValue(
        resource.format,
        "mp3"
      ),

    bytes:
      numericValue(
        resource.bytes
      ),

    createdAt:
      resource.created_at ??
      null,
  };
}

/*
 * ------------------------------------------------------------
 * Cloudinary catalogue
 * ------------------------------------------------------------
 */

function isSupportedAudio(
  resource
) {
  const format =
    stringValue(
      resource.format
    ).toLowerCase();

  return [
    "mp3",
    "m4a",
    "aac",
    "wav",
    "flac",
    "ogg",
  ].includes(format);
}

/*
 * Loads every supported audio file stored DIRECTLY inside:
 *
 * audio-beat/songs
 *
 * This intentionally uses asset_folder rather than public_id prefix.
 */
async function loadCloudinarySongs() {
  const resources = [];

  let nextCursor;

  do {
    const options = {
      max_results: 500,

      context: true,

      metadata: true,
    };

    if (nextCursor) {
      options.next_cursor =
        nextCursor;
    }

    const response =
      await cloudinary.api.resources_by_asset_folder(
        SONG_FOLDER,
        options
      );

    if (
      Array.isArray(
        response.resources
      )
    ) {
      resources.push(
        ...response.resources
      );
    }

    nextCursor =
      response.next_cursor;
  } while (nextCursor);

  return resources
    .filter(
      isSupportedAudio
    )
    .map(
      normalizeSong
    )
    .filter(
      (song) =>
        Boolean(song.uri)
    )
    .sort(
      (
        first,
        second
      ) =>
        first.title.localeCompare(
          second.title,
          undefined,
          {
            sensitivity:
              "base",
          }
        )
    );
}

/*
 * ------------------------------------------------------------
 * Catalogue cache
 * ------------------------------------------------------------
 *
 * The app can request songs frequently from several screens.
 * We don't want every request to consume Cloudinary Admin API calls.
 *
 * New uploads become visible after at most ~60 seconds.
 */

let catalogueCache = {
  songs: [],
  loadedAt: 0,
};

const CACHE_DURATION_MS =
  60 * 1000;

async function getSongCatalogue({
  forceRefresh = false,
} = {}) {
  const now =
    Date.now();

  const hasCache =
    catalogueCache.loadedAt >
    0;

  const cacheValid =
    hasCache &&
    now -
      catalogueCache.loadedAt <
      CACHE_DURATION_MS;

  if (
    cacheValid &&
    !forceRefresh
  ) {
    return catalogueCache.songs;
  }

  const songs =
    await loadCloudinarySongs();

  catalogueCache = {
    songs,
    loadedAt: now,
  };

  return songs;
}

/*
 * ------------------------------------------------------------
 * API routes
 * ------------------------------------------------------------
 */

/*
 * Main catalogue.
 *
 * Used later by:
 *
 * Home
 * Albums
 * Your Library -> Cloudinary
 */
app.get(
  "/api/songs",
  async (
    _req,
    res
  ) => {
    try {
      const songs =
        await getSongCatalogue();

      res.json({
        count:
          songs.length,

        folder:
          SONG_FOLDER,

        songs,
      });
    } catch (error) {
      console.error(
        "GET /api/songs:",
        error
      );

      res
        .status(500)
        .json({
          error:
            "Unable to load the Cloudinary music catalogue.",
        });
    }
  }
);

/*
 * Find one song.
 *
 * Supports either immutable asset_id or public_id.
 */
app.get(
  "/api/songs/:id",
  async (
    req,
    res
  ) => {
    try {
      const songs =
        await getSongCatalogue();

      const requestedId =
        decodeURIComponent(
          req.params.id
        );

      const song =
        songs.find(
          (item) =>
            item.id ===
              requestedId ||
            item.publicId ===
              requestedId
        );

      if (!song) {
        res
          .status(404)
          .json({
            error:
              "Song not found.",
          });

        return;
      }

      res.json(song);
    } catch (error) {
      console.error(
        "GET /api/songs/:id:",
        error
      );

      res
        .status(500)
        .json({
          error:
            "Unable to load the song.",
        });
    }
  }
);

/*
 * Search Cloudinary catalogue.
 *
 * Searches:
 * - title
 * - artist
 * - album
 * - genre
 *
 * Search happens against our cached catalogue rather than
 * calling Cloudinary's Admin API for every keystroke.
 */
app.get(
  "/api/search",
  async (
    req,
    res
  ) => {
    try {
      const query =
        stringValue(
          req.query.q
        )
          .toLocaleLowerCase();

      if (!query) {
        res.json({
          query: "",
          count: 0,
          songs: [],
        });

        return;
      }

      const songs =
        await getSongCatalogue();

      const matches =
        songs.filter(
          (song) => {
            const searchable =
              [
                song.title,
                song.artist,
                song.album,
                song.genre,
              ]
                .filter(
                  Boolean
                )
                .join(" ")
                .toLocaleLowerCase();

            return searchable.includes(
              query
            );
          }
        );

      res.json({
        query,

        count:
          matches.length,

        songs:
          matches,
      });
    } catch (error) {
      console.error(
        "GET /api/search:",
        error
      );

      res
        .status(500)
        .json({
          error:
            "Unable to search the music catalogue.",
        });
    }
  }
);

/*
 * Albums derived from the same Cloudinary catalogue.
 */
app.get(
  "/api/albums",
  async (
    _req,
    res
  ) => {
    try {
      const songs =
        await getSongCatalogue();

      const albumMap =
        new Map();

      for (
        const song
        of songs
      ) {
        const albumName =
          stringValue(
            song.album,
            "Unknown album"
          );

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
            song.duration;

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
              song.duration,

            songs: [
              song,
            ],
          }
        );
      }

      const albums =
        Array.from(
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

      res.json({
        count:
          albums.length,

        albums,
      });
    } catch (error) {
      console.error(
        "GET /api/albums:",
        error
      );

      res
        .status(500)
        .json({
          error:
            "Unable to load albums.",
        });
    }
  }
);

/*
 * Artist catalogue.
 *
 * This does not fetch remote artist photos yet.
 * That remains handled by your ArtistImageService for now.
 */
app.get(
  "/api/artists",
  async (
    _req,
    res
  ) => {
    try {
      const songs =
        await getSongCatalogue();

      const artistMap =
        new Map();

      for (
        const song
        of songs
      ) {
        const artistName =
          stringValue(
            song.artist
          );

        const artistId =
          artistName
            .toLocaleLowerCase();

        if (
          !artistName ||
          artistId ===
            "unknown artist" ||
          artistId ===
            "<unknown>" ||
          artistId ===
            "various artists"
        ) {
          continue;
        }

        const existing =
          artistMap.get(
            artistId
          );

        if (existing) {
          existing.songCount +=
            1;

          continue;
        }

        artistMap.set(
          artistId,
          {
            id:
              artistId,

            name:
              artistName,

            songCount:
              1,
          }
        );
      }

      const artists =
        Array.from(
          artistMap.values()
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

      res.json({
        count:
          artists.length,

        artists,
      });
    } catch (error) {
      console.error(
        "GET /api/artists:",
        error
      );

      res
        .status(500)
        .json({
          error:
            "Unable to load artists.",
        });
    }
  }
);

/*
 * Manual cache refresh.
 *
 * There is deliberately NO song upload endpoint.
 *
 * Uploads happen only through your Cloudinary management side.
 */
app.post(
  "/api/catalogue/refresh",
  async (
    _req,
    res
  ) => {
    try {
      const songs =
        await getSongCatalogue({
          forceRefresh: true,
        });

      res.json({
        refreshed: true,

        count:
          songs.length,

        folder:
          SONG_FOLDER,
      });
    } catch (error) {
      console.error(
        "POST /api/catalogue/refresh:",
        error
      );

      res
        .status(500)
        .json({
          error:
            "Unable to refresh the Cloudinary catalogue.",
        });
    }
  }
);

/*
 * ------------------------------------------------------------
 * 404
 * ------------------------------------------------------------
 */

app.use(
  (
    _req,
    res
  ) => {
    res
      .status(404)
      .json({
        error:
          "Endpoint not found.",
      });
  }
);

/*
 * ------------------------------------------------------------
 * Global error handler
 * ------------------------------------------------------------
 */

app.use(
  (
    error,
    _req,
    res,
    _next
  ) => {
    console.error(
      "Unhandled backend error:",
      error
    );

    res
      .status(500)
      .json({
        error:
          "Internal server error.",
      });
  }
);

/*
 * ------------------------------------------------------------
 * Start backend
 * ------------------------------------------------------------
 */

app.listen(
  PORT,
  () => {
    console.log(
      `Audio Beat backend listening on port ${PORT}`
    );

    console.log(
      `Cloudinary song folder: ${SONG_FOLDER}`
    );
  }
);