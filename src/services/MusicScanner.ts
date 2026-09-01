import {
  Capacitor,
  registerPlugin,
} from "@capacitor/core";

import type {
  Song,
} from "../types";

interface NativeSong {
  id: string;
  title: string;
  artist: string;
  album: string;
  uri: string;
  duration: number;

  albumArt?:
    | string
    | null;

  /*
   * Diagnostic value returned
   * by the Android scanner.
   */
  artworkSource?:
    | "embedded"
    | "mediastore"
    | "cache"
    | "none";
}

interface NativeMusicScannerPlugin {
  scanMusic(): Promise<{
    songs: NativeSong[];
  }>;
}

const NativeMusicScanner =
  registerPlugin<NativeMusicScannerPlugin>(
    "MusicScanner"
  );

function normalizeText(
  value:
    | string
    | undefined
    | null,
  fallback: string
): string {
  const normalized =
    value?.trim() ?? "";

  return normalized.length > 0
    ? normalized
    : fallback;
}

function normalizeNativeArtworkUri(
  albumArt:
    | string
    | null
    | undefined
): string | undefined {
  if (
    typeof albumArt !== "string" ||
    albumArt.trim().length === 0
  ) {
    return undefined;
  }

  return albumArt.trim();
}

function convertArtworkUri(
  nativeArtworkUri:
    | string
    | undefined
): string | undefined {
  if (!nativeArtworkUri) {
    return undefined;
  }

  try {
    return Capacitor.convertFileSrc(
      nativeArtworkUri
    );
  } catch (error) {
    console.error(
      "Unable to convert album artwork URI:",
      nativeArtworkUri,
      error
    );

    return undefined;
  }
}

export class MusicScanner {
  static async scanDevice():
    Promise<Song[]> {
    try {
      const result =
        await NativeMusicScanner
          .scanMusic();

      console.log(
        "MusicScanner native result:",
        result
      );

      if (
        !Array.isArray(
          result.songs
        )
      ) {
        console.error(
          "MusicScanner did not return a songs array."
        );

        return [];
      }

      console.log(
        `MusicScanner found ${result.songs.length} songs.`
      );

      return result.songs.map(
        (
          nativeSong:
            NativeSong
        ): Song => {
          const nativeAlbumArt =
            normalizeNativeArtworkUri(
              nativeSong.albumArt
            );

          const albumArt =
            convertArtworkUri(
              nativeAlbumArt
            );

          console.log(
            "Artwork diagnostic:",
            {
              id:
                nativeSong.id,

              title:
                nativeSong.title,

              artworkSource:
                nativeSong
                  .artworkSource ??
                "unknown",

              nativeUri:
                nativeAlbumArt ??
                null,

              webViewUri:
                albumArt ??
                null,
            }
          );

          return {
            id:
              String(
                nativeSong.id
              ),

            title:
              normalizeText(
                nativeSong.title,
                "Unknown title"
              ),

            artist:
              normalizeText(
                nativeSong.artist,
                "Unknown artist"
              ),

            album:
              normalizeText(
                nativeSong.album,
                "Unknown album"
              ),

            uri:
              nativeSong.uri,

            duration:
              Number(
                nativeSong.duration
              ) || 0,

            /*
             * Converted URI used by
             * React <img>.
             */
            albumArt,

            /*
             * Original Android artwork
             * URI used by native Media3.
             */
            nativeAlbumArt,
          };
        }
      );
    } catch (error) {
      console.error(
        "Unable to scan device music:",
        error
      );

      throw error;
    }
  }
}