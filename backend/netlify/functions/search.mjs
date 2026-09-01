import {
  loadCloudinarySongs,
} from "../../lib/cloudinaryCatalogue.mjs";

export default async (
  request
) => {
  try {
    const url =
      new URL(
        request.url
      );

    const query =
      (
        url.searchParams.get(
          "q"
        ) || ""
      )
        .trim()
        .toLocaleLowerCase();

    if (!query) {
      return Response.json({
        query: "",
        count: 0,
        songs: [],
      });
    }

    const songs =
      await loadCloudinarySongs();

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
              .filter(Boolean)
              .join(" ")
              .toLocaleLowerCase();

          return searchable.includes(
            query
          );
        }
      );

    return Response.json({
      query,
      count:
        matches.length,
      songs:
        matches,
    });
  } catch (error) {
    console.error(
      "Unable to search songs:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to search the music catalogue.",
      },
      {
        status: 500,
      }
    );
  }
};

export const config = {
  path: "/api/search",
};