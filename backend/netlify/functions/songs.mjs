import {
  getSongFolder,
  loadCloudinarySongs,
} from "../../lib/cloudinaryCatalogue.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export default async (request) => {
  /*
   * ----------------------------------------------------------
   * CORS preflight
   * ----------------------------------------------------------
   *
   * Capacitor / Android WebView may send an OPTIONS request
   * before the actual GET request.
   */

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  /*
   * ----------------------------------------------------------
   * Cloudinary catalogue
   * ----------------------------------------------------------
   */

  try {
    const songs =
      await loadCloudinarySongs();

    return Response.json(
      {
        count:
          songs.length,

        folder:
          getSongFolder(),

        songs,
      },
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error(
      "Unable to load songs:",
      error
    );

    return Response.json(
      {
        error:
          "Unable to load the Cloudinary music catalogue.",
      },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
};

export const config = {
  path: "/api/songs",
};