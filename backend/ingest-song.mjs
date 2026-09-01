import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import {
  createInterface,
} from "node:readline/promises";
import {
  stdin as input,
  stdout as output,
} from "node:process";

import {
  parseFile,
  selectCover,
} from "music-metadata";

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

const ARTWORK_FOLDER =
  "audio-beat/artwork";

const VIDEO_FOLDER =
  "audio-beat/videos";

/*
 * ------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------
 */

function clean(
  value
) {
  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  return String(
    value
  ).trim();
}

function cleanInputPath(
  value
) {
  const cleaned =
    clean(value);

  if (
    cleaned.length >= 2 &&
    (
      (
        cleaned.startsWith('"') &&
        cleaned.endsWith('"')
      ) ||
      (
        cleaned.startsWith("'") &&
        cleaned.endsWith("'")
      )
    )
  ) {
    return cleaned.slice(
      1,
      -1
    );
  }

  return cleaned;
}

function isCloudinaryVideoUrl(
  value
) {
  const cleaned =
    clean(value);

  return (
    cleaned.startsWith(
      "https://res.cloudinary.com/"
    ) &&
    cleaned.includes(
      "/video/upload/"
    )
  );
}

function isCloudinaryImageUrl(
  value
) {
  const cleaned =
    clean(value);

  return (
    cleaned.startsWith(
      "https://res.cloudinary.com/"
    ) &&
    cleaned.includes(
      "/image/upload/"
    )
  );
}

function sanitizeContextValue(
  value
) {
  return clean(
    value
  )
    .replace(
      /\|/g,
      " "
    )
    .replace(
      /=/g,
      "-"
    );
}

function fileBaseName(
  filePath
) {
  return path
    .basename(
      filePath,
      path.extname(
        filePath
      )
    )
    .trim();
}

function safeCloudinaryName(
  value
) {
  return clean(
    value
  )
    .replace(
      /[^a-zA-Z0-9-_ ]/g,
      ""
    )
    .trim()
    .replace(
      /\s+/g,
      "_"
    );
}

/*
 * ------------------------------------------------------------
 * Album artwork upload
 * ------------------------------------------------------------
 */

async function uploadCover(
  cover,
  songName
) {
  if (!cover) {
    return null;
  }

  /*
   * music-metadata can return Uint8Array data.
   *
   * Calling:
   *
   * cover.data.toString("base64")
   *
   * may produce:
   *
   * 255,216,255,224,...
   *
   * instead of actual Base64.
   *
   * Convert to a Node Buffer first.
   */
  const base64 =
    Buffer.from(
      cover.data
    ).toString(
      "base64"
    );

  const mimeType =
    clean(
      cover.format
    ) ||
    "image/jpeg";

  const dataUri =
    `data:${mimeType};base64,${base64}`;

  const safeName =
    safeCloudinaryName(
      songName
    ) ||
    `cover_${Date.now()}`;

  console.log(
    "Uploading embedded album artwork..."
  );

  const result =
    await cloudinary.uploader.upload(
      dataUri,
      {
        resource_type:
          "image",

        asset_folder:
          ARTWORK_FOLDER,

        public_id:
          `${safeName}_cover`,

        overwrite:
          true,

        unique_filename:
          false,

        use_filename:
          false,
      }
    );

  console.log(
    "Artwork uploaded successfully."
  );

  return result.secure_url;
}

/*
 * ------------------------------------------------------------
 * Optional song video upload
 * ------------------------------------------------------------
 */

async function uploadVideo(
  videoPath,
  songName
) {
  if (!videoPath) {
    return null;
  }

  if (
    !fs.existsSync(
      videoPath
    )
  ) {
    throw new Error(
      `Video file not found: ${videoPath}`
    );
  }

  const extension =
    path
      .extname(
        videoPath
      )
      .toLowerCase();

  const supportedExtensions =
    [
      ".mp4",
      ".mov",
      ".m4v",
      ".webm",
      ".mkv",
    ];

  if (
    !supportedExtensions.includes(
      extension
    )
  ) {
    throw new Error(
      `Unsupported video format: ${extension}`
    );
  }

  const safeName =
    safeCloudinaryName(
      songName
    ) ||
    `video_${Date.now()}`;

  console.log(
    "\nUploading song video to Cloudinary..."
  );

  const result =
    await cloudinary.uploader.upload(
      videoPath,
      {
        resource_type:
          "video",

        asset_folder:
          VIDEO_FOLDER,

        display_name:
          `${songName} video`,

        public_id:
          `${safeName}_video`,

        overwrite:
          false,

        unique_filename:
          false,

        use_filename:
          false,
      }
    );

  console.log(
    "Video uploaded successfully."
  );

  return result.secure_url;
}

