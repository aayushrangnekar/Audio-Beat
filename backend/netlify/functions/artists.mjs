import {
  loadCloudinarySongs,
} from "../../lib/cloudinaryCatalogue.mjs";

export default async () => {
  try {
    const songs =
      await loadCloudinarySongs();

    const artistMap =
      new Map();

    for (
      const song of songs
    ) {
      const artistName =
        song.artist?.trim();

      if (!artistName) {
        continue;
      }

      const artistId =
        artistName
          .toLocaleLowerCase();

      if (
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

    return Response.json({
      count:
        artists.length,

      artists,
    });
  } catch (error) {
    console.error(
      "Unable to load artists:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to load artists.",
      },
      {
        status: 500,
      }
    );
  }
};

export const config = {
  path: "/api/artists",
};