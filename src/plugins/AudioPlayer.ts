import {
  registerPlugin,
} from "@capacitor/core";

export interface NativeAudioQueueItem {
  id: string;
  uri: string;
  title: string;
  artist: string;
  album: string;

  /*
   * Original Android artwork URI.
   */
  albumArt?: string;
}

export interface AudioState {
  uri?: string;
  id?: string;
  title?: string;
  artist?: string;
  album?: string;
  albumArt?: string;
  isPrepared: boolean;
  isPlaying: boolean;
  position: number;
  duration: number;
}

export interface MediaItemChangedEvent {
  uri?: string;
  id?: string;
  title?: string;
  artist?: string;
  album?: string;
  albumArt?: string;
  isPlaying: boolean;
  position: number;
  duration: number;
  reason: number;
}

export interface AudioPlayerPlugin {
  load(options: {
    uri: string;
    id?: string;
    title?: string;
    artist?: string;
    album?: string;

    /*
     * Pass the original Android file/content URI here,
     * not Capacitor.convertFileSrc(...).
     */
    albumArt?: string;

    /*
     * Sending the complete queue allows Media3 to expose
     * standard Previous and Next notification controls.
     */
    queue?: NativeAudioQueueItem[];

    autoPlay?: boolean;
  }): Promise<{
    uri: string;
    duration: number;
  }>;

  play(): Promise<{
    isPlaying: boolean;
    position: number;
    duration: number;
  }>;

  pause(): Promise<{
    isPlaying: boolean;
    position: number;
    duration: number;
  }>;

  stop(): Promise<{
    isPlaying: boolean;
    position: number;
    duration: number;
  }>;

  seek(options: {
    position: number;
  }): Promise<{
    position: number;
    duration: number;
  }>;

  /** Stops playback and clears the service queue. */
  release(): Promise<void>;

  /** Reads the MediaSessionService state, even after the WebView restarts. */
  getState(): Promise<AudioState>;

  addListener(
    eventName: "prepared",
    listener: (data: {
      uri: string;
      duration: number;
    }) => void
  ): Promise<{
    remove: () => Promise<void>;
  }>;

  addListener(
    eventName: "progress",
    listener: (data: {
      position: number;
      duration: number;
      isPlaying: boolean;
    }) => void
  ): Promise<{
    remove: () => Promise<void>;
  }>;

  addListener(
    eventName: "mediaItemChanged",
    listener: (
      data: MediaItemChangedEvent
    ) => void
  ): Promise<{
    remove: () => Promise<void>;
  }>;

  addListener(
    eventName: "completed",
    listener: (data: {
      position: number;
      duration: number;
    }) => void
  ): Promise<{
    remove: () => Promise<void>;
  }>;

  addListener(
    eventName: "playbackStateChanged",
    listener: (data: {
      isPlaying: boolean;
    }) => void
  ): Promise<{
    remove: () => Promise<void>;
  }>;

  addListener(
    eventName: "error",
    listener: (data: {
      message: string;
      details?: string;
    }) => void
  ): Promise<{
    remove: () => Promise<void>;
  }>;
}

export const AudioPlayer =
  registerPlugin<AudioPlayerPlugin>(
    "AudioPlayer"
  );
