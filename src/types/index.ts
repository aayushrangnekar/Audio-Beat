export interface LyricLine {
  time: number;
  text: string;
}

export type LyricsStatus =
  | "idle"
  | "loading"
  | "loaded"
  | "not-found"
  | "instrumental"
  | "error";

export type SongSource =
  | "local"
  | "cloudinary";

export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;

  /*
   * Audio source.
   *
   * Local songs:
   *   content://...
   *
   * Cloudinary songs:
   *   https://res.cloudinary.com/...
   */
  uri: string;

  duration: number;

  /*
   * Identifies where the song came from.
   *
   * Existing/local songs may initially have this undefined,
   * which should be treated as "local".
   */
  source?: SongSource;

  /*
   * Logical folder used by the React UI.
   *
   * Cloud songs use:
   *   "Cloudinary"
   */
  folder?: string;

  /* Capacitor-converted artwork URL used by React <img>. */
  albumArt?: string;

  /*
   * Original Android artwork URI used by Media3.
   *
   * Primarily used for local Android songs.
   */
  nativeAlbumArt?: string;

  /* Parsed timestamped lyrics used by SyncedLyrics. */
  lyrics?: LyricLine[];

  /* Plain lyrics returned when LRCLIB has no synced version. */
  plainLyrics?: string;

  lyricsStatus?: LyricsStatus;
  lyricsMessage?: string;
  lyricsSourceId?: number;

  videoUrl?: string;

  /*
   * Cloudinary catalogue metadata retained for Music Trivia.
   * These remain optional so local songs are unaffected.
   */
  year?: number;
  genre?: string;
  trackNumber?: number;

  color?: string;
}

export interface Artist {
  id: string;
  name: string;
  image: string;
}

export interface Playlist {
  id: string;
  name: string;
  cover?: string;
  songIds: string[];
}

export type AudioOutputType =
  | "headphones"
  | "speaker"
  | "phone"
  | "car"
  | "bluetooth"
  | "wired"
  | "usb"
  | "hdmi"
  | "unknown";

export interface BluetoothDevice {
  id: string;
  name: string;
  type: AudioOutputType;
  connected: boolean;
  active?: boolean;
  connection?: string;
}
