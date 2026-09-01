import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  BluetoothDevice,
  Playlist,
  Song,
} from "../types";

import { MusicScanner } from "../services/MusicScanner";
import { VideoStorage } from "../plugins/VideoStorage";
import { AudioPlayer } from "../plugins/AudioPlayer";
import { AudioOutput } from "../plugins/AudioOutput";
import { AndroidAutoLibrary } from "../plugins/AndroidAutoLibrary";
import { LyricsService } from "../services/LyricsService";
import cloudMusicService, {
  type CloudSong,
} from "../services/CloudMusicService";

interface NativeListenerHandle {
  remove: () => Promise<void>;
}

interface PlayerContextValue {
  // Songs scanned from Android
  songs: Song[];
  isLoadingSongs: boolean;
  scanSongs: () => Promise<void>;

  // Playback
  currentSong: Song | null;
  isPlaying: boolean;
  progress: number;
  queue: string[];

  playSong: (
    id: string,
    queue?: string[]
  ) => void;

  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;

  // Home-tab playback statistics
  recentlyPlayedIds: string[];
  playCounts: Record<string, number>;

  // Now-playing screen
  isPlayerOpen: boolean;
  openPlayer: () => void;
  closePlayer: () => void;

  // Full-screen lyrics overlay
  isFullLyricsOpen: boolean;
  openFullLyrics: () => void;
  closeFullLyrics: () => void;

  // Lyrics and video
  lyricsOn: boolean;
  setLyricsOn: (
    value: boolean
  ) => void;

  videoBackgroundOn: boolean;
  setVideoBackgroundOn: (
    value: boolean
  ) => void;

  // Per-song videos
  songVideos: Record<string, string>;

  setSongVideo: (
    songId: string,
    url: string
  ) => void;

  removeSongVideo: (
    songId: string
  ) => void;

  getVideoForSong: (
    song: Song | null
  ) => string | undefined;

  // Playlists
  playlists: Playlist[];
  createPlaylist: (
    name: string
  ) => void;

  deletePlaylist: (
    id: string
  ) => void;

  addSongsToPlaylist: (
    playlistId: string,
    songIds: string[]
  ) => void;

  removeSongFromPlaylist: (
    playlistId: string,
    songId: string
  ) => void;

  addSongToPlaylists: (
    playlistIds: string[],
    songId: string
  ) => void;

  // Liked songs
  likedSongIds: string[];

  toggleLikedSong: (
    songId: string
  ) => void;

  // Bluetooth UI state
  devices: BluetoothDevice[];

  refreshAudioOutputs:
    () => Promise<void>;

  connectedDevice:
    BluetoothDevice | null;

  // Search history
  searchHistory: string[];

  addSearch: (
    query: string
  ) => void;

  clearSearchHistory:
    () => void;
}

const PLAYLISTS_STORAGE_KEY =
  "music-player-playlists";

const RECENTLY_PLAYED_STORAGE_KEY =
  "music-player-recently-played";

const PLAY_COUNTS_STORAGE_KEY =
  "music-player-play-counts";

const LIKED_SONGS_STORAGE_KEY =
  "music-player-liked-songs";

function loadLikedSongIds():
  string[] {
  try {
    const savedValue =
      window.localStorage.getItem(
        LIKED_SONGS_STORAGE_KEY
      );

    if (!savedValue) {
      return [];
    }

    const parsedValue: unknown =
      JSON.parse(savedValue);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.filter(
      (
        songId
      ): songId is string =>
        typeof songId === "string" &&
        songId.trim().length > 0
    );
  } catch (error) {
    console.error(
      "Unable to load liked songs:",
      error
    );

    return [];
  }
}

function loadSavedPlaylists():
  Playlist[] {
  try {
    const savedValue =
      window.localStorage.getItem(
        PLAYLISTS_STORAGE_KEY
      );

    if (!savedValue) {
      return [];
    }

    const parsedValue: unknown =
      JSON.parse(savedValue);

    if (
      !Array.isArray(
        parsedValue
      )
    ) {
      return [];
    }

    return parsedValue
      .filter(
        (
          playlist
        ): playlist is Playlist =>
          typeof playlist ===
            "object" &&
          playlist !== null &&
          "id" in playlist &&
          typeof playlist.id ===
            "string" &&
          "name" in playlist &&
          typeof playlist.name ===
            "string" &&
          "songIds" in
            playlist &&
          Array.isArray(
            playlist.songIds
          )
      )
      .map(
        (
          playlist:
            Playlist
        ) => {
          const {
            cover:
              _unusedCover,
            ...playlistWithoutCover
          } = playlist;

          return playlistWithoutCover;
        }
      );
  } catch (error) {
    console.error(
      "Unable to load saved playlists:",
      error
    );

    return [];
  }
}

function loadRecentlyPlayedIds():
  string[] {
  try {
    const savedValue =
      window.localStorage.getItem(
        RECENTLY_PLAYED_STORAGE_KEY
      );

    if (!savedValue) {
      return [];
    }

    const parsedValue: unknown =
      JSON.parse(savedValue);

    if (
      !Array.isArray(
        parsedValue
      )
    ) {
      return [];
    }

    return parsedValue
      .filter(
        (
          songId
        ): songId is string =>
          typeof songId ===
            "string" &&
          songId.trim().length >
            0
      )
      .slice(0, 10);
  } catch (error) {
    console.error(
      "Unable to load recently played songs:",
      error
    );

    return [];
  }
}

function loadPlayCounts():
  Record<string, number> {
  try {
    const savedValue =
      window.localStorage.getItem(
        PLAY_COUNTS_STORAGE_KEY
      );

    if (!savedValue) {
      return {};
    }

    const parsedValue: unknown =
      JSON.parse(savedValue);

    if (
      typeof parsedValue !==
        "object" ||
      parsedValue === null ||
      Array.isArray(
        parsedValue
      )
    ) {
      return {};
    }

    const validCounts:
      Record<string, number> =
        {};

    for (
      const [
        songId,
        rawCount,
      ] of Object.entries(
        parsedValue
      )
    ) {
      if (
        typeof rawCount !==
          "number" ||
        !Number.isFinite(
          rawCount
        )
      ) {
        continue;
      }

      validCounts[
        songId
      ] = Math.min(
        10,
        Math.max(
          0,
          Math.trunc(
            rawCount
          )
        )
      );
    }

    return validCounts;
  } catch (error) {
    console.error(
      "Unable to load play counts:",
      error
    );

    return {};
  }
}

