import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ArrowLeftIcon,
  Disc3Icon,
  MusicIcon,
  UserIcon,
} from "lucide-react";

import {
  AnimatePresence,
  motion,
} from "framer-motion";

import {
  ALPHABETICAL_INDEX_LETTERS,
  AlphabeticalIndex,
  AlphabeticalIndexLetter,
  getAlphabeticalIndexLetter,
} from "../components/AlphabeticalIndex";

import {
  ProfileMenu,
} from "../components/ProfileMenu";

import {
  SettingsScreen,
} from "../components/SettingsScreen";

import {
  usePlayer,
} from "../context/PlayerContext";

import type {
  Song,
} from "../types";

interface AlbumItem {
  id: string;
  name: string;
  artwork?: string;
  songs: Song[];
}

export interface AlbumsHandle {
  canGoBack: () => boolean;
  goBack: () => void;
}

function findScrollContainer(
  element: HTMLElement | null
): HTMLElement {
  let current =
    element?.parentElement ?? null;

  while (current) {
    const style =
      window.getComputedStyle(
        current
      );

    const overflowY =
      style.overflowY;

    if (
      (
        overflowY === "auto" ||
        overflowY === "scroll"
      ) &&
      current.scrollHeight >
        current.clientHeight
    ) {
      return current;
    }

    current =
      current.parentElement;
  }

  return (
    document.scrollingElement as HTMLElement
  ) ?? document.documentElement;
}

function normalizeAlbumName(
  value: string | undefined
): string {
  const trimmed =
    value?.trim() ?? "";

  return trimmed ||
    "Unknown album";
}

function createAlbumKey(
  album: string
): string {
  return album
    .trim()
    .toLocaleLowerCase();
}

