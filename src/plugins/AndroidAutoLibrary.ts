import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from "@capacitor/core";

interface AndroidAutoSong {
  id: string;
  uri: string;
  title: string;
  artist: string;
  album: string;
  albumArt: string | null;
}

interface AndroidAutoPlaylist {
  id: string;
  name: string;
  songIds: string[];
}

export interface AndroidAutoLibraryData {
  songs: AndroidAutoSong[];
  recentlyPlayedIds: string[];
  likedSongIds: string[];
  playlists: AndroidAutoPlaylist[];
}

export interface AndroidAutoConnectionState {
  connected: boolean;
  projection: boolean;
  connectionType:
    | "none"
    | "projection"
    | "native"
    | "unknown";
}

interface NativeAndroidAutoLibraryPlugin {
  syncLibrary(options: {
    library: AndroidAutoLibraryData;
  }): Promise<{
    synced: boolean;
  }>;

  getConnectionState():
    Promise<AndroidAutoConnectionState>;

  addListener(
    eventName: "connectionStateChanged",
    listener: (
      state: AndroidAutoConnectionState
    ) => void
  ): Promise<PluginListenerHandle>;
}

const NativeAndroidAutoLibrary =
  registerPlugin<NativeAndroidAutoLibraryPlugin>(
    "AndroidAutoLibrary"
  );

export const AndroidAutoLibrary = {
  async syncLibrary(options: {
    library: AndroidAutoLibraryData;
  }): Promise<void> {
    if (
      Capacitor.getPlatform() !==
      "android"
    ) {
      return;
    }

    await NativeAndroidAutoLibrary
      .syncLibrary(options);
  },

  async getConnectionState():
    Promise<AndroidAutoConnectionState> {
    if (
      Capacitor.getPlatform() !==
      "android"
    ) {
      return {
        connected: false,
        projection: false,
        connectionType: "none",
      };
    }

    return NativeAndroidAutoLibrary
      .getConnectionState();
  },

  async addConnectionListener(
    listener: (
      state: AndroidAutoConnectionState
    ) => void
  ): Promise<PluginListenerHandle | null> {
    if (
      Capacitor.getPlatform() !==
      "android"
    ) {
      return null;
    }

    return NativeAndroidAutoLibrary
      .addListener(
        "connectionStateChanged",
        listener
      );
  },
};