/*
 * ------------------------------------------------------------
 * Main song ingestion
 * ------------------------------------------------------------
 */

async function uploadSong(
  filePath,
  videoPath = "",
  existingVideoUrl = ""
) {
  /*
   * Validate local file
   */
  if (
    !fs.existsSync(
      filePath
    )
  ) {
    throw new Error(
      `File not found: ${filePath}`
    );
  }

  const extension =
    path
      .extname(
        filePath
      )
      .toLowerCase();

  const supportedExtensions =
    [
      ".mp3",
      ".m4a",
      ".aac",
      ".wav",
      ".flac",
      ".ogg",
    ];

  if (
    !supportedExtensions.includes(
      extension
    )
  ) {
    throw new Error(
      `Unsupported audio format: ${extension}`
    );
  }

  console.log(
    "\n----------------------------------------"
  );

  console.log(
    "Audio Beat ingestion"
  );

  console.log(
    "----------------------------------------"
  );

  console.log(
    `Reading metadata from:\n${filePath}\n`
  );

  /*
   * Read ID3 / audio metadata
   */
  const metadata =
    await parseFile(
      filePath,
      {
        duration: true,
      }
    );

  const common =
    metadata.common ??
    {};

  const format =
    metadata.format ??
    {};

  /*
   * ----------------------------------------------------------
   * Metadata
   * ----------------------------------------------------------
   */

  const fallbackTitle =
    fileBaseName(
      filePath
    );

  const title =
    clean(
      common.title
    ) ||
    fallbackTitle ||
    "Unknown title";

  const artist =
    clean(
      common.artist
    ) ||
    clean(
      common.albumartist
    ) ||
    "Unknown artist";

  const album =
    clean(
      common.album
    ) ||
    "Unknown album";

  const genre =
    Array.isArray(
      common.genre
    )
      ? clean(
          common.genre[0]
        )
      : "";

  const year =
    common.year ??
    null;

  const trackNumber =
    common.track?.no ??
    null;

  const trackTotal =
    common.track?.of ??
    null;

  const discNumber =
    common.disk?.no ??
    null;

  const discTotal =
    common.disk?.of ??
    null;

  const duration =
    Number(
      format.duration ??
      0
    );

  /*
   * ----------------------------------------------------------
   * Print clean metadata summary
   *
   * Do NOT print:
   *
   * metadata
   * common
   * common.picture
   * cover
   *
   * because embedded artwork contains huge binary data.
   * ----------------------------------------------------------
   */

  console.log(
    "Metadata extracted:"
  );

  console.log(
    `Title       : ${title}`
  );

  console.log(
    `Artist      : ${artist}`
  );

  console.log(
    `Album       : ${album}`
  );

  console.log(
    `Genre       : ${genre || "Not available"}`
  );

  console.log(
    `Year        : ${year ?? "Not available"}`
  );

  console.log(
    `Track       : ${
      trackNumber ??
      "Not available"
    }${
      trackTotal
        ? ` / ${trackTotal}`
        : ""
    }`
  );

  console.log(
    `Disc        : ${
      discNumber ??
      "Not available"
    }${
      discTotal
        ? ` / ${discTotal}`
        : ""
    }`
  );

  console.log(
    `Duration    : ${
      duration > 0
        ? `${duration.toFixed(
            2
          )} sec`
        : "Not available"
    }`
  );

  /*
   * ----------------------------------------------------------
   * Embedded album artwork
   * ----------------------------------------------------------
   */

  const cover =
    selectCover(
      common.picture
    );

  let albumArt =
    null;

  if (cover) {
    console.log(
      "\nEmbedded album artwork found."
    );

    console.log(
      `Artwork type: ${
        clean(
          cover.format
        ) ||
        "Unknown"
      }`
    );

    console.log(
      "\nAlbum art option:"
    );

    console.log(
      "1. Upload embedded MP3 artwork"
    );

    console.log(
      "2. Reuse existing Cloudinary image URL"
    );

    console.log(
      "3. No album art"
    );

    const albumArtChoice =
      clean(
        await cli.question(
          "Choose 1, 2 or 3: "
        )
      );

    if (albumArtChoice === "1") {
      albumArt =
        await uploadCover(
          cover,
          `${artist}-${album}`
        );

      console.log(
        `Artwork URL:\n${albumArt}`
      );
    } else if (albumArtChoice === "2") {
      const existingAlbumArtUrl =
        clean(
          await cli.question(
            "Enter existing Cloudinary image URL: "
          )
        );

      if (!existingAlbumArtUrl) {
        throw new Error(
          "No existing album art URL supplied."
        );
      }

      if (
        !isCloudinaryImageUrl(
          existingAlbumArtUrl
        )
      ) {
        throw new Error(
          "Existing album art URL must be a secure Cloudinary image delivery URL."
        );
      }

      albumArt =
        existingAlbumArtUrl;

      console.log(
        "\nReusing existing Cloudinary album art."
      );

      console.log(
        `Artwork URL:\n${albumArt}`
      );
    } else if (albumArtChoice === "3") {
      console.log(
        "\nNo album art selected."
      );
    } else {
      throw new Error(
        "Invalid album art option. Choose 1, 2 or 3."
      );
    }
  } else {
    console.log(
      "\nNo embedded album artwork found."
    );

    const existingAlbumArtUrl =
      clean(
        await cli.question(
          "Enter existing Cloudinary album art URL (leave blank for no album art): "
        )
      );

    if (existingAlbumArtUrl) {
      if (
        !isCloudinaryImageUrl(
          existingAlbumArtUrl
        )
      ) {
        throw new Error(
          "Existing album art URL must be a secure Cloudinary image delivery URL."
        );
      }

      albumArt =
        existingAlbumArtUrl;

      console.log(
        "\nReusing existing Cloudinary album art."
      );

      console.log(
        `Artwork URL:\n${albumArt}`
      );
    }
  }

  /*
   * ----------------------------------------------------------
   * Optional song video
   * ----------------------------------------------------------
   */

  let videoUrl =
    null;

  if (videoPath) {
    videoUrl =
      await uploadVideo(
        videoPath,
        title
      );

    console.log(
      `Video URL:\n${videoUrl}`
    );
  } else if (existingVideoUrl) {
    if (
      !isCloudinaryVideoUrl(
        existingVideoUrl
      )
    ) {
      throw new Error(
        "Existing video URL must be a secure Cloudinary video delivery URL."
      );
    }

    videoUrl =
      existingVideoUrl;

    console.log(
      "\nReusing existing Cloudinary video."
    );

    console.log(
      `Video URL:\n${videoUrl}`
    );
  } else {
    console.log(
      "\nNo song video supplied."
    );
  }

  /*
   * ----------------------------------------------------------
   * Context metadata stored on Cloudinary MP3
   * ----------------------------------------------------------
   */

  const context = {
    song_title:
      sanitizeContextValue(
        title
      ),

    artist:
      sanitizeContextValue(
        artist
      ),

    album:
      sanitizeContextValue(
        album
      ),
  };

  if (
    duration > 0
  ) {
    context.duration =
      sanitizeContextValue(
        duration
      );
  }

  if (genre) {
    context.genre =
      sanitizeContextValue(
        genre
      );
  }

  if (year) {
    context.year =
      sanitizeContextValue(
        year
      );
  }

  if (trackNumber) {
    context.track_number =
      sanitizeContextValue(
        trackNumber
      );
  }

  if (trackTotal) {
    context.track_total =
      sanitizeContextValue(
        trackTotal
      );
  }

  if (discNumber) {
    context.disc_number =
      sanitizeContextValue(
        discNumber
      );
  }

  if (discTotal) {
    context.disc_total =
      sanitizeContextValue(
        discTotal
      );
  }

  if (albumArt) {
    context.album_art =
      sanitizeContextValue(
        albumArt
      );
  }

  if (videoUrl) {
    context.video_url =
      sanitizeContextValue(
        videoUrl
      );
  }

  /*
   * ----------------------------------------------------------
   * Upload MP3
   * ----------------------------------------------------------
   */

  console.log(
    "\nUploading audio file to Cloudinary..."
  );

  const uploadResult =
    await cloudinary.uploader.upload(
      filePath,
      {
        /*
         * Cloudinary treats audio as video resource type.
         */
        resource_type:
          "video",

        /*
         * Visible Media Library folder.
         */
        asset_folder:
          SONG_FOLDER,

        /*
         * What Cloudinary displays in the Media Library.
         */
        display_name:
          title,

        /*
         * Use original filename as the basis of the public ID.
         */
        use_filename:
          true,

        /*
         * Prevent Cloudinary from adding random characters like:
         *
         * After_Dark_iafzov
         */
        unique_filename:
          false,

        /*
         * Don't silently overwrite an unrelated existing file.
         */
        overwrite:
          false,

        /*
         * Store our music metadata.
         */
        context,
      }
    );

  /*
   * ----------------------------------------------------------
   * Success output
   * ----------------------------------------------------------
   */

  console.log(
    "\n========================================"
  );

  console.log(
    "Song uploaded successfully"
  );

  console.log(
    "========================================"
  );

  console.log(
    `Title       : ${title}`
  );

  console.log(
    `Artist      : ${artist}`
  );

  console.log(
    `Album       : ${album}`
  );

  console.log(
    `Duration    : ${
      duration > 0
        ? `${duration.toFixed(
            2
          )} sec`
        : "Unknown"
    }`
  );

  console.log(
    `Asset ID    : ${
      uploadResult.asset_id
    }`
  );

  console.log(
    `Public ID   : ${
      uploadResult.public_id
    }`
  );

  console.log(
    `Folder      : ${SONG_FOLDER}`
  );

  console.log(
    `Artwork     : ${
      albumArt ||
      "None"
    }`
  );

  console.log(
    `Video       : ${
      videoUrl ||
      "None"
    }`
  );

  console.log(
    `Stream URL  : ${
      uploadResult.secure_url
    }`
  );

  console.log(
    "========================================\n"
  );
}