function formatDuration(
  rawSeconds: number
): string {
  const totalSeconds =
    Number.isFinite(rawSeconds) &&
    rawSeconds > 0
      ? Math.floor(rawSeconds)
      : 0;

  const hours =
    Math.floor(
      totalSeconds / 3600
    );

  const minutes =
    Math.floor(
      (totalSeconds % 3600) /
        60
    );

  const seconds =
    totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(
      minutes
    ).padStart(2, "0")}:${String(
      seconds
    ).padStart(2, "0")}`;
  }

  return `${minutes}:${String(
    seconds
  ).padStart(2, "0")}`;
}

export const Albums =
  forwardRef<AlbumsHandle>(
    function Albums(
      _props,
      ref
    ) {
    const {
      songs,
      playSong,
      isLoadingSongs,
      currentSong,
    } = usePlayer();

    const [
      selectedAlbumId,
      setSelectedAlbumId,
    ] = useState<
      string | null
    >(null);

    const [
      profileOpen,
      setProfileOpen,
    ] = useState<boolean>(
      false
    );

    const [
      settingsOpen,
      setSettingsOpen,
    ] = useState<boolean>(
      false
    );

    const albumGridRef =
      useRef<HTMLDivElement | null>(
        null
      );

    const savedScrollTopRef =
      useRef<number>(
        0
      );

    const savedScrollContainerRef =
      useRef<HTMLElement | null>(
        null
      );

    const shouldRestoreScrollRef =
      useRef<boolean>(
        false
      );

    const [
      failedArtwork,
      setFailedArtwork,
    ] = useState<
      Set<string>
    >(
      () => new Set()
    );

    /*
     * Songs are grouped only by album name.
     *
     * Therefore every song whose album name
     * is the same appears inside one album,
     * even when individual files contain
     * different artist metadata.
     */
    const albums =
      useMemo<AlbumItem[]>(
        () => {
          const grouped =
            new Map<
              string,
              {
                id: string;
                name: string;
                artwork?: string;
                songs: Song[];
              }
            >();

          for (
            const song of songs
          ) {
            const name =
              normalizeAlbumName(
                song.album
              );

            const key =
              createAlbumKey(
                name
              );

            const existing =
              grouped.get(key);

            if (existing) {
              existing.songs.push(
                song
              );

              if (
                !existing.artwork &&
                song.albumArt
              ) {
                existing.artwork =
                  song.albumArt;
              }

              continue;
            }

            grouped.set(
              key,
              {
                id: key,
                name,
                artwork:
                  song.albumArt,
                songs: [song],
              }
            );
          }

          return Array.from(
            grouped.values()
          )
            .map(
              (
                album
              ): AlbumItem => {
                const sortedSongs =
                  [...album.songs].sort(
                    (
                      first,
                      second
                    ) =>
                      first.title.localeCompare(
                        second.title,
                        undefined,
                        {
                          numeric: true,
                          sensitivity:
                            "base",
                        }
                      )
                  );

                return {
                  ...album,
                  songs:
                    sortedSongs,
                };
              }
            )
            .sort(
              (
                first,
                second
              ) =>
                first.name.localeCompare(
                  second.name,
                  undefined,
                  {
                    numeric: true,
                    sensitivity:
                      "base",
                  }
                )
            );
        },
        [songs]
      );

    const groupedAlbums =
      useMemo(() => {
        const groups = new Map<
          AlphabeticalIndexLetter,
          AlbumItem[]
        >();

        albums.forEach(
          (album) => {
            const letter =
              getAlphabeticalIndexLetter(
                album.name
              );

            const existing =
              groups.get(letter);

            if (existing) {
              existing.push(
                album
              );
            } else {
              groups.set(
                letter,
                [album]
              );
            }
          }
        );

        return ALPHABETICAL_INDEX_LETTERS
          .filter((letter) =>
            groups.has(letter)
          )
          .map((letter) => ({
            letter,
            albums:
              groups.get(letter) ?? [],
          }));
      }, [albums]);

    const availableAlbumLetters =
      useMemo(
        () =>
          new Set<AlphabeticalIndexLetter>(
            groupedAlbums.map(
              (group) =>
                group.letter
            )
          ),
        [groupedAlbums]
      );

    const albumSectionRefs =
      useRef<
        Partial<
          Record<
            AlphabeticalIndexLetter,
            HTMLElement
          >
        >
      >({});

    const [
      activeAlbumLetter,
      setActiveAlbumLetter,
    ] =
      useState<AlphabeticalIndexLetter>(
        "#"
      );

    const selectedAlbum =
      useMemo(
        () =>
          selectedAlbumId
            ? albums.find(
                (album) =>
                  album.id ===
                  selectedAlbumId
              ) ?? null
            : null,
        [
          albums,
          selectedAlbumId,
        ]
      );

    function closeAlbum(): void {
      shouldRestoreScrollRef.current =
        true;

      setSelectedAlbumId(
        null
      );
    }

    useImperativeHandle(
      ref,
      () => ({
        canGoBack: () =>
          settingsOpen ||
          profileOpen ||
          selectedAlbumId !==
            null,

        goBack: () => {
          if (settingsOpen) {
            setSettingsOpen(
              false
            );
            return;
          }

          if (profileOpen) {
            setProfileOpen(
              false
            );
            return;
          }

          closeAlbum();
        },
      }),
      [
        profileOpen,
        selectedAlbumId,
        settingsOpen,
      ]
    );

    /*
     * If a rescan removes the selected
     * album, return to the album grid.
     */
    useEffect(() => {
      if (
        selectedAlbumId &&
        !selectedAlbum
      ) {
        setSelectedAlbumId(
          null
        );
      }
    }, [
      selectedAlbum,
      selectedAlbumId,
    ]);

    /*
     * Preserve the album grid's previous scroll position.
     * This works for both the Android hardware Back action
     * and the header Back button because both call
     * closeAlbum().
     */
    useEffect(() => {
      if (
        selectedAlbumId !== null ||
        !shouldRestoreScrollRef.current
      ) {
        return;
      }

      shouldRestoreScrollRef.current =
        false;

      let secondFrame = 0;

      const firstFrame =
        window.requestAnimationFrame(
          () => {
            secondFrame =
              window.requestAnimationFrame(
                () => {
                  const scrollContainer =
                    savedScrollContainerRef.current ??
                    findScrollContainer(
                      albumGridRef.current
                    );

                  scrollContainer.scrollTop =
                    savedScrollTopRef.current;
                }
              );
          }
        );

      return () => {
        window.cancelAnimationFrame(
          firstFrame
        );

        if (secondFrame) {
          window.cancelAnimationFrame(
            secondFrame
          );
        }
      };
    }, [selectedAlbumId]);

    const updateActiveAlbumLetter =
      useCallback((): void => {
        const page =
          albumGridRef.current;

        if (!page) {
          return;
        }

        const scrollContainer =
          page.parentElement;

        const threshold =
          (scrollContainer
            ?.getBoundingClientRect()
            .top ?? 0) + 92;

        let nextLetter =
          groupedAlbums[0]
            ?.letter ?? "#";

        groupedAlbums.forEach(
          ({ letter }) => {
            const section =
              albumSectionRefs.current[
                letter
              ];

            if (
              section &&
              section
                .getBoundingClientRect()
                .top <= threshold
            ) {
              nextLetter =
                letter;
            }
          }
        );

        setActiveAlbumLetter(
          nextLetter
        );
      }, [groupedAlbums]);

    useEffect(() => {
      if (
        selectedAlbumId !==
        null
      ) {
        return;
      }

      const page =
        albumGridRef.current;

      const scrollContainer =
        page?.parentElement;

      if (!scrollContainer) {
        return;
      }

      updateActiveAlbumLetter();

      scrollContainer.addEventListener(
        "scroll",
        updateActiveAlbumLetter,
        {
          passive: true,
        }
      );

      return () => {
        scrollContainer.removeEventListener(
          "scroll",
          updateActiveAlbumLetter
        );
      };
    }, [
      groupedAlbums,
      selectedAlbumId,
      updateActiveAlbumLetter,
    ]);

    const handleSelectAlbumLetter =
      useCallback(
        (
          letter:
            AlphabeticalIndexLetter,
          dragging: boolean
        ): void => {
          const section =
            albumSectionRefs.current[
              letter
            ];

          if (!section) {
            return;
          }

          setActiveAlbumLetter(
            letter
          );

          section.scrollIntoView({
            behavior: dragging
              ? "auto"
              : "smooth",
            block: "start",
          });

          const scrollContainer =
            albumGridRef.current
              ?.parentElement;

          if (scrollContainer) {
            window.setTimeout(
              () => {
                scrollContainer.scrollBy({
                  top: -72,
                  behavior: "auto",
                });
              },
              dragging
                ? 0
                : 120
            );
          }
        },
        []
      );

    function handleArtworkError(
      albumId: string
    ): void {
      setFailedArtwork(
        (
          current
        ) => {
          const next =
            new Set(
              current
            );

          next.add(
            albumId
          );

          return next;
        }
      );
    }

    function handleOpenAlbum(
      album: AlbumItem
    ): void {
      const scrollContainer =
        findScrollContainer(
          albumGridRef.current
        );

      savedScrollContainerRef.current =
        scrollContainer;

      savedScrollTopRef.current =
        scrollContainer.scrollTop;

      shouldRestoreScrollRef.current =
        false;

      setSelectedAlbumId(
        album.id
      );
    }

    function handlePlaySong(
      album: AlbumItem,
      song: Song
    ): void {
      playSong(
        song.id,
        album.songs.map(
          (
            albumSong
          ) => albumSong.id
        )
      );
    }

    if (isLoadingSongs) {
      return (
        <div
          className="min-h-full px-4 pb-6 pt-5"
          aria-label="Loading albums"
          aria-busy="true"
        >
          <div className="animate-pulse">
            <header>
              <div className="h-7 w-28 rounded-md bg-white/10" />

              <div className="mt-2 h-4 w-20 rounded bg-white/[0.07]" />
            </header>

            <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-7">
              {Array.from({
                length: 8,
              }).map(
                (
                  _,
                  index
                ) => (
                  <div
                    key={`album-shimmer-${index}`}
                    className="min-w-0"
                  >
                    <div className="aspect-square w-full rounded-2xl bg-white/10 ring-1 ring-white/[0.05]" />

                    <div className="mt-2 flex justify-center">
                      <div className="h-4 w-3/4 rounded bg-white/[0.08]" />
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      );
    }

    /*
     * Album detail / preview screen.
     */
    if (selectedAlbum) {
      const showArtwork =
        Boolean(
          selectedAlbum.artwork
        ) &&
        !failedArtwork.has(
          selectedAlbum.id
        );

      const albumQueue =
        selectedAlbum.songs.map(
          (song) => song.id
        );

      return (
        <motion.div
          key="album-detail"
          className="min-h-full bg-[#121212] pb-6"
          initial={{
            opacity: 0,
            x: 24,
          }}
          animate={{
            opacity: 1,
            x: 0,
          }}
          exit={{
            opacity: 0,
            x: 24,
          }}
          transition={{
            duration: 0.25,
            ease: [
              0.22,
              1,
              0.36,
              1,
            ],
          }}
        >
          <header className="sticky top-0 z-20 flex items-center gap-3 bg-[#121212]/95 px-3 pb-3 pt-4 backdrop-blur">
            <button
              type="button"
              onClick={closeAlbum}
              aria-label="Back to Albums"
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/10 active:scale-95"
            >
              <ArrowLeftIcon
                size={24}
              />
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-extrabold text-white">
                {selectedAlbum.name}
              </h1>

              <p className="truncate text-xs text-neutral-400">
                {selectedAlbum.songs
                  .length === 1
                  ? "1 song"
                  : `${selectedAlbum.songs.length} songs`}
              </p>
            </div>

            <span
              className="h-10 w-10 flex-shrink-0"
              aria-hidden="true"
            />
          </header>

          <div className="px-4">
            <div className="mx-auto mt-3 w-full max-w-[260px]">
              <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-white/[0.07] shadow-[0_20px_55px_rgba(0,0,0,0.48)] ring-1 ring-white/[0.07]">
                {showArtwork ? (
                  <img
                    src={
                      selectedAlbum.artwork
                    }
                    alt=""
                    onError={() =>
                      handleArtworkError(
                        selectedAlbum.id
                      )
                    }
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/[0.08] to-white/[0.025] text-neutral-300">
                    <MusicIcon
                      size={64}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 text-center">
              <h2 className="text-xl font-extrabold leading-tight text-white">
                {selectedAlbum.name}
              </h2>

            </div>

            <div className="mt-7 border-t border-white/[0.06] pt-2">
              {selectedAlbum.songs.map(
                (
                  song,
                  index
                ) => {
                  const isCurrent =
                    currentSong?.id ===
                    song.id;

                  return (
                    <button
                      key={
                        song.id
                      }
                      type="button"
                      onClick={() =>
                        handlePlaySong(
                          selectedAlbum,
                          song
                        )
                      }
                      aria-label={`Play ${song.title}`}
                      className={`flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left outline-none transition active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-white/30 ${
                        isCurrent
                          ? "bg-white/[0.07]"
                          : "hover:bg-white/[0.04]"
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block truncate text-sm font-semibold ${
                            isCurrent
                              ? "text-white"
                              : "text-neutral-100"
                          }`}
                        >
                          {song.title?.trim() ||
                            `Track ${
                              index + 1
                            }`}
                        </span>
                      </span>

                      <span className="w-12 flex-shrink-0 text-right text-xs tabular-nums text-neutral-500">
                        {formatDuration(
                          song.duration
                        )}
                      </span>
                    </button>
                  );
                }
              )}
            </div>

            <span
              className="sr-only"
              aria-hidden="true"
            >
              Queue contains{" "}
              {albumQueue.length} songs.
            </span>
          </div>
        </motion.div>
      );
    }

    /*
     * Main Albums grid.
     */
    return (
      <motion.div
        ref={albumGridRef}
        key="albums-grid"
        className="min-h-full px-4 pb-6 pt-5"
        initial={{
          opacity: 0,
          x: -18,
        }}
        animate={{
          opacity: 1,
          x: 0,
        }}
        exit={{
          opacity: 0,
          x: -18,
        }}
        transition={{
          duration: 0.25,
          ease: [
            0.22,
            1,
            0.36,
            1,
          ],
        }}
      >
        <header>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                setProfileOpen(
                  true
                )
              }
              aria-label="Open profile menu"
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/10 ring-2 ring-white/10 transition hover:bg-white/15 hover:ring-white/20 active:scale-95"
            >
              <UserIcon
                size={21}
                className="text-white"
              />
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-extrabold text-white">
                Albums
              </h1>
            </div>
          </div>
        </header>

        {albums.length === 0 ? (
          <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
            <Disc3Icon
              size={42}
              className="text-neutral-600"
            />

            <h2 className="mt-4 text-lg font-bold text-white">
              No albums found
            </h2>

            <p className="mt-2 max-w-xs text-sm leading-5 text-neutral-400">
              Albums from Local Files and
              Cloudinary will appear here.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-5 pr-7">
              {groupedAlbums.map(
                ({
                  letter,
                  albums:
                    groupAlbums,
                }) => (
                  <section
                    key={letter}
                    ref={(element) => {
                      if (element) {
                        albumSectionRefs
                          .current[
                            letter
                          ] =
                          element;
                      } else {
                        delete albumSectionRefs
                          .current[
                            letter
                          ];
                      }
                    }}
                    className="scroll-mt-20"
                    aria-labelledby={`albums-section-${letter}`}
                  >
                    <div className="pb-2 pt-2">
                      <h2
                        id={`albums-section-${letter}`}
                        className="text-xs font-black uppercase tracking-widest text-neutral-400"
                      >
                        {letter}
                      </h2>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-7 pb-3">
                      {groupAlbums.map(
                        (album) => {
                          const showArtwork =
                            Boolean(
                              album.artwork
                            ) &&
                            !failedArtwork.has(
                              album.id
                            );

                          return (
                            <button
                              key={
                                album.id
                              }
                              type="button"
                              onClick={() =>
                                handleOpenAlbum(
                                  album
                                )
                              }
                              aria-label={`Open album ${album.name}`}
                              className="min-w-0 text-left outline-none transition active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-white/40"
                            >
                              <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-white/[0.07] shadow-[0_14px_34px_rgba(0,0,0,0.35)] ring-1 ring-white/[0.06]">
                                {showArtwork ? (
                                  <img
                                    src={
                                      album.artwork
                                    }
                                    alt=""
                                    loading="lazy"
                                    onError={() =>
                                      handleArtworkError(
                                        album.id
                                      )
                                    }
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/[0.08] to-white/[0.025] text-neutral-300">
                                    <MusicIcon
                                      size={
                                        42
                                      }
                                    />
                                  </div>
                                )}
                              </div>

                              <div className="mt-2 min-w-0 text-center">
                                <p
                                  className="truncate text-sm font-bold leading-5 text-white"
                                  title={
                                    album.name
                                  }
                                >
                                  {
                                    album.name
                                  }
                                </p>
                              </div>
                            </button>
                          );
                        }
                      )}
                    </div>
                  </section>
                )
              )}
            </div>

            <AlphabeticalIndex
              activeLetter={
                activeAlbumLetter
              }
              availableLetters={
                availableAlbumLetters
              }
              onSelectLetter={
                handleSelectAlbumLetter
              }
              ariaLabel="Albums alphabetical index"
            />
          </>
        )}

        <ProfileMenu
          open={
            profileOpen
          }
          onClose={() =>
            setProfileOpen(
              false
            )
          }
          onOpenSettings={() => {
            setProfileOpen(
              false
            );
            setSettingsOpen(
              true
            );
          }}
        />

        <AnimatePresence>
          {settingsOpen ? (
            <SettingsScreen
              onBack={() =>
                setSettingsOpen(
                  false
                )
              }
            />
          ) : null}
        </AnimatePresence>
      </motion.div>
    );
  });

Albums.displayName =
  "Albums";