const PlayerContext =
  createContext<
    PlayerContextValue | null
  >(null);

function cloudSongToSong(
  cloudSong: CloudSong
): Song {
  const duration =
    Number.isFinite(
      cloudSong.duration
    ) &&
    cloudSong.duration > 0
      ? cloudSong.duration
      : 0;

  return {
    id: `cloudinary:${cloudSong.id}`,

    title:
      cloudSong.title?.trim() ||
      cloudSong.displayName?.trim() ||
      "Unknown Title",

    artist:
      cloudSong.artist?.trim() ||
      "Unknown Artist",

    album:
      cloudSong.album?.trim() ||
      "Unknown Album",

    uri: cloudSong.uri,
    duration,

    albumArt:
      cloudSong.albumArt ||
      undefined,

    nativeAlbumArt:
      cloudSong.remoteAlbumArt ||
      undefined,

    videoUrl:
      cloudSong.videoUrl ||
      undefined,

    year:
      cloudSong.year ??
      undefined,

    genre:
      cloudSong.genre ??
      undefined,

    trackNumber:
      cloudSong.trackNumber ??
      undefined,

    source: "cloudinary",
    folder: "Cloudinary",
  };
}

export function PlayerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [
    songs,
    setSongs,
  ] = useState<Song[]>([]);

  const [
    isLoadingSongs,
    setIsLoadingSongs,
  ] = useState<boolean>(true);

  const [
    currentSong,
    setCurrentSong,
  ] = useState<Song | null>(
    null
  );

  const [
    isPlaying,
    setIsPlaying,
  ] = useState<boolean>(
    false
  );

  const [
    progress,
    setProgress,
  ] = useState<number>(0);

  const [
    queue,
    setQueue,
  ] = useState<string[]>([]);

  const [
    recentlyPlayedIds,
    setRecentlyPlayedIds,
  ] = useState<string[]>(
    loadRecentlyPlayedIds
  );

  const [
    playCounts,
    setPlayCounts,
  ] = useState<
    Record<string, number>
  >(loadPlayCounts);

  const [
    isPlayerOpen,
    setIsPlayerOpen,
  ] = useState<boolean>(
    false
  );

  const [
    lyricsOn,
    setLyricsOn,
  ] = useState<boolean>(
    true
  );

  const [
    isFullLyricsOpen,
    setIsFullLyricsOpen,
  ] = useState<boolean>(
    false
  );

  const [
    videoBackgroundOn,
    setVideoBackgroundOn,
  ] = useState<boolean>(
    false
  );

  const [
    songVideos,
    setSongVideos,
  ] = useState<
    Record<string, string>
  >({});

  const [
    playlists,
    setPlaylists,
  ] = useState<Playlist[]>(
    loadSavedPlaylists
  );

  const [
    likedSongIds,
    setLikedSongIds,
  ] = useState<string[]>(
    loadLikedSongIds
  );

  const [
    devices,
    setDevices,
  ] = useState<
    BluetoothDevice[]
  >([]);

  const [
    androidAutoConnected,
    setAndroidAutoConnected,
  ] = useState<boolean>(false);

  const [
    searchHistory,
    setSearchHistory,
  ] = useState<string[]>([]);

  const songsRef =
    useRef<Song[]>([]);

  const queueRef =
    useRef<string[]>([]);

  const currentSongRef =
    useRef<Song | null>(
      null
    );

  const isPlayingRef =
    useRef<boolean>(
      false
    );

  const loadRequestRef =
    useRef<number>(0);

  const lyricsRequestRef =
    useRef<number>(0);

  const playNextRef =
    useRef<
      () => void
    >(
      () => undefined
    );

  const nativeStateRestoredRef =
    useRef<boolean>(
      false
    );

  useEffect(() => {
    songsRef.current =
      songs;
  }, [songs]);

  useEffect(() => {
    queueRef.current =
      queue;
  }, [queue]);

  useEffect(() => {
    currentSongRef.current =
      currentSong;
  }, [currentSong]);

  useEffect(() => {
    isPlayingRef.current =
      isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        PLAYLISTS_STORAGE_KEY,
        JSON.stringify(
          playlists
        )
      );
    } catch (error) {
      console.error(
        "Unable to save playlists:",
        error
      );
    }
  }, [playlists]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        LIKED_SONGS_STORAGE_KEY,
        JSON.stringify(
          likedSongIds
        )
      );
    } catch (error) {
      console.error(
        "Unable to save liked songs:",
        error
      );
    }
  }, [likedSongIds]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        RECENTLY_PLAYED_STORAGE_KEY,
        JSON.stringify(
          recentlyPlayedIds
        )
      );
    } catch (error) {
      console.error(
        "Unable to save recently played songs:",
        error
      );
    }
  }, [recentlyPlayedIds]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        PLAY_COUNTS_STORAGE_KEY,
        JSON.stringify(
          playCounts
        )
      );
    } catch (error) {
      console.error(
        "Unable to save play counts:",
        error
      );
    }
  }, [playCounts]);

  useEffect(() => {
    const library = {
      songs: songs.map(
        (song: Song) => ({
          id: song.id,
          uri: song.uri,
          title:
            song.title?.trim() ||
            "Unknown title",
          artist:
            song.artist?.trim() ||
            "Unknown artist",
          album:
            song.album?.trim() ||
            "Unknown album",
          albumArt:
            song.nativeAlbumArt ??
            song.albumArt ??
            null,
        })
      ),

      recentlyPlayedIds: [
        ...recentlyPlayedIds,
      ],

      likedSongIds: [
        ...likedSongIds,
      ],

      playlists: playlists.map(
        (playlist: Playlist) => ({
          id: playlist.id,
          name: playlist.name,
          songIds: [
            ...playlist.songIds,
          ],
        })
      ),
    };

    void AndroidAutoLibrary
      .syncLibrary({
        library,
      })
      .catch((error) => {
        console.warn(
          "Unable to sync Android Auto library:",
          error
        );
      });
  }, [
    likedSongIds,
    playlists,
    recentlyPlayedIds,
    songs,
  ]);

  const recordSongPlayback =
    useCallback(
      (
        songId: string
      ): void => {
        /*
         * Keep only the latest
         * ten unique songs.
         */
        setRecentlyPlayedIds(
          (
            previousIds:
              string[]
          ) =>
            [
              songId,

              ...previousIds.filter(
                (
                  existingId:
                    string
                ) =>
                  existingId !==
                    songId
              ),
            ].slice(0, 10)
        );

        /*
         * Counter cycle:
         * 0 -> 1 -> ... -> 10 -> 0
         */
        setPlayCounts(
          (
            previousCounts:
              Record<
                string,
                number
              >
          ) => {
            const previousCount =
              previousCounts[
                songId
              ] ?? 0;

            const nextCount =
              previousCount >=
              10
                ? 0
                : previousCount +
                  1;

            return {
              ...previousCounts,
              [songId]:
                nextCount,
            };
          }
        );
      },
      []
    );

  const updateSongDuration =
    useCallback(
      (
        songId: string,
        duration: number
      ): void => {
        if (
          !Number.isFinite(
            duration
          ) ||
          duration <= 0
        ) {
          return;
        }

        setSongs(
          (
            existingSongs:
              Song[]
          ) =>
            existingSongs.map(
              (
                song:
                  Song
              ) =>
                song.id ===
                songId
                  ? {
                      ...song,
                      duration,
                    }
                  : song
            )
        );

        setCurrentSong(
          (
            song:
              Song | null
          ) => {
            if (
              !song ||
              song.id !==
                songId
            ) {
              return song;
            }

            return {
              ...song,
              duration,
            };
          }
        );
      },
      []
    );

  const loadLyricsForSong =
    useCallback(
      async (
        song: Song,
        duration: number
      ): Promise<void> => {
        const requestId =
          lyricsRequestRef.current + 1;

        lyricsRequestRef.current =
          requestId;

        const loadingSong: Song = {
          ...song,
          duration,
          lyricsStatus: "loading",
          lyricsMessage:
            "Fetching synced lyrics...",
        };

        songsRef.current =
          songsRef.current.map(
            (existingSong: Song) =>
              existingSong.id === song.id
                ? loadingSong
                : existingSong
          );

        setSongs(
          (existingSongs: Song[]) =>
            existingSongs.map(
              (existingSong: Song) =>
                existingSong.id === song.id
                  ? loadingSong
                  : existingSong
            )
        );

        if (
          currentSongRef.current?.id ===
          song.id
        ) {
          currentSongRef.current =
            loadingSong;
          setCurrentSong(loadingSong);
        }

        const result =
          await LyricsService.getSyncedLyrics(
            loadingSong,
            duration
          );

        if (
          requestId !==
          lyricsRequestRef.current
        ) {
          return;
        }

        const updatedSong: Song = {
          ...loadingSong,
          lyrics: result.lyrics,
          plainLyrics:
            result.plainLyrics ??
            undefined,
          lyricsStatus: result.status,
          lyricsMessage:
            result.message ??
            undefined,
          lyricsSourceId:
            result.sourceId ??
            undefined,
        };

        songsRef.current =
          songsRef.current.map(
            (existingSong: Song) =>
              existingSong.id === song.id
                ? updatedSong
                : existingSong
          );

        setSongs(
          (existingSongs: Song[]) =>
            existingSongs.map(
              (existingSong: Song) =>
                existingSong.id === song.id
                  ? updatedSong
                  : existingSong
            )
        );

        if (
          currentSongRef.current?.id ===
          song.id
        ) {
          currentSongRef.current =
            updatedSong;
          setCurrentSong(updatedSong);
        }
      },
      []
    );

  const stopAndReleaseAudio =
    useCallback(
      async (): Promise<void> => {
        loadRequestRef.current +=
          1;
        lyricsRequestRef.current +=
          1;

        try {
          await AudioPlayer.release();
        } catch (error) {
          console.warn(
            "Unable to release native audio player:",
            error
          );
        }

        setIsPlaying(
          false
        );

        setProgress(0);
      },
      []
    );

  const loadAndPlaySong =
    useCallback(
      async (
        song: Song,
        autoPlay:
          boolean = true
      ): Promise<void> => {
        const requestId =
          loadRequestRef.current +
          1;

        loadRequestRef.current =
          requestId;

        currentSongRef.current =
          song;

        setCurrentSong(
          song
        );

        setProgress(0);
        setIsPlaying(false);

        try {
          const result =
            await AudioPlayer.load(
              {
                uri: song.uri,
                id: song.id,
                title:
                  song.title,
                artist:
                  song.artist,
                album:
                  song.album,
                albumArt:
                  song.nativeAlbumArt ??
                  song.albumArt,

                queue:
                  (
                    queueRef.current
                      .length > 0
                      ? queueRef.current
                      : songsRef.current.map(
                          (
                            queuedSong:
                              Song
                          ) =>
                            queuedSong.id
                        )
                  )
                    .map(
                      (
                        queuedSongId:
                          string
                      ) =>
                        songsRef.current.find(
                          (
                            queuedSong:
                              Song
                          ) =>
                            queuedSong.id ===
                            queuedSongId
                        )
                    )
                    .filter(
                      (
                        queuedSong
                      ): queuedSong is
                        Song =>
                        Boolean(
                          queuedSong
                        )
                    )
                    .map(
                      (
                        queuedSong:
                          Song
                      ) => ({
                        id:
                          queuedSong.id,
                        uri:
                          queuedSong.uri,
                        title:
                          queuedSong.title,
                        artist:
                          queuedSong.artist,
                        album:
                          queuedSong.album,
                        albumArt:
                          queuedSong.nativeAlbumArt ??
                          queuedSong.albumArt,
                      })
                    ),

                autoPlay,
              }
            );

          if (
            requestId !==
            loadRequestRef.current
          ) {
            return;
          }

          const resolvedDuration =
            Number.isFinite(
              result.duration
            ) &&
            result.duration >
              0
              ? result.duration
              : song.duration;

          if (
            Number.isFinite(
              resolvedDuration
            ) &&
            resolvedDuration >
              0
          ) {
            updateSongDuration(
              song.id,
              resolvedDuration
            );

            void loadLyricsForSong(
              {
                ...song,
                duration:
                  resolvedDuration,
              },
              resolvedDuration
            );
          }

          isPlayingRef.current =
            autoPlay;

          setIsPlaying(
            autoPlay
          );

          /*
           * Count only a new successful
           * song load, not pause/resume.
           */
          if (autoPlay) {
            recordSongPlayback(
              song.id
            );
          }
        } catch (error) {
          if (
            requestId !==
            loadRequestRef.current
          ) {
            return;
          }

          console.error(
            `Unable to play "${song.title}":`,
            error
          );

          isPlayingRef.current =
            false;

          setIsPlaying(
            false
          );

          setProgress(0);
        }
      },
      [
        loadLyricsForSong,
        recordSongPlayback,
        updateSongDuration,
      ]
    );

  const scanSongs =
    useCallback(
      async (): Promise<void> => {
        setIsLoadingSongs(
          true
        );

        const previousSongs =
          songsRef.current;

        try {
          /*
           * Load local Android songs and
           * Cloudinary songs independently.
           *
           * If one source temporarily fails,
           * keep the other source available.
           */
          const [
            localSongs,
            cloudSongs,
          ] = await Promise.all([
            MusicScanner.scanDevice()
              .then(
                (
                  scannedSongs:
                    Song[]
                ): Song[] =>
                  scannedSongs.map(
                    (song: Song) => ({
                      ...song,
                      source:
                        song.source ??
                        "local",
                    })
                  )
              )
              .catch(
                (error): Song[] => {
                  console.error(
                    "Unable to scan music from device:",
                    error
                  );

                  return previousSongs.filter(
                    (song: Song) =>
                      song.source !==
                      "cloudinary"
                  );
                }
              ),

            cloudMusicService
              .getSongs()
              .then(
                (
                  cloudCatalogue:
                    CloudSong[]
                ): Song[] => {
                  console.log(
                    "Cloudinary songs received:",
                    cloudCatalogue
                  );

                  return cloudCatalogue
                    .filter(
                      (cloudSong: CloudSong) =>
                        Boolean(
                          cloudSong.id &&
                          cloudSong.uri
                        )
                    )
                    .map(
                      cloudSongToSong
                    );
                }
              )
              .catch(
                (error): Song[] => {
                  console.warn(
                    "Unable to load Cloudinary music catalogue. Keeping any already-loaded cloud songs:",
                    error
                  );

                  return previousSongs.filter(
                    (song: Song) =>
                      song.source ===
                      "cloudinary"
                  );
                }
              ),
          ]);

          const mergedSongs:
            Song[] = [
              ...localSongs,
              ...cloudSongs,
            ];

          console.log(
            "Merged Audio Beat songs:",
            mergedSongs
          );

          songsRef.current =
            mergedSongs;

          setSongs(
            mergedSongs
          );

          setQueue(
            (
              currentQueue:
                string[]
            ) => {
              const validIds =
                new Set(
                  mergedSongs.map(
                    (
                      song:
                        Song
                    ) =>
                      song.id
                  )
                );

              const validQueue =
                currentQueue.filter(
                  (
                    songId:
                      string
                  ) =>
                    validIds.has(
                      songId
                    )
                );

              const nextQueue =
                validQueue.length >
                0
                  ? validQueue
                  : mergedSongs.map(
                      (
                        song:
                          Song
                      ) =>
                        song.id
                    );

              queueRef.current =
                nextQueue;

              return nextQueue;
            }
          );

          /*
           * Remove songs that no longer exist
           * from stored playback statistics.
           */
          const validSongIds =
            new Set(
              mergedSongs.map(
                (
                  song:
                    Song
                ) =>
                  song.id
              )
            );

          setRecentlyPlayedIds(
            (
              previousIds:
                string[]
            ) =>
              previousIds.filter(
                (
                  songId:
                    string
                ) =>
                  validSongIds.has(
                    songId
                  )
              )
          );

          setPlayCounts(
            (
              previousCounts:
                Record<
                  string,
                  number
                >
            ) => {
              const nextCounts:
                Record<
                  string,
                  number
                > = {};

              for (
                const [
                  songId,
                  count,
                ] of Object.entries(
                  previousCounts
                )
              ) {
                if (
                  validSongIds.has(
                    songId
                  )
                ) {
                  nextCounts[
                    songId
                  ] =
                    count;
                }
              }

              return nextCounts;
            }
          );

          const activeSong =
            currentSongRef.current;

          if (activeSong) {
            const refreshedSong =
              mergedSongs.find(
                (
                  song:
                    Song
                ) =>
                  song.id ===
                  activeSong.id
              );

            if (
              refreshedSong
            ) {
              const nextSong:
                Song = {
                  ...refreshedSong,

                  duration:
                    activeSong.duration >
                    0
                      ? activeSong.duration
                      : refreshedSong.duration,
                  lyrics:
                    activeSong.lyrics,
                  plainLyrics:
                    activeSong.plainLyrics,
                  lyricsStatus:
                    activeSong.lyricsStatus,
                  lyricsMessage:
                    activeSong.lyricsMessage,
                  lyricsSourceId:
                    activeSong.lyricsSourceId,
                };

              currentSongRef.current =
                nextSong;

              setCurrentSong(
                nextSong
              );
            } else {
              await stopAndReleaseAudio();

              currentSongRef.current =
                null;

              setCurrentSong(
                null
              );
            }
          }
        } catch (error) {
          console.error(
            "Unable to refresh music catalogue:",
            error
          );

          /*
           * Keep the currently loaded catalogue
           * instead of clearing a usable session.
           */
        } finally {
          setIsLoadingSongs(
            false
          );
        }
      },
      [
        stopAndReleaseAudio,
      ]
    );

  useEffect(() => {
    void scanSongs();
  }, [scanSongs]);

  /*
   * Restore a Media3 player that
   * survived the WebView lifecycle.
   */
  useEffect(() => {
    if (
      nativeStateRestoredRef.current ||
      songs.length === 0
    ) {
      return;
    }

    nativeStateRestoredRef.current =
      true;

    void AudioPlayer.getState()
      .then(
        (
          state
        ) => {
          if (
            !state.isPrepared ||
            !state.uri
          ) {
            return;
          }

          const restoredSong =
            songs.find(
              (
                song:
                  Song
              ) =>
                song.id ===
                  state.id ||
                song.uri ===
                  state.uri
            );

          if (
            !restoredSong
          ) {
            return;
          }

          const restoredDuration =
            Number.isFinite(
              state.duration
            ) &&
            state.duration >
              0
              ? state.duration
              : restoredSong.duration;

          const nextSong:
            Song = {
              ...restoredSong,
              duration:
                restoredDuration,
            };

          currentSongRef.current =
            nextSong;

          isPlayingRef.current =
            state.isPlaying;

          setCurrentSong(
            nextSong
          );

          setProgress(
            Number.isFinite(
              state.position
            )
              ? Math.max(
                  0,
                  state.position
                )
              : 0
          );

          setIsPlaying(
            state.isPlaying
          );

          if (
            restoredDuration > 0
          ) {
            void loadLyricsForSong(
              nextSong,
              restoredDuration
            );
          }
        }
      )
      .catch(
        (
          error
        ) => {
          console.warn(
            "Unable to restore background playback state:",
            error
          );
        }
      );
  }, [
    loadLyricsForSong,
    songs,
  ]);

  useEffect(() => {
    async function loadSavedVideos():
      Promise<void> {
      try {
        const savedVideos =
          await VideoStorage.getAllVideos();

        setSongVideos(
          savedVideos
        );
      } catch (error) {
        console.error(
          "Unable to load saved videos:",
          error
        );

        setSongVideos({});
      }
    }

    void loadSavedVideos();
  }, []);

  const refreshAudioOutputs =
    useCallback(
      async (): Promise<void> => {
        try {
          const permissionResult =
            await AudioOutput.requestBluetoothPermission();

          if (
            !permissionResult.granted
          ) {
            console.warn(
              "Bluetooth permission was not granted. Device names may be unavailable."
            );
          }

          const state =
            await AudioOutput.getOutputDevices();

          setDevices(
            Array.isArray(
              state.devices
            )
              ? state.devices
              : []
          );
        } catch (error) {
          console.error(
            "Unable to read Android audio outputs:",
            error
          );

          setDevices([]);
        }
      },
      []
    );

  useEffect(() => {
    let disposed =
      false;

    let listenerHandle:
      NativeListenerHandle | null =
        null;

    async function installAndroidAutoListener():
      Promise<void> {
      try {
        const initialState =
          await AndroidAutoLibrary
            .getConnectionState();

        if (disposed) {
          return;
        }

        setAndroidAutoConnected(
          initialState.projection
        );

        const handle =
          await AndroidAutoLibrary
            .addConnectionListener(
              (state) => {
                if (disposed) {
                  return;
                }

                setAndroidAutoConnected(
                  state.projection
                );
              }
            );

        if (disposed) {
          if (handle) {
            await handle.remove();
          }

          return;
        }

        listenerHandle =
          handle;
      } catch (error) {
        console.warn(
          "Unable to read Android Auto connection state:",
          error
        );

        setAndroidAutoConnected(
          false
        );
      }
    }

    void installAndroidAutoListener();

    return () => {
      disposed = true;

      if (listenerHandle) {
        void listenerHandle.remove();
      }
    };
  }, []);

  useEffect(() => {
    let disposed =
      false;

    let listenerHandle:
      NativeListenerHandle | null =
        null;

    async function installAudioOutputListener():
      Promise<void> {
      await refreshAudioOutputs();

      if (disposed) {
        return;
      }

      try {
        const handle =
          (await AudioOutput.addListener(
            "outputDevicesChanged",
            (
              state
            ) => {
              if (
                disposed
              ) {
                return;
              }

              setDevices(
                Array.isArray(
                  state.devices
                )
                  ? state.devices
                  : []
              );
            }
          )) as NativeListenerHandle;

        if (disposed) {
          await handle.remove();
          return;
        }

        listenerHandle =
          handle;
      } catch (error) {
        console.error(
          "Unable to install audio-output listener:",
          error
        );
      }
    }

    void installAudioOutputListener();

    return () => {
      disposed = true;

      if (
        listenerHandle
      ) {
        void listenerHandle.remove();
      }
    };
  }, [refreshAudioOutputs]);

  useEffect(() => {
    let disposed =
      false;

    const handles:
      NativeListenerHandle[] =
        [];

    async function installListeners():
      Promise<void> {
      try {
        const progressHandle =
          (await AudioPlayer.addListener(
            "progress",
            (
              data
            ) => {
              if (
                disposed
              ) {
                return;
              }

              setProgress(
                Number.isFinite(
                  data.position
                )
                  ? Math.max(
                      0,
                      data.position
                    )
                  : 0
              );

              isPlayingRef.current =
                data.isPlaying;

              setIsPlaying(
                data.isPlaying
              );

              const activeSong =
                currentSongRef.current;

              if (
                activeSong &&
                Number.isFinite(
                  data.duration
                ) &&
                data.duration >
                  0
              ) {
                updateSongDuration(
                  activeSong.id,
                  data.duration
                );
              }
            }
          )) as NativeListenerHandle;

        if (disposed) {
          await progressHandle.remove();
          return;
        }

        handles.push(
          progressHandle
        );

        const preparedHandle =
          (await AudioPlayer.addListener(
            "prepared",
            (
              data
            ) => {
              if (
                disposed
              ) {
                return;
              }

              const activeSong =
                currentSongRef.current;

              if (
                activeSong &&
                Number.isFinite(
                  data.duration
                ) &&
                data.duration >
                  0
              ) {
                updateSongDuration(
                  activeSong.id,
                  data.duration
                );
              }
            }
          )) as NativeListenerHandle;

        if (disposed) {
          await preparedHandle.remove();
          return;
        }

        handles.push(
          preparedHandle
        );

        const mediaItemHandle =
          (await AudioPlayer.addListener(
            "mediaItemChanged",
            (
              data
            ) => {
              if (
                disposed
              ) {
                return;
              }

              const transitionedSong =
                songsRef.current.find(
                  (
                    song:
                      Song
                  ) =>
                    (
                      Boolean(
                        data.id
                      ) &&
                      song.id ===
                        data.id
                    ) ||
                    (
                      Boolean(
                        data.uri
                      ) &&
                      song.uri ===
                        data.uri
                    )
                );

              if (
                !transitionedSong
              ) {
                return;
              }

              const previousSongId =
                currentSongRef.current
                  ?.id;

              const resolvedDuration =
                Number.isFinite(
                  data.duration
                ) &&
                data.duration >
                  0
                  ? data.duration
                  : transitionedSong
                      .duration;

              const nextSong:
                Song = {
                  ...transitionedSong,
                  duration:
                    resolvedDuration,
              };

              currentSongRef.current =
                nextSong;

              setCurrentSong(
                nextSong
              );

              setProgress(
                Number.isFinite(
                  data.position
                )
                  ? Math.max(
                      0,
                      data.position
                    )
                  : 0
              );

              isPlayingRef.current =
                data.isPlaying;

              setIsPlaying(
                data.isPlaying
              );

              if (
                resolvedDuration >
                0
              ) {
                updateSongDuration(
                  nextSong.id,
                  resolvedDuration
                );

                void loadLyricsForSong(
                  nextSong,
                  resolvedDuration
                );
              }

              /*
               * A playlist is installed when AudioPlayer.load
               * runs, which can emit a transition for the
               * already-selected item. Count only a genuine
               * move to a different song.
               */
              if (
                previousSongId !==
                  nextSong.id &&
                data.isPlaying
              ) {
                recordSongPlayback(
                  nextSong.id
                );
              }
            }
          )) as NativeListenerHandle;

        if (disposed) {
          await mediaItemHandle.remove();
          return;
        }

        handles.push(
          mediaItemHandle
        );

        const stateHandle =
          (await AudioPlayer.addListener(
            "playbackStateChanged",
            (
              data
            ) => {
              if (
                disposed
              ) {
                return;
              }

              isPlayingRef.current =
                data.isPlaying;

              setIsPlaying(
                data.isPlaying
              );
            }
          )) as NativeListenerHandle;

        if (disposed) {
          await stateHandle.remove();
          return;
        }

        handles.push(
          stateHandle
        );

        const completionHandle =
          (await AudioPlayer.addListener(
            "completed",
            (
              data
            ) => {
              if (
                disposed
              ) {
                return;
              }

              setProgress(
                Number.isFinite(
                  data.duration
                )
                  ? data.duration
                  : 0
              );

              isPlayingRef.current =
                false;

              setIsPlaying(
                false
              );

              playNextRef.current();
            }
          )) as NativeListenerHandle;

        if (disposed) {
          await completionHandle.remove();
          return;
        }

        handles.push(
          completionHandle
        );

        const errorHandle =
          (await AudioPlayer.addListener(
            "error",
            (
              data
            ) => {
              if (
                disposed
              ) {
                return;
              }

              console.error(
                "Native audio player error:",
                data.message,
                data.details ??
                  ""
              );

              isPlayingRef.current =
                false;

              setIsPlaying(
                false
              );
            }
          )) as NativeListenerHandle;

        if (disposed) {
          await errorHandle.remove();
          return;
        }

        handles.push(
          errorHandle
        );
      } catch (error) {
        console.error(
          "Unable to install native audio listeners:",
          error
        );
      }
    }

    void installListeners();

    return () => {
      disposed = true;

      for (
        const handle of
        handles
      ) {
        void handle.remove();
      }
    };
  }, [
    loadLyricsForSong,
    recordSongPlayback,
    updateSongDuration,
  ]);

  const getActiveQueue =
    useCallback(
      (): string[] => {
        const currentSongs =
          songsRef.current;

        const currentQueue =
          queueRef.current;

        const validIds =
          new Set(
            currentSongs.map(
              (
                song:
                  Song
              ) =>
                song.id
            )
          );

        const filteredQueue =
          currentQueue.filter(
            (
              songId:
                string
            ) =>
              validIds.has(
                songId
              )
          );

        if (
          filteredQueue.length >
          0
        ) {
          return filteredQueue;
        }

        return currentSongs.map(
          (
            song:
              Song
          ) =>
            song.id
        );
      },
      []
    );

  const playSongById =
    useCallback(
      (
        songId: string,
        autoPlay:
          boolean = true
      ): void => {
        const selectedSong =
          songsRef.current.find(
            (
              song:
                Song
            ) =>
              song.id ===
              songId
          );

        if (
          !selectedSong
        ) {
          console.warn(
            `Song with ID "${songId}" was not found.`
          );

          return;
        }

        void loadAndPlaySong(
          selectedSong,
          autoPlay
        );
      },
      [loadAndPlaySong]
    );

  const playSong =
    useCallback(
      (
        id: string,
        requestedQueue?:
          string[]
      ): void => {
        const currentSongs =
          songsRef.current;

        const selectedSong =
          currentSongs.find(
            (
              song:
                Song
            ) =>
              song.id === id
          );

        if (
          !selectedSong
        ) {
          console.warn(
            `Song with ID "${id}" was not found.`
          );

          return;
        }

        const availableSongIds =
          new Set(
            currentSongs.map(
              (
                song:
                  Song
              ) =>
                song.id
            )
          );

        const filteredQueue =
          requestedQueue?.filter(
            (
              songId:
                string
            ) =>
              availableSongIds.has(
                songId
              )
          ) ?? [];

        const nextQueue =
          filteredQueue.length >
          0
            ? [
                ...filteredQueue,
              ]
            : currentSongs.map(
                (
                  song:
                    Song
                ) =>
                  song.id
              );

        if (
          !nextQueue.includes(
            id
          )
        ) {
          nextQueue.unshift(
            id
          );
        }

        queueRef.current =
          nextQueue;

        setQueue(
          nextQueue
        );

        void loadAndPlaySong(
          selectedSong,
          true
        );
      },
      [loadAndPlaySong]
    );

  const next =
    useCallback(
      (): void => {
        const currentSongs =
          songsRef.current;

        if (
          currentSongs.length ===
          0
        ) {
          return;
        }

        const activeQueue =
          getActiveQueue();

        if (
          activeQueue.length ===
          0
        ) {
          return;
        }

        const activeSong =
          currentSongRef.current;

        const currentIndex =
          activeSong
            ? activeQueue.indexOf(
                activeSong.id
              )
            : -1;

        const nextIndex =
          currentIndex >= 0
            ? (
                currentIndex +
                1
              ) %
              activeQueue.length
            : 0;

        playSongById(
          activeQueue[
            nextIndex
          ],
          true
        );
      },
      [
        getActiveQueue,
        playSongById,
      ]
    );

  useEffect(() => {
    playNextRef.current =
      next;
  }, [next]);

  const previous =
    useCallback(
      (): void => {
        const activeSong =
          currentSongRef.current;

        if (
          !activeSong
        ) {
          const firstSong =
            songsRef.current[
              0
            ];

          if (
            firstSong
          ) {
            void loadAndPlaySong(
              firstSong,
              true
            );
          }

          return;
        }

        /*
         * Restart the current song
         * when past three seconds.
         */
        if (
          progress > 3
        ) {
          setProgress(0);

          void AudioPlayer.seek(
            {
              position: 0,
            }
          ).catch(
            (
              error
            ) => {
              console.error(
                "Unable to restart song:",
                error
              );
            }
          );

          return;
        }

        const activeQueue =
          getActiveQueue();

        if (
          activeQueue.length ===
          0
        ) {
          return;
        }

        const currentIndex =
          activeQueue.indexOf(
            activeSong.id
          );

        const previousIndex =
          currentIndex >= 0
            ? (
                currentIndex -
                1 +
                activeQueue.length
              ) %
              activeQueue.length
            : 0;

        playSongById(
          activeQueue[
            previousIndex
          ],
          true
        );
      },
      [
        getActiveQueue,
        loadAndPlaySong,
        playSongById,
        progress,
      ]
    );

  const togglePlay =
    useCallback(
      (): void => {
        const activeSong =
          currentSongRef.current;

        if (
          !activeSong
        ) {
          const firstSong =
            songsRef.current[
              0
            ];

          if (
            !firstSong
          ) {
            return;
          }

          const defaultQueue =
            songsRef.current.map(
              (
                song:
                  Song
              ) =>
                song.id
            );

          queueRef.current =
            defaultQueue;

          setQueue(
            defaultQueue
          );

          void loadAndPlaySong(
            firstSong,
            true
          );

          return;
        }

        if (
          isPlayingRef.current
        ) {
          void AudioPlayer.pause()
            .then(
              (
                state
              ) => {
                isPlayingRef.current =
                  false;

                setIsPlaying(
                  false
                );

                if (
                  Number.isFinite(
                    state.position
                  )
                ) {
                  setProgress(
                    state.position
                  );
                }
              }
            )
            .catch(
              (
                error
              ) => {
                console.error(
                  "Unable to pause song:",
                  error
                );
              }
            );

          return;
        }

        /*
         * Resume does not increment
         * the playback counter.
         */
        void AudioPlayer.play()
          .then(
            (
              state
            ) => {
              isPlayingRef.current =
                true;

              setIsPlaying(
                true
              );

              if (
                Number.isFinite(
                  state.position
                )
              ) {
                setProgress(
                  state.position
                );
              }
            }
          )
          .catch(
            (
              error
            ) => {
              console.warn(
                "Unable to resume existing player. Reloading song:",
                error
              );

              void loadAndPlaySong(
                activeSong,
                true
              );
            }
          );
      },
      [loadAndPlaySong]
    );

  const seek =
    useCallback(
      (
        seconds: number
      ): void => {
        const activeSong =
          currentSongRef.current;

        if (
          !activeSong
        ) {
          return;
        }

        const maximum =
          activeSong.duration >
          0
            ? activeSong.duration
            : Number.MAX_SAFE_INTEGER;

        const safeSeconds =
          Math.min(
            Math.max(
              0,
              seconds
            ),
            maximum
          );

        setProgress(
          safeSeconds
        );

        void AudioPlayer.seek(
          {
            position:
              safeSeconds,
          }
        )
          .then(
            (
              result
            ) => {
              if (
                Number.isFinite(
                  result.position
                )
              ) {
                setProgress(
                  result.position
                );
              }

              if (
                Number.isFinite(
                  result.duration
                ) &&
                result.duration >
                  0
              ) {
                updateSongDuration(
                  activeSong.id,
                  result.duration
                );
              }
            }
          )
          .catch(
            (
              error
            ) => {
              console.error(
                "Unable to seek song:",
                error
              );
            }
          );
      },
      [updateSongDuration]
    );

  const setSongVideo =
    useCallback(
      (
        songId: string,
        url: string
      ): void => {
        setSongVideos(
          (
            previousVideos:
              Record<
                string,
                string
              >
          ) => ({
            ...previousVideos,
            [songId]: url,
          })
        );
      },
      []
    );

  const removeSongVideo =
    useCallback(
      (
        songId: string
      ): void => {
        setSongVideos(
          (
            previousVideos:
              Record<
                string,
                string
              >
          ) => {
            const updatedVideos =
              {
                ...previousVideos,
              };

            delete updatedVideos[
              songId
            ];

            return updatedVideos;
          }
        );
      },
      []
    );

  const getVideoForSong =
    useCallback(
      (
        song:
          Song | null
      ): string | undefined => {
        if (
          !song
        ) {
          return undefined;
        }

        /*
         * Cloudinary songs receive their video
         * association from backend catalogue metadata.
         *
         * Local songs continue using the existing
         * VideoStorage-backed per-song mapping.
         */
        if (
          song.source ===
          "cloudinary"
        ) {
          return song.videoUrl;
        }

        return (
          songVideos[
            song.id
          ] ??
          song.videoUrl
        );
      },
      [songVideos]
    );

  const createPlaylist =
    useCallback(
      (
        name: string
      ): void => {
        const trimmedName =
          name.trim();

        if (
          !trimmedName
        ) {
          return;
        }

        const newPlaylist:
          Playlist = {
            id: `playlist-${Date.now()}`,
            name:
              trimmedName,
            songIds: [],
          };

        setPlaylists(
          (
            previousPlaylists:
              Playlist[]
          ) => [
            ...previousPlaylists,
            newPlaylist,
          ]
        );
      },
      []
    );

  const deletePlaylist =
    useCallback(
      (
        id: string
      ): void => {
        setPlaylists(
          (
            previousPlaylists:
              Playlist[]
          ) =>
            previousPlaylists.filter(
              (
                playlist:
                  Playlist
              ) =>
                playlist.id !==
                id
            )
        );
      },
      []
    );

  const addSongsToPlaylist =
    useCallback(
      (
        playlistId:
          string,
        songIds:
          string[]
      ): void => {
        const validSongIds =
          new Set(
            songsRef.current.map(
              (
                song:
                  Song
              ) =>
                song.id
            )
          );

        const newSongIds =
          songIds.filter(
            (
              songId:
                string
            ) =>
              validSongIds.has(
                songId
              )
          );

        if (
          newSongIds.length ===
          0
        ) {
          return;
        }

        setPlaylists(
          (
            previousPlaylists:
              Playlist[]
          ) =>
            previousPlaylists.map(
              (
                playlist:
                  Playlist
              ) => {
                if (
                  playlist.id !==
                  playlistId
                ) {
                  return playlist;
                }

                const nextSongIds =
                  Array.from(
                    new Set([
                      ...playlist.songIds,
                      ...newSongIds,
                    ])
                  );

                if (
                  nextSongIds.length ===
                  playlist.songIds.length
                ) {
                  return playlist;
                }

                const {
                  cover:
                    _unusedCover,
                  ...playlistWithoutCover
                } = playlist;

                return {
                  ...playlistWithoutCover,
                  songIds:
                    nextSongIds,
                };
              }
            )
        );
      },
      []
    );

  const removeSongFromPlaylist =
    useCallback(
      (
        playlistId:
          string,
        songId:
          string
      ): void => {
        setPlaylists(
          (
            previousPlaylists:
              Playlist[]
          ) =>
            previousPlaylists.map(
              (
                playlist:
                  Playlist
              ) => {
                if (
                  playlist.id !==
                  playlistId ||
                  !playlist.songIds.includes(
                    songId
                  )
                ) {
                  return playlist;
                }

                const nextSongIds =
                  playlist.songIds.filter(
                    (
                      existingSongId:
                        string
                    ) =>
                      existingSongId !==
                      songId
                  );

                const {
                  cover:
                    _unusedCover,
                  ...playlistWithoutCover
                } = playlist;

                return {
                  ...playlistWithoutCover,
                  songIds:
                    nextSongIds,
                };
              }
            )
        );
      },
      []
    );

  const addSongToPlaylists =
    useCallback(
      (
        playlistIds:
          string[],
        songId:
          string
      ): void => {
        const selectedPlaylistIds =
          new Set(
            playlistIds
          );

        if (
          selectedPlaylistIds.size ===
            0 ||
          !songsRef.current.some(
            (
              song:
                Song
            ) =>
              song.id ===
              songId
          )
        ) {
          return;
        }

        setPlaylists(
          (
            previousPlaylists:
              Playlist[]
          ) =>
            previousPlaylists.map(
              (
                playlist:
                  Playlist
              ) => {
                if (
                  !selectedPlaylistIds.has(
                    playlist.id
                  ) ||
                  playlist.songIds.includes(
                    songId
                  )
                ) {
                  return playlist;
                }

                const {
                  cover:
                    _unusedCover,
                  ...playlistWithoutCover
                } = playlist;

                return {
                  ...playlistWithoutCover,

                  songIds: [
                    ...playlist.songIds,
                    songId,
                  ],
                };
              }
            )
        );
      },
      []
    );

  const displayedDevices =
    useMemo<
      BluetoothDevice[]
    >(
      () => {
        if (!androidAutoConnected) {
          return devices;
        }

        const androidAutoDevice:
          BluetoothDevice = {
            id: "android-auto",
            name: "Android Auto",
            type: "car",
            connected: true,
            active: true,
            connection:
              "Android Auto",
          };

        return [
          androidAutoDevice,
          ...devices.filter(
            (
              device:
                BluetoothDevice
            ) =>
              device.id !==
              androidAutoDevice.id
          ),
        ];
      },
      [
        androidAutoConnected,
        devices,
      ]
    );

  const connectedDevice =
    useMemo<
      BluetoothDevice | null
    >(
      () =>
        displayedDevices.find(
          (
            device:
              BluetoothDevice
          ) =>
            device.active
        ) ??
        displayedDevices.find(
          (
            device:
              BluetoothDevice
          ) =>
            device.connected
        ) ??
        null,
      [displayedDevices]
    );

  const addSearch =
    useCallback(
      (
        query: string
      ): void => {
        const trimmedQuery =
          query.trim();

        if (
          !trimmedQuery
        ) {
          return;
        }

        setSearchHistory(
          (
            previousHistory:
              string[]
          ) =>
            [
              trimmedQuery,

              ...previousHistory.filter(
                (
                  item:
                    string
                ) =>
                  item.toLowerCase() !==
                  trimmedQuery.toLowerCase()
              ),
            ].slice(0, 5)
        );
      },
      []
    );

  const clearSearchHistory =
    useCallback(
      (): void => {
        setSearchHistory(
          []
        );
      },
      []
    );

  const openPlayer =
    useCallback(
      (): void => {
        setIsPlayerOpen(
          true
        );
      },
      []
    );

  const closePlayer =
    useCallback(
      (): void => {
        setIsFullLyricsOpen(
          false
        );

        setIsPlayerOpen(
          false
        );
      },
      []
    );

  const openFullLyrics =
    useCallback(
      (): void => {
        setIsFullLyricsOpen(
          true
        );
      },
      []
    );

  const closeFullLyrics =
    useCallback(
      (): void => {
        setIsFullLyricsOpen(
          false
        );
      },
      []
    );

  const toggleLikedSong =
    useCallback(
      (
        songId: string
      ): void => {
        setLikedSongIds(
          (current) =>
            current.includes(songId)
              ? current.filter(
                  (id) =>
                    id !== songId
                )
              : [
                  ...current,
                  songId,
                ]
        );
      },
      []
    );

  const value =
    useMemo<
      PlayerContextValue
    >(
      () => ({
        songs,
        isLoadingSongs,
        scanSongs,

        currentSong,
        isPlaying,
        progress,
        queue,

        playSong,
        togglePlay,
        next,
        previous,
        seek,

        recentlyPlayedIds,
        playCounts,

        isPlayerOpen,
        openPlayer,
        closePlayer,

        isFullLyricsOpen,
        openFullLyrics,
        closeFullLyrics,

        lyricsOn,
        setLyricsOn,

        videoBackgroundOn,
        setVideoBackgroundOn,

        songVideos,
        setSongVideo,
        removeSongVideo,
        getVideoForSong,

        playlists,
        createPlaylist,
        deletePlaylist,
        addSongsToPlaylist,
        removeSongFromPlaylist,
        addSongToPlaylists,

        likedSongIds,
        toggleLikedSong,

        devices:
          displayedDevices,
        refreshAudioOutputs,
        connectedDevice,

        searchHistory,
        addSearch,
        clearSearchHistory,
      }),
      [
        songs,
        isLoadingSongs,
        scanSongs,

        currentSong,
        isPlaying,
        progress,
        queue,

        playSong,
        togglePlay,
        next,
        previous,
        seek,

        recentlyPlayedIds,
        playCounts,

        isPlayerOpen,
        openPlayer,
        closePlayer,

        isFullLyricsOpen,
        openFullLyrics,
        closeFullLyrics,

        lyricsOn,
        videoBackgroundOn,

        songVideos,
        setSongVideo,
        removeSongVideo,
        getVideoForSong,

        playlists,
        createPlaylist,
        deletePlaylist,
        addSongsToPlaylist,
        removeSongFromPlaylist,
        addSongToPlaylists,

        likedSongIds,
        toggleLikedSong,

        displayedDevices,
        refreshAudioOutputs,
        connectedDevice,

        searchHistory,
        addSearch,
        clearSearchHistory,
      ]
    );

  return (
    <PlayerContext.Provider
      value={value}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer():
  PlayerContextValue {
  const context =
    useContext(
      PlayerContext
    );

  if (!context) {
    throw new Error(
      "usePlayer must be used within PlayerProvider"
    );
  }

  return context;
}