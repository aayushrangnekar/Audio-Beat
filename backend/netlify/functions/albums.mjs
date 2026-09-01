import {
  loadCloudinarySongs,
} from "../../lib/cloudinaryCatalogue.mjs";

export default async () => {
  try {
    const songs =
      await loadCloudinarySongs();

    const albumMap =
      new Map();

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

    return Response.json({
      count:
        albums.length,

      albums,
    });
  } catch (error) {
    console.error(
      "Unable to load albums:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to load albums.",
      },
      {
        status: 500,
      }
    );
  }
};

export const config = {
  path: "/api/albums",
};