/*
 * ------------------------------------------------------------
 * CLI
 * ------------------------------------------------------------
 */

const cli =
  createInterface({
    input,
    output,
  });

async function runIngestion() {
  try {
    const suppliedAudioPath =
      cleanInputPath(
        process.argv[2]
      );

    const audioPath =
      suppliedAudioPath ||
      cleanInputPath(
        await cli.question(
          "Enter song path: "
        )
      );

    if (!audioPath) {
      throw new Error(
        "No audio file supplied."
      );
    }

    const videoInput =
      cleanInputPath(
        await cli.question(
          "Enter video path / existing Cloudinary video URL (leave blank for no video): "
        )
      );

    let videoPath =
      "";

    let existingVideoUrl =
      "";

    if (videoInput) {
      if (
        isCloudinaryVideoUrl(
          videoInput
        )
      ) {
        existingVideoUrl =
          videoInput;
      } else {
        videoPath =
          videoInput;
      }
    }

    const resolvedAudioPath =
      path.resolve(
        audioPath
      );

    const resolvedVideoPath =
      videoPath
        ? path.resolve(
            videoPath
          )
        : "";

    await uploadSong(
      resolvedAudioPath,
      resolvedVideoPath,
      existingVideoUrl
    );
  } finally {
    cli.close();
  }
}

runIngestion().catch(
  (error) => {
    console.error(
      "\n========================================"
    );

    console.error(
      "Ingestion failed"
    );

    console.error(
      "========================================"
    );

    /*
     * Print only useful error information.
     *
     * Avoid dumping massive binary/data URI content.
     */
    console.error(
      "Message:",
      error?.message ??
        "Unknown error"
    );

    if (
      error?.http_code
    ) {
      console.error(
        "HTTP code:",
        error.http_code
      );
    }

    if (
      error?.code &&
      error.code !==
        "ENAMETOOLONG"
    ) {
      console.error(
        "Code:",
        error.code
      );
    }

    console.error(
      "========================================\n"
    );

    process.exit(1);
  }
);
