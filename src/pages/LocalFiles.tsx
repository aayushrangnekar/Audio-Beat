import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  motion,
} from "framer-motion";

import {
  ArrowLeftIcon,
  CheckIcon,
  MusicIcon,
  RefreshCwIcon,
} from "lucide-react";

import { toast } from "sonner";

import {
  ALPHABETICAL_INDEX_LETTERS,
  AlphabeticalIndex,
  AlphabeticalIndexLetter,
  getAlphabeticalIndexLetter,
} from "../components/AlphabeticalIndex";
import { SongRow } from "../components/SongRow";
import { usePlayer } from "../context/PlayerContext";

interface LocalFilesProps {
  onBack: () => void;

  /*
   * Normal mode shows and plays local songs.
   * Selection mode allows adding multiple songs.
   */
  selectionMode?: boolean;
  playlistId?: string;
}

export function LocalFiles({
  onBack,
  selectionMode = false,
  playlistId,
}: LocalFilesProps) {
  const {
    songs,
    playlists,
    isLoadingSongs,
    scanSongs,
    addSongsToPlaylist,
  } = usePlayer();

  const [isRefreshing, setIsRefreshing] =
    useState<boolean>(false);

  const [
    selectedSongIds,
    setSelectedSongIds,
  ] = useState<Set<string>>(
    () => new Set()
  );

  /*
   * Normal mode is strictly the Local Files folder.
   *
   * Selection mode is the playlist "Add songs" screen, so it
   * intentionally includes both local and Cloudinary songs.
   */
  const visibleSongs = useMemo(
    () =>
      selectionMode
        ? songs
        : songs.filter(
            (song) =>
              song.source !== "cloudinary"
          ),
    [selectionMode, songs]
  );

  const sortedSongs = useMemo(
    () =>
      [...visibleSongs].sort((left, right) =>
        left.title.localeCompare(
          right.title,
          undefined,
          {
            numeric: true,
            sensitivity: "base",
          }
        )
      ),
    [visibleSongs]
  );

  const groupedSongs = useMemo(() => {
    const groups = new Map<
      AlphabeticalIndexLetter,
      typeof visibleSongs
    >();

    sortedSongs.forEach((song) => {
      const letter =
        getAlphabeticalIndexLetter(
          song.title
        );

      const existing =
        groups.get(letter);

      if (existing) {
        existing.push(song);
      } else {
        groups.set(letter, [song]);
      }
    });

    return ALPHABETICAL_INDEX_LETTERS
      .filter((letter) =>
        groups.has(letter)
      )
      .map((letter) => ({
        letter,
        songs:
          groups.get(letter) ?? [],
      }));
  }, [sortedSongs, visibleSongs]);

  const availableLetters = useMemo(
    () =>
      new Set<AlphabeticalIndexLetter>(
        groupedSongs.map(
          (group) => group.letter
        )
      ),
    [groupedSongs]
  );

  const songQueue = useMemo(
    () =>
      sortedSongs.map(
        (song) => song.id
      ),
    [sortedSongs]
  );

  const pageRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const sectionRefs =
    useRef<
      Partial<
        Record<
          AlphabeticalIndexLetter,
          HTMLElement
        >
      >
    >({});

  const [
    activeLetter,
    setActiveLetter,
  ] =
    useState<AlphabeticalIndexLetter>(
      "#"
    );

  const targetPlaylist = useMemo(
    () =>
      playlists.find(
        (playlist) =>
          playlist.id === playlistId
      ) ?? null,
    [playlistId, playlists]
  );

  const songsAlreadyInPlaylist =
    useMemo(
      () =>
        new Set(
          targetPlaylist?.songIds ?? []
        ),
      [targetPlaylist]
    );

  const selectableSongCount =
    visibleSongs.filter(
      (song) =>
        !songsAlreadyInPlaylist.has(
          song.id
        )
    ).length;

  async function handleRefresh(): Promise<void> {
    if (isRefreshing || isLoadingSongs) {
      return;
    }

    try {
      setIsRefreshing(true);
      await scanSongs();
    } finally {
      setIsRefreshing(false);
    }
  }

  function handleSelectionChange(
    songId: string,
    nextSelected: boolean
  ): void {
    if (
      songsAlreadyInPlaylist.has(songId)
    ) {
      return;
    }

    setSelectedSongIds((current) => {
      const next = new Set(current);

      if (nextSelected) {
        next.add(songId);
      } else {
        next.delete(songId);
      }

      return next;
    });
  }

  function handleSelectAll(): void {
    if (
      selectedSongIds.size ===
      selectableSongCount
    ) {
      setSelectedSongIds(new Set());
      return;
    }

    setSelectedSongIds(
      new Set(
        visibleSongs
          .filter(
            (song) =>
              !songsAlreadyInPlaylist.has(
                song.id
              )
          )
          .map((song) => song.id)
      )
    );
  }

  function handleAddSelectedSongs(): void {
    if (
      !playlistId ||
      selectedSongIds.size === 0
    ) {
      return;
    }

    const selectedIds =
      Array.from(selectedSongIds);

    addSongsToPlaylist(
      playlistId,
      selectedIds
    );

    toast.success(
      selectedIds.length === 1
        ? "Added 1 song to playlist"
        : `Added ${selectedIds.length} songs to playlist`
    );

    setSelectedSongIds(new Set());
    onBack();
  }

  const updateActiveLetter =
    useCallback((): void => {
      const page = pageRef.current;

      if (!page) {
        return;
      }

      const scrollContainer =
        page.parentElement;

      const threshold =
        (scrollContainer?.getBoundingClientRect()
          .top ?? 0) + 92;

      let nextLetter =
        groupedSongs[0]?.letter ?? "#";

      groupedSongs.forEach(
        ({ letter }) => {
          const section =
            sectionRefs.current[
              letter
            ];

          if (
            section &&
            section.getBoundingClientRect()
              .top <= threshold
          ) {
            nextLetter = letter;
          }
        }
      );

      setActiveLetter(nextLetter);
    }, [groupedSongs]);

  useEffect(() => {
    const page = pageRef.current;
    const scrollContainer =
      page?.parentElement;

    if (!scrollContainer) {
      return;
    }

    updateActiveLetter();

    scrollContainer.addEventListener(
      "scroll",
      updateActiveLetter,
      {
        passive: true,
      }
    );

    return () => {
      scrollContainer.removeEventListener(
        "scroll",
        updateActiveLetter
      );
    };
  }, [
    groupedSongs,
    updateActiveLetter,
  ]);

  const handleSelectLetter =
    useCallback(
      (
        letter:
          AlphabeticalIndexLetter,
        dragging: boolean
      ): void => {
        const section =
          sectionRefs.current[letter];

        if (!section) {
          return;
        }

        setActiveLetter(letter);

        section.scrollIntoView({
          behavior: dragging
            ? "auto"
            : "smooth",
          block: "start",
        });

        const scrollContainer =
          pageRef.current
            ?.parentElement;

        if (scrollContainer) {
          window.setTimeout(
            () => {
              scrollContainer.scrollBy({
                top: -72,
                behavior: "auto",
              });
            },
            dragging ? 0 : 120
          );
        }
      },
      []
    );

  return (
    <motion.div
      ref={pageRef}
      className="min-h-full bg-[#121212] pb-4"
      initial={{
        opacity: 0,
        x: 24,
      }}
      animate={{
        opacity: 1,
        x: 0,
      }}
      transition={{
        duration: 0.28,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <header className="sticky top-0 z-20 flex items-center gap-3 bg-[#121212]/95 px-3 pb-3 pt-4 backdrop-blur">
        <button
          type="button"
          onClick={onBack}
          aria-label={
            selectionMode
              ? "Back to playlist"
              : "Back to Library"
          }
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/10 active:scale-95"
        >
          <ArrowLeftIcon size={24} />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold text-white">
            {selectionMode
              ? "Add songs"
              : "Local Files"}
          </h1>

          {selectionMode ? (
            <p className="truncate text-xs text-neutral-400">
              {isLoadingSongs
                ? "Scanning device..."
                : selectedSongIds.size > 0
                  ? `${selectedSongIds.size} selected`
                  : `Select songs for ${
                      targetPlaylist?.name ??
                      "playlist"
                    }`}
            </p>
          ) : null}
        </div>

        {selectionMode ? (
          <>
            {selectableSongCount > 0 ? (
              <button
                type="button"
                onClick={handleSelectAll}
                aria-label={
                  selectedSongIds.size ===
                  selectableSongCount
                    ? "Deselect all songs"
                    : "Select all songs"
                }
                className="flex h-10 flex-shrink-0 items-center gap-1 rounded-full px-3 text-xs font-bold text-white transition hover:bg-white/10 active:scale-95"
              >
                <CheckIcon size={17} />

                {selectedSongIds.size ===
                selectableSongCount
                  ? "None"
                  : "All"}
              </button>
            ) : null}

            <button
              type="button"
              onClick={
                handleAddSelectedSongs
              }
              disabled={
                selectedSongIds.size === 0
              }
              className="flex h-10 flex-shrink-0 items-center justify-center rounded-full bg-white px-4 text-sm font-bold text-black transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add
              {selectedSongIds.size > 0
                ? ` (${selectedSongIds.size})`
                : ""}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              void handleRefresh();
            }}
            disabled={
              isRefreshing ||
              isLoadingSongs
            }
            aria-label="Refresh local songs"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-neutral-300 transition hover:bg-white/10 hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RefreshCwIcon
              size={20}
              className={
                isRefreshing ||
                isLoadingSongs
                  ? "animate-spin"
                  : ""
              }
            />
          </button>
        )}
      </header>

      <div className="px-3">
        {isLoadingSongs ? (
          <div className="space-y-2 py-2">
            {Array.from({
              length: 8,
            }).map((_, index) => (
              <div
                key={index}
                className="flex animate-pulse items-center gap-3 rounded-md p-2"
              >
                <div className="h-14 w-14 flex-shrink-0 rounded bg-white/10" />

                <div className="min-w-0 flex-1">
                  <div className="h-4 w-2/3 rounded bg-white/10" />
                  <div className="mt-2 h-3 w-1/2 rounded bg-white/[0.07]" />
                </div>
              </div>
            ))}
          </div>
        ) : visibleSongs.length === 0 ? (
          <div className="flex min-h-[calc(100vh-160px)] flex-col items-center justify-center px-6 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
              <MusicIcon
                size={30}
                className="text-neutral-500"
              />
            </span>

            <h2 className="mt-4 text-lg font-bold text-white">
              No local songs found
            </h2>
          </div>
        ) : selectionMode &&
          selectableSongCount === 0 ? (
          <div className="flex min-h-[55vh] flex-col items-center justify-center px-6 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1DB954]/10">
              <CheckIcon
                size={30}
                className="text-[#1DB954]"
              />
            </span>

            <h2 className="mt-4 text-lg font-bold text-white">
              All songs are already added
            </h2>

            <p className="mt-2 max-w-xs text-sm leading-6 text-neutral-400">
              Every available song is already in
              this playlist.
            </p>
          </div>
        ) : (
          <>
            <div className="pr-7">
              {groupedSongs.map(
                ({
                  letter,
                  songs: groupSongs,
                }) => (
                  <section
                    key={letter}
                    ref={(element) => {
                      if (element) {
                        sectionRefs.current[
                          letter
                        ] = element;
                      } else {
                        delete sectionRefs
                          .current[letter];
                      }
                    }}
                    className="scroll-mt-20"
                    aria-labelledby={`local-files-section-${letter}`}
                  >
                    <div className="px-2 pb-1 pt-2">
                      <h2
                        id={`local-files-section-${letter}`}
                        className="text-xs font-black uppercase tracking-widest text-neutral-400"
                      >
                        {letter}
                      </h2>
                    </div>

                    <div className="space-y-1">
                      {groupSongs.map(
                        (song) => {
                          const alreadyAdded =
                            songsAlreadyInPlaylist.has(
                              song.id
                            );

                          return (
                            <SongRow
                              key={song.id}
                              song={song}
                              queue={songQueue}
                              selectionMode={
                                selectionMode
                              }
                              selected={selectedSongIds.has(
                                song.id
                              )}
                              disabled={
                                selectionMode &&
                                alreadyAdded
                              }
                              onSelectionChange={
                                handleSelectionChange
                              }
                              subtitle={
                                selectionMode &&
                                alreadyAdded
                                  ? "Already in this playlist"
                                  : song.album
                                    ? `${
                                        song.artist ||
                                        "Unknown artist"
                                      } • ${song.album}`
                                    : song.artist ||
                                      "Unknown artist"
                              }
                            />
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
                activeLetter
              }
              availableLetters={
                availableLetters
              }
              onSelectLetter={
                handleSelectLetter
              }
              ariaLabel={
                selectionMode
                  ? "Available songs alphabetical index"
                  : "Local songs alphabetical index"
              }
            />
          </>
        )}
      </div>
    </motion.div>
  );
}