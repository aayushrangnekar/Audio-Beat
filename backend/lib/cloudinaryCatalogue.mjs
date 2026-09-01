import {
  v2 as cloudinary,
} from "cloudinary";

cloudinary.config({
  cloud_name:
    process.env.CLOUDINARY_CLOUD_NAME,

  api_key:
    process.env.CLOUDINARY_API_KEY,

  api_secret:
    process.env.CLOUDINARY_API_SECRET,

  secure: true,
});

const SONG_FOLDER =
  (
    process.env.CLOUDINARY_SONG_FOLDER ||
    "audio-beat/songs"
  )
    .trim()
    .replace(/\/+$/, "");

const SUPPORTED_AUDIO_FORMATS =
  new Set([
    "mp3",
    "m4a",
    "aac",
    "wav",
    "flac",
    "ogg",
  ]);

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

function getContext(
  resource
) {
  return (
    resource?.context?.custom ??
    resource?.context ??
    {}
  );
}

function getMetadata(
  resource
) {
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

  return (
    publicId
      .split("/")
      .pop() ??
    publicId
  )
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
    metadataValue(
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

  const videoUrl =
    metadataValue(
      resource,
      [
        "video_url",
        "videoUrl",
        "video",
      ],
      ""
    );

  const genre =
    metadataValue(
      resource,
      ["genre"],
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

  const storedDuration =
    metadataValue(
      resource,
      ["duration"],
      ""
    );

  const duration =
    numericValue(
      resource.duration,
      numericValue(
        storedDuration,
        0
      )
    );

  return {
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

    uri:
      stringValue(
        resource.secure_url
      ),

    duration,

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

function isSupportedAudio(
  resource
) {
  return SUPPORTED_AUDIO_FORMATS.has(
    stringValue(
      resource.format
    ).toLowerCase()
  );
}

export async function loadCloudinarySongs() {
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
      await cloudinary.api
        .resources_by_asset_folder(
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

export function getSongFolder() {
  return SONG_FOLDER;
}
