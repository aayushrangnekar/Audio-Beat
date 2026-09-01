import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ClockIcon,
  ListMusicIcon,
  MusicIcon,
  SearchIcon,
  UserIcon,
  XIcon,
} from "lucide-react";

import {
  AnimatePresence,
  motion,
} from "framer-motion";

import { LikeToggleButton } from "../components/LikeToggleButton";
import { ProfileMenu } from "../components/ProfileMenu";
import { SettingsScreen } from "../components/SettingsScreen";
import { SongRow } from "../components/SongRow";
import { usePlayer } from "../context/PlayerContext";

export function Search() {
  const {
    songs,
    playlists,
    playSong,
    searchHistory,
    addSearch,
    clearSearchHistory,
    isLoadingSongs,
  } = usePlayer();

  const [query, setQuery] =
    useState<string>("");

  const [focused, setFocused] =
    useState<boolean>(false);

  const [
    stableViewportHeight,
    setStableViewportHeight,
  ] = useState<number>(
    () =>
      typeof window !== "undefined"
        ? window.innerHeight
        : 0
  );

  const [
    profileOpen,
    setProfileOpen,
  ] = useState<boolean>(false);

  const [
    settingsOpen,
    setSettingsOpen,
  ] = useState<boolean>(false);

  const normalizedQuery =
    query.trim().toLowerCase();

  useEffect(() => {
    function handleResize(): void {
      if (focused) {
        return;
      }

      setStableViewportHeight(
        window.innerHeight
      );
    }

    window.addEventListener(
      "resize",
      handleResize
    );

    return () => {
      window.removeEventListener(
        "resize",
        handleResize
      );
    };
  }, [focused]);

  /*
   * PlayerContext already merges Local Files
   * and Cloudinary songs into one catalogue.
   * Searching `songs` therefore searches both
   * sources without a second network request.
   */
  const results = useMemo(() => {
    if (!normalizedQuery) {
      return [];
    }

    return songs.filter((song) => {
      const title =
        song.title?.toLowerCase() || "";

      const artist =
        song.artist?.toLowerCase() || "";

      const album =
        song.album?.toLowerCase() || "";

      return (
        title.includes(normalizedQuery) ||
        artist.includes(normalizedQuery) ||
        album.includes(normalizedQuery)
      );
    });
  }, [normalizedQuery, songs]);

  const resultQueue = useMemo(
    () => results.map((song) => song.id),
    [results]
  );

  const cloudinarySongs =
    useMemo(
      () =>
        songs
          .filter(
            (song) =>
              song.source ===
              "cloudinary"
          )
          .sort(
            (left, right) =>
              left.title.localeCompare(
                right.title,
                undefined,
                {
                  numeric: true,
                  sensitivity: "base",
                }
              )
          ),
      [songs]
    );

  const cloudinaryQueue =
    useMemo(
      () =>
        cloudinarySongs.map(
          (song) => song.id
        ),
      [cloudinarySongs]
    );

  const playlistResults = useMemo(() => {
    if (!normalizedQuery) {
      return [];
    }

    return playlists.filter((playlist) =>
      playlist.name
        .trim()
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [normalizedQuery, playlists]);

  const songsById = useMemo(
    () =>
      new Map(
        songs.map((song) => [
          song.id,
          song,
        ])
      ),
    [songs]
  );

  const totalResultCount =
    results.length +
    playlistResults.length;

  function handlePlayPlaylist(
    playlistId: string
  ): void {
    const playlist =
      playlists.find(
        (item) =>
          item.id === playlistId
      );

    if (!playlist) {
      return;
    }

    const queue =
      playlist.songIds.filter(
        (songId) =>
          songsById.has(songId)
      );

    const firstSongId =
      queue[0];

    if (!firstSongId) {
      return;
    }

    playSong(
      firstSongId,
      queue
    );
  }

  const showHistory =
    focused && !normalizedQuery;

  function saveCurrentSearch(): void {
    const trimmedQuery = query.trim();

    if (trimmedQuery) {
      addSearch(trimmedQuery);
    }
  }

  function handleSearchBlur(): void {
    saveCurrentSearch();

    window.setTimeout(() => {
      setFocused(false);
    }, 150);
  }

  function handleSearchKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>
  ): void {
    if (event.key !== "Enter") {
      return;
    }

    saveCurrentSearch();
    event.currentTarget.blur();
  }

  function handleHistorySelection(
    history: string
  ): void {
    setQuery(history);
    addSearch(history);
  }

  function handleClearQuery(): void {
    setQuery("");
    setFocused(true);
  }

  return (
    <div className="min-h-full pb-4">
      <header className="bg-[#121212] px-4 pb-3 pt-5">
        <div className="mb-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() =>
              setProfileOpen(true)
            }
            aria-label="Open profile menu"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/10 ring-2 ring-white/10 transition hover:bg-white/15 hover:ring-white/20 active:scale-95"
          >
            <UserIcon
              size={21}
              className="text-white"
            />
          </button>

          <h1 className="min-w-0 flex-1 truncate text-2xl font-extrabold text-white">
            Search
          </h1>
        </div>

        <div className="flex items-center gap-2 rounded-md bg-white px-3 py-2.5">
          <SearchIcon
            size={20}
            className="flex-shrink-0 text-black"
          />

          <input
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
            onFocus={() =>
              setFocused(true)
            }
            onBlur={handleSearchBlur}
            onKeyDown={
              handleSearchKeyDown
            }
            placeholder="What do you want to listen to?"
            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-black placeholder:text-neutral-500 focus:outline-none"
            aria-label="Search songs"
            autoComplete="off"
            spellCheck={false}
          />

          {query ? (
            <button
              type="button"
              onMouseDown={(event) =>
                event.preventDefault()
              }
              onClick={
                handleClearQuery
              }
              aria-label="Clear search"
              className="rounded-full p-1 text-black transition hover:bg-black/10 active:scale-95"
            >
              <XIcon size={18} />
            </button>
          ) : null}
        </div>
      </header>

      <div className="px-4 pt-2">
        <AnimatePresence mode="wait">
          {showHistory ? (
            <motion.div
              key="history"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {searchHistory.length > 0 ? (
                <div className="pt-1">
                  <h2 className="mb-1 text-sm font-bold text-white">
                    Recents
                  </h2>

                  <ul>
                    {searchHistory.map(
                      (history) => (
                        <li key={history}>
                          <button
                            type="button"
                            onMouseDown={(
                              event
                            ) =>
                              event.preventDefault()
                            }
                            onClick={() =>
                              handleHistorySelection(
                                history
                              )
                            }
                            className="flex w-full items-center gap-3 rounded-md py-2.5 text-left transition-colors hover:bg-white/5 active:bg-white/10"
                          >
                            <ClockIcon
                              size={18}
                              className="flex-shrink-0 text-neutral-500"
                            />

                            <span className="min-w-0 flex-1 truncate text-sm text-white">
                              {history}
                            </span>
                          </button>
                        </li>
                      )
                    )}
                  </ul>

                  <div className="flex justify-center pb-3 pt-3">
                    <button
                      type="button"
                      onMouseDown={(event) =>
                        event.preventDefault()
                      }
                      onClick={
                        clearSearchHistory
                      }
                      className="rounded-full border border-white/20 px-5 py-2 text-xs font-bold text-white transition hover:bg-white/10 active:scale-95"
                      aria-label="Clear recent searches"
                    >
                      Clear recent searches
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="flex flex-col items-center justify-center px-4 pb-10 text-center"
                  style={{
                    minHeight:
                      stableViewportHeight > 0
                        ? `${stableViewportHeight * 0.58}px`
                        : "58vh",
                  }}
                >
                  <p className="text-xl font-extrabold text-white">
                    Play what you love
                  </p>

                  <p className="mt-2 text-sm text-neutral-400">
                    Search for artists, songs, albums, playlists and more.
                  </p>
                </div>
              )}
            </motion.div>
          ) : normalizedQuery ? (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {!isLoadingSongs ? (
                <div className="mb-1 mt-3 flex justify-end">
                  <span className="text-xs text-neutral-500">
                    {totalResultCount}{" "}
                    {totalResultCount === 1
                      ? "result"
                      : "results"}
                  </span>
                </div>
              ) : null}

              {isLoadingSongs ? (
                <div className="mt-4 space-y-2">
                  {Array.from({
                    length: 5,
                  }).map((_, index) => (
                    <div
                      key={`search-shimmer-${index}`}
                      className="relative flex items-center gap-3 overflow-hidden rounded-md p-2"
                    >
                      <div className="h-12 w-12 flex-shrink-0 rounded bg-white/[0.08]" />

                      <div className="min-w-0 flex-1">
                        <div className="h-3.5 w-[68%] rounded-full bg-white/[0.08]" />
                        <div className="mt-2 h-3 w-[45%] rounded-full bg-white/[0.06]" />
                      </div>

                      <motion.div
                        className="pointer-events-none absolute inset-y-0 w-28 bg-gradient-to-r from-transparent via-white/[0.09] to-transparent"
                        initial={{
                          x: "-180%",
                        }}
                        animate={{
                          x: "520%",
                        }}
                        transition={{
                          duration: 1.35,
                          repeat: Infinity,
                          repeatDelay: 0.25,
                          ease: "linear",
                          delay:
                            index * 0.06,
                        }}
                      />
                    </div>
                  ))}
                </div>
              ) : totalResultCount > 0 ? (
                <div>
                  {playlistResults.length > 0 ? (
                    <section className="mb-5">
                      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">
                        Playlists
                      </h3>

                      <div className="space-y-1">
                        {playlistResults.map(
                          (playlist) => {
                            const availableSongCount =
                              playlist.songIds.filter(
                                (songId) =>
                                  songsById.has(
                                    songId
                                  )
                              ).length;

                            return (
                              <button
                                key={
                                  playlist.id
                                }
                                type="button"
                                onClick={() =>
                                  handlePlayPlaylist(
                                    playlist.id
                                  )
                                }
                                disabled={
                                  availableSongCount ===
                                  0
                                }
                                className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition hover:bg-white/5 active:bg-white/10 disabled:cursor-default disabled:opacity-60"
                                aria-label={`Play playlist ${playlist.name}`}
                              >
                                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md bg-white/10 text-white">
                                  <ListMusicIcon
                                    size={22}
                                  />
                                </span>

                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-semibold text-white">
                                    {
                                      playlist.name
                                    }
                                  </span>

                                  <span className="block truncate text-xs text-neutral-500">
                                    Playlist •{" "}
                                    {
                                      availableSongCount
                                    }{" "}
                                    {availableSongCount ===
                                    1
                                      ? "song"
                                      : "songs"}
                                  </span>
                                </span>
                              </button>
                            );
                          }
                        )}
                      </div>
                    </section>
                  ) : null}

                  {results.length > 0 ? (
                    <section>
                      {playlistResults.length >
                      0 ? (
                        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">
                          Songs
                        </h3>
                      ) : null}

                      <div className="space-y-1">
                        {results.map(
                          (song) => {
                            const artist =
                              song.artist?.trim() ||
                              "Unknown artist";

                            const subtitle =
                              song.album?.trim()
                                ? `${artist} • ${song.album}`
                                : artist;

                            return (
                              <div
                                key={
                                  song.id
                                }
                                onClick={() =>
                                  addSearch(
                                    song.title
                                  )
                                }
                                className="flex items-center gap-1"
                              >
                                <div className="min-w-0 flex-1">
                                  <SongRow
                                    song={
                                      song
                                    }
                                    queue={
                                      resultQueue
                                    }
                                    subtitle={
                                      subtitle
                                    }
                                  />
                                </div>

                                <LikeToggleButton
                                  songId={
                                    song.id
                                  }
                                  className="mr-1"
                                />
                              </div>
                            );
                          }
                        )}
                      </div>
                    </section>
                  ) : null}
                </div>
              ) : (
                <div className="mt-8 text-center">
                  <SearchIcon
                    size={32}
                    className="mx-auto text-neutral-600"
                  />

                  <p className="mt-3 text-sm font-semibold text-white">
                    No results found
                  </p>

                  <p className="mt-1 text-xs text-neutral-500">
                    Nothing in your music matches{" "}
                    <span className="font-semibold text-neutral-400">
                      “{query.trim()}”
                    </span>
                    .
                  </p>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="cloud-catalogue"
              initial={{
                opacity: 0,
              }}
              animate={{
                opacity: 1,
              }}
              exit={{
                opacity: 0,
              }}
            >
              {isLoadingSongs &&
              cloudinarySongs.length ===
                0 ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-7 pb-4 pt-3">
                  {Array.from({
                    length: 6,
                  }).map((_, index) => (
                    <div
                      key={`catalogue-shimmer-${index}`}
                      className="min-w-0"
                    >
                      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-white/[0.07] ring-1 ring-white/[0.06]">
                        <motion.div
                          className="pointer-events-none absolute inset-y-0 w-32 bg-gradient-to-r from-transparent via-white/[0.10] to-transparent"
                          initial={{
                            x: "-160%",
                          }}
                          animate={{
                            x: "420%",
                          }}
                          transition={{
                            duration: 1.45,
                            repeat: Infinity,
                            repeatDelay: 0.3,
                            ease: "linear",
                            delay:
                              index * 0.07,
                          }}
                        />
                      </div>

                      <div className="mx-auto mt-3 h-3.5 w-[72%] rounded-full bg-white/[0.08]" />
                      <div className="mx-auto mt-2 h-3 w-[48%] rounded-full bg-white/[0.06]" />
                    </div>
                  ))}
                </div>
              ) : cloudinarySongs.length ===
                0 ? (
                <div className="flex min-h-[45vh] flex-col items-center justify-center px-6 text-center">
                  <MusicIcon
                    size={42}
                    className="text-neutral-600"
                  />

                  <h2 className="mt-4 text-lg font-bold text-white">
                    No songs available
                  </h2>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-4 gap-y-7 pb-4 pt-3">
                  {cloudinarySongs.map(
                    (song) => (
                      <button
                        key={song.id}
                        type="button"
                        onClick={() =>
                          playSong(
                            song.id,
                            cloudinaryQueue
                          )
                        }
                        aria-label={`Play ${song.title}`}
                        className="min-w-0 text-left outline-none transition active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-white/40"
                      >
                        <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-white/[0.07] shadow-[0_14px_34px_rgba(0,0,0,0.35)] ring-1 ring-white/[0.06]">
                          {song.albumArt ? (
                            <img
                              src={
                                song.albumArt
                              }
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/[0.08] to-white/[0.025] text-neutral-300">
                              <MusicIcon
                                size={42}
                              />
                            </div>
                          )}
                        </div>

                        <div className="mt-2 min-w-0 text-center">
                          <p
                            className="truncate text-sm font-bold leading-5 text-white"
                            title={
                              song.title
                            }
                          >
                            {song.title}
                          </p>

                          <p className="truncate text-xs leading-5 text-neutral-400">
                            {song.artist ||
                              "Unknown artist"}
                          </p>
                        </div>
                      </button>
                    )
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ProfileMenu
        open={profileOpen}
        onClose={() =>
          setProfileOpen(false)
        }
        onOpenSettings={() => {
          setProfileOpen(false);
          setSettingsOpen(true);
        }}
      />

      <AnimatePresence>
        {settingsOpen ? (
          <SettingsScreen
            onBack={() =>
              setSettingsOpen(false)
            }
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}