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
  AnimatePresence,
  motion,
} from "framer-motion";

import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronRightIcon,
  CloudIcon,
  FolderIcon,
  HeartIcon,
  LayoutGridIcon,
  ListIcon,
  MoreVerticalIcon,
  MusicIcon,
  PlusIcon,
  Trash2Icon,
  UserIcon,
} from "lucide-react";

import { toast } from "sonner";

import {
  ALPHABETICAL_INDEX_LETTERS,
  AlphabeticalIndex,
  AlphabeticalIndexLetter,
  getAlphabeticalIndexLetter,
} from "../components/AlphabeticalIndex";
import { Modal } from "../components/Modal";
import { ProfileMenu } from "../components/ProfileMenu";
import { SettingsScreen } from "../components/SettingsScreen";
import { SongRow } from "../components/SongRow";
import { usePlayer } from "../context/PlayerContext";

type LibraryView =
  | {
      type: "library";
    }
  | {
      type: "liked-songs";
    }
  | {
      type: "playlist";
      playlistId: string;
    }
  | {
      type: "add-songs";
      playlistId: string;
    };

interface LibraryProps {
  onOpenLocalFiles: () => void;
}

export interface LibraryHandle {
  canGoBack: () => boolean;
  goBack: () => void;
}

const LIBRARY_LAYOUT_STORAGE_KEY =
  "music-player-library-layout";

function loadLibraryLayout():
  "list" | "grid" {
  try {
    const savedLayout =
      window.localStorage.getItem(
        LIBRARY_LAYOUT_STORAGE_KEY
      );

    return savedLayout === "grid"
      ? "grid"
      : "list";
  } catch (error) {
    console.error(
      "Unable to load library layout:",
      error
    );

    return "list";
  }
}

export const Library = forwardRef<
  LibraryHandle,
  LibraryProps
>(function Library(
  { onOpenLocalFiles },
  ref
) {
  const {
    songs,
    playlists,
    createPlaylist,
    deletePlaylist,
    addSongsToPlaylist,
    likedSongIds,
    toggleLikedSong,
    isLoadingSongs,
  } = usePlayer();

  const [view, setView] =
    useState<LibraryView>({
      type: "library",
    });

  const [addOpen, setAddOpen] =
    useState<boolean>(false);

  const [createOpen, setCreateOpen] =
    useState<boolean>(false);

  const [
    playlistActionsOpen,
    setPlaylistActionsOpen,
  ] = useState<boolean>(false);

  const [
    deleteConfirmOpen,
    setDeleteConfirmOpen,
  ] = useState<boolean>(false);

  const [
    selectedPlaylistId,
    setSelectedPlaylistId,
  ] = useState<string | null>(null);

  const [name, setName] =
    useState<string>("");

  const [
    profileOpen,
    setProfileOpen,
  ] = useState<boolean>(false);

  const [
    settingsOpen,
    setSettingsOpen,
  ] = useState<boolean>(false);

  const [
    libraryLayout,
    setLibraryLayout,
  ] = useState<"list" | "grid">(
    loadLibraryLayout
  );

  const [
    selectedSongIdsForPlaylist,
    setSelectedSongIdsForPlaylist,
  ] = useState<Set<string>>(
    () => new Set()
  );

  const [
    likedSongActionsOpen,
    setLikedSongActionsOpen,
  ] = useState<boolean>(false);

  const [
    likedPlaylistPickerOpen,
    setLikedPlaylistPickerOpen,
  ] = useState<boolean>(false);

  const [
    selectedLikedSongId,
    setSelectedLikedSongId,
  ] = useState<string | null>(null);

  const [
    likedRemoveMode,
    setLikedRemoveMode,
  ] = useState<boolean>(false);

  const [
    selectedLikedSongIds,
    setSelectedLikedSongIds,
  ] = useState<Set<string>>(
    () => new Set()
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(
        LIBRARY_LAYOUT_STORAGE_KEY,
        libraryLayout
      );
    } catch (error) {
      console.error(
        "Unable to save library layout:",
        error
      );
    }
  }, [libraryLayout]);

  useImperativeHandle(
    ref,
    () => ({
      canGoBack: () =>
        settingsOpen ||
        profileOpen ||
        likedPlaylistPickerOpen ||
        likedSongActionsOpen ||
        likedRemoveMode ||
        deleteConfirmOpen ||
        playlistActionsOpen ||
        createOpen ||
        addOpen ||
        view.type !== "library",

      goBack: () => {
        if (settingsOpen) {
          setSettingsOpen(false);
          return;
        }

        if (profileOpen) {
          setProfileOpen(false);
          return;
        }

        if (likedPlaylistPickerOpen) {
          setLikedPlaylistPickerOpen(false);
          return;
        }

        if (likedSongActionsOpen) {
          setLikedSongActionsOpen(false);
          setSelectedLikedSongId(null);
          return;
        }

        if (likedRemoveMode) {
          setLikedRemoveMode(false);
          setSelectedLikedSongIds(
            new Set()
          );
          return;
        }

        if (deleteConfirmOpen) {
          setDeleteConfirmOpen(false);
          setSelectedPlaylistId(null);
          return;
        }

        if (playlistActionsOpen) {
          setPlaylistActionsOpen(false);
          setSelectedPlaylistId(null);
          return;
        }

        if (createOpen) {
          setName("");
          setCreateOpen(false);
          return;
        }

        if (addOpen) {
          setAddOpen(false);
          return;
        }

        setView((currentView) => {
          if (
            currentView.type ===
            "add-songs"
          ) {
            return {
              type: "playlist",
              playlistId:
                currentView.playlistId,
            };
          }

          if (
            currentView.type ===
              "playlist" ||
            currentView.type ===
              "liked-songs"
          ) {
            return {
              type: "library",
            };
          }

          return currentView;
        });
      },
    }),
    [
      addOpen,
      createOpen,
      deleteConfirmOpen,
      likedPlaylistPickerOpen,
      likedRemoveMode,
      likedSongActionsOpen,
      playlistActionsOpen,
      profileOpen,
      settingsOpen,
      view.type,
    ]
  );

  const [
    failedPlaylistCovers,
    setFailedPlaylistCovers,
  ] = useState<Set<string>>(
    () => new Set()
  );

  const selectedPlaylist = useMemo(
    () =>
      playlists.find(
        (playlist) =>
          playlist.id ===
          selectedPlaylistId
      ) ?? null,
    [playlists, selectedPlaylistId]
  );

  const activePlaylistId =
    view.type === "playlist" ||
    view.type === "add-songs"
      ? view.playlistId
      : null;

  const activePlaylist = useMemo(
    () =>
      playlists.find(
        (playlist) =>
          playlist.id ===
          activePlaylistId
      ) ?? null,
    [activePlaylistId, playlists]
  );

  const activePlaylistSongs =
    useMemo(
      () => {
        if (!activePlaylist) {
          return [];
        }

        const songsById = new Map(
          songs.map((song) => [
            song.id,
            song,
          ])
        );

        return activePlaylist.songIds
          .map((songId) =>
            songsById.get(songId)
          )
          .filter(
            (
              song
            ): song is (typeof songs)[number] =>
              Boolean(song)
          );
      },
      [activePlaylist, songs]
    );

  const localSongs =
    useMemo(
      () =>
        songs.filter(
          (song) =>
            song.source !==
            "cloudinary"
        ),
      [songs]
    );

  const likedSongs =
    useMemo(
      () => {
        const likedIds =
          new Set(
            likedSongIds
          );

        return songs
          .filter((song) =>
            likedIds.has(song.id)
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
          );
      },
      [
        likedSongIds,
        songs,
      ]
    );

  const likedSongsQueue =
    useMemo(
      () =>
        likedSongs.map(
          (song) => song.id
        ),
      [likedSongs]
    );

  const existingPlaylistSongIds =
    useMemo(
      () =>
        new Set(
          activePlaylist?.songIds ??
            []
        ),
      [activePlaylist]
    );

  const songsAvailableToAdd =
    useMemo(
      () =>
        songs
          .filter(
            (song) =>
              !existingPlaylistSongIds.has(
                song.id
              )
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
      [
        existingPlaylistSongIds,
        songs,
      ]
    );

  const sortedActivePlaylistSongs =
    useMemo(
      () =>
        [...activePlaylistSongs].sort(
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
      [activePlaylistSongs]
    );

  const groupedActivePlaylistSongs =
    useMemo(() => {
      const groups = new Map<
        AlphabeticalIndexLetter,
        typeof activePlaylistSongs
      >();

      sortedActivePlaylistSongs.forEach(
        (song) => {
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
        }
      );

      return ALPHABETICAL_INDEX_LETTERS
        .filter((letter) =>
          groups.has(letter)
        )
        .map((letter) => ({
          letter,
          songs:
            groups.get(letter) ?? [],
        }));
    }, [
      activePlaylistSongs,
      sortedActivePlaylistSongs,
    ]);

  const availableActivePlaylistLetters =
    useMemo(
      () =>
        new Set<AlphabeticalIndexLetter>(
          groupedActivePlaylistSongs.map(
            (group) => group.letter
          )
        ),
      [groupedActivePlaylistSongs]
    );

  const activePlaylistQueue =
    useMemo(
      () =>
        sortedActivePlaylistSongs.map(
          (song) => song.id
        ),
      [sortedActivePlaylistSongs]
    );

  const playlistPageRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const playlistSongSectionRefs =
    useRef<
      Partial<
        Record<
          AlphabeticalIndexLetter,
          HTMLElement
        >
      >
    >({});

  const [
    activePlaylistSongLetter,
    setActivePlaylistSongLetter,
  ] = useState<AlphabeticalIndexLetter>(
    "#"
  );

  useEffect(() => {
    if (
      (
        view.type === "playlist" ||
        view.type === "add-songs"
      ) &&
      !activePlaylist
    ) {
      setView({
        type: "library",
      });
    }
  }, [activePlaylist, view.type]);

  const updateActivePlaylistSongLetter =
    useCallback((): void => {
      if (view.type !== "playlist") {
        return;
      }

      const page =
        playlistPageRef.current;

      if (!page) {
        return;
      }

      const scrollContainer =
        page.parentElement;

      const threshold =
        (scrollContainer
          ?.getBoundingClientRect().top ??
          0) + 92;

      let nextLetter =
        groupedActivePlaylistSongs[0]
          ?.letter ?? "#";

      groupedActivePlaylistSongs.forEach(
        ({ letter }) => {
          const section =
            playlistSongSectionRefs.current[
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

      setActivePlaylistSongLetter(
        nextLetter
      );
    }, [
      groupedActivePlaylistSongs,
      view.type,
    ]);

  useEffect(() => {
    if (view.type !== "playlist") {
      return;
    }

    const page =
      playlistPageRef.current;

    const scrollContainer =
      page?.parentElement;

    if (!scrollContainer) {
      return;
    }

    updateActivePlaylistSongLetter();

    scrollContainer.addEventListener(
      "scroll",
      updateActivePlaylistSongLetter,
      { passive: true }
    );

    return () => {
      scrollContainer.removeEventListener(
        "scroll",
        updateActivePlaylistSongLetter
      );
    };
  }, [
    groupedActivePlaylistSongs,
    updateActivePlaylistSongLetter,
    view.type,
  ]);

  const handleSelectPlaylistSongLetter =
    useCallback(
      (
        letter:
          AlphabeticalIndexLetter,
        dragging: boolean
      ): void => {
        const section =
          playlistSongSectionRefs.current[
            letter
          ];

        if (!section) {
          return;
        }

        setActivePlaylistSongLetter(
          letter
        );

        section.scrollIntoView({
          behavior: dragging
            ? "auto"
            : "smooth",
          block: "start",
        });

        const scrollContainer =
          playlistPageRef.current
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

  function handleCreatePlaylist(): void {
    const trimmedName = name.trim();

    if (!trimmedName) {
      return;
    }

    createPlaylist(trimmedName);

    toast.success(
      `Created “${trimmedName}”`
    );

    setName("");
    setCreateOpen(false);
  }

  function handleCloseCreateModal(): void {
    setName("");
    setCreateOpen(false);
  }

  function handleOpenCreateModal(): void {
    setAddOpen(false);
    setCreateOpen(true);
  }

  function handleOpenPlaylist(
    playlistId: string
  ): void {
    setView({
      type: "playlist",
      playlistId,
    });
  }

  function handleOpenAddSongs(
    playlistId: string
  ): void {
    setSelectedSongIdsForPlaylist(
      new Set()
    );

    setView({
      type: "add-songs",
      playlistId,
    });
  }

  function toggleSongForPlaylist(
    songId: string
  ): void {
    setSelectedSongIdsForPlaylist(
      (current) => {
        const next =
          new Set(current);

        if (next.has(songId)) {
          next.delete(songId);
        } else {
          next.add(songId);
        }

        return next;
      }
    );
  }

  function handleConfirmAddSongs(
    playlistId: string
  ): void {
    const selectedIds =
      Array.from(
        selectedSongIdsForPlaylist
      );

    if (selectedIds.length > 0) {
      addSongsToPlaylist(
        playlistId,
        selectedIds
      );

      toast.success(
        selectedIds.length === 1
          ? "Added 1 song"
          : `Added ${selectedIds.length} songs`
      );
    }

    setSelectedSongIdsForPlaylist(
      new Set()
    );

    setView({
      type: "playlist",
      playlistId,
    });
  }

  function handleOpenPlaylistActions(
    playlistId: string
  ): void {
    setSelectedPlaylistId(playlistId);
    setPlaylistActionsOpen(true);
  }

  function handleClosePlaylistActions(): void {
    setPlaylistActionsOpen(false);

    if (!deleteConfirmOpen) {
      setSelectedPlaylistId(null);
    }
  }

  function handleOpenDeleteConfirmation(): void {
    setPlaylistActionsOpen(false);
    setDeleteConfirmOpen(true);
  }

  function handleCloseDeleteConfirmation(): void {
    setDeleteConfirmOpen(false);
    setSelectedPlaylistId(null);
  }

  function handleDeletePlaylist(): void {
    if (!selectedPlaylist) {
      handleCloseDeleteConfirmation();
      return;
    }

    const playlistName =
      selectedPlaylist.name;

    const deletedPlaylistId =
      selectedPlaylist.id;

    deletePlaylist(deletedPlaylistId);

    setFailedPlaylistCovers(
      (current) => {
        if (
          !current.has(
            deletedPlaylistId
          )
        ) {
          return current;
        }

        const next =
          new Set(current);

        next.delete(
          deletedPlaylistId
        );

        return next;
      }
    );

    if (
      activePlaylistId ===
      deletedPlaylistId
    ) {
      setView({
        type: "library",
      });
    }

    setDeleteConfirmOpen(false);
    setSelectedPlaylistId(null);

    toast.success(
      `Deleted “${playlistName}”`
    );
  }

  function handlePlaylistCoverError(
    playlistId: string
  ): void {
    setFailedPlaylistCovers(
      (current) => {
        const next =
          new Set(current);

        next.add(playlistId);

        return next;
      }
    );
  }

  /*
   * Multi-select screen for both local
   * and Cloudinary songs.
   */
  if (
    view.type === "add-songs"
  ) {
    return (
      <motion.div
        className="min-h-full bg-[#121212] pb-6"
        initial={{
          opacity: 0,
          x: 24,
        }}
        animate={{
          opacity: 1,
          x: 0,
        }}
        transition={{
          duration: 0.25,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <header className="sticky top-0 z-20 flex items-center gap-3 bg-[#121212]/95 px-3 pb-3 pt-4 backdrop-blur">
          <button
            type="button"
            onClick={() => {
              setSelectedSongIdsForPlaylist(
                new Set()
              );

              setView({
                type: "playlist",
                playlistId:
                  view.playlistId,
              });
            }}
            aria-label="Back to playlist"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/10 active:scale-95"
          >
            <ArrowLeftIcon size={24} />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-extrabold text-white">
              Add songs
            </h1>

            <p className="truncate text-xs text-neutral-400">
              Local Files + Cloudinary
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              handleConfirmAddSongs(
                view.playlistId
              )
            }
            disabled={
              selectedSongIdsForPlaylist
                .size === 0
            }
            className="rounded-full bg-white px-4 py-2 text-xs font-extrabold text-black transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-35"
          >
            Add
            {selectedSongIdsForPlaylist
              .size > 0
              ? ` (${selectedSongIdsForPlaylist.size})`
              : ""}
          </button>
        </header>

        <div className="px-3 pt-2">
          {isLoadingSongs ? (
            <p className="px-2 py-6 text-sm text-neutral-500">
              Loading your music...
            </p>
          ) : songsAvailableToAdd.length ===
            0 ? (
            <div className="flex min-h-[45vh] flex-col items-center justify-center px-6 text-center">
              <MusicIcon
                size={38}
                className="text-neutral-600"
              />

              <p className="mt-4 text-sm font-bold text-white">
                All songs are already in this playlist
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {songsAvailableToAdd.map(
                (song) => {
                  const selected =
                    selectedSongIdsForPlaylist.has(
                      song.id
                    );

                  return (
                    <button
                      key={song.id}
                      type="button"
                      onClick={() =>
                        toggleSongForPlaylist(
                          song.id
                        )
                      }
                      className={`flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition ${
                        selected
                          ? "bg-white/[0.10]"
                          : "hover:bg-white/[0.05]"
                      }`}
                      aria-pressed={
                        selected
                      }
                    >
                      <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded bg-white/10">
                        {song.albumArt ? (
                          <img
                            src={
                              song.albumArt
                            }
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : song.source ===
                          "cloudinary" ? (
                          <CloudIcon
                            size={21}
                            className="text-purple-300"
                          />
                        ) : (
                          <MusicIcon
                            size={21}
                            className="text-neutral-400"
                          />
                        )}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-white">
                          {song.title ||
                            "Unknown title"}
                        </span>

                        <span className="block truncate text-xs text-neutral-400">
                          {song.album?.trim()
                            ? `${
                                song.artist ||
                                "Unknown artist"
                              } • ${song.album}`
                            : song.artist ||
                              "Unknown artist"}
                        </span>
                      </span>

                      <span
                        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border ${
                          selected
                            ? "border-white bg-white text-black"
                            : "border-white/25 text-transparent"
                        }`}
                      >
                        <CheckIcon
                          size={15}
                          strokeWidth={3}
                        />
                      </span>
                    </button>
                  );
                }
              )}
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  function handleLikedSongLongPress(
    songId: string
  ): void {
    setSelectedLikedSongId(
      songId
    );
    setLikedSongActionsOpen(
      true
    );
  }

  function handleOpenLikedPlaylistPicker():
    void {
    setLikedSongActionsOpen(
      false
    );
    setLikedPlaylistPickerOpen(
      true
    );
  }

  function handleStartLikedRemoval():
    void {
    const initialSelection =
      new Set<string>();

    if (selectedLikedSongId) {
      initialSelection.add(
        selectedLikedSongId
      );
    }

    setLikedSongActionsOpen(
      false
    );
    setSelectedLikedSongIds(
      initialSelection
    );
    setLikedRemoveMode(true);
  }

  function handleLikedSelectionChange(
    songId: string,
    selected: boolean
  ): void {
    setSelectedLikedSongIds(
      (current) => {
        const next =
          new Set(current);

        if (selected) {
          next.add(songId);
        } else {
          next.delete(songId);
        }

        return next;
      }
    );
  }

  function handleRemoveSelectedLikedSongs():
    void {
    const selectedIds =
      Array.from(
        selectedLikedSongIds
      );

    if (
      selectedIds.length === 0
    ) {
      return;
    }

    selectedIds.forEach(
      (songId) => {
        if (
          likedSongIds.includes(
            songId
          )
        ) {
          toggleLikedSong(
            songId
          );
        }
      }
    );

    toast.success(
      selectedIds.length === 1
        ? "Removed song from Liked Songs"
        : `Removed ${selectedIds.length} songs from Liked Songs`
    );

    setLikedRemoveMode(false);
    setSelectedLikedSongIds(
      new Set()
    );
    setSelectedLikedSongId(
      null
    );
  }

  function handleAddLikedSongToPlaylist(
    playlistId: string
  ): void {
    if (!selectedLikedSongId) {
      return;
    }

    addSongsToPlaylist(
      playlistId,
      [
        selectedLikedSongId,
      ]
    );

    const playlist =
      playlists.find(
        (item) =>
          item.id === playlistId
      );

    toast.success(
      playlist
        ? `Added to ${playlist.name}`
        : "Added to playlist"
    );

    setLikedPlaylistPickerOpen(
      false
    );
    setSelectedLikedSongId(
      null
    );
  }

  /*
   * Liked Songs folder.
   */
  if (
    view.type === "liked-songs"
  ) {
    return (
      <>
        <motion.div
          className="min-h-full bg-[#121212] pb-6"
          initial={{
            opacity: 0,
            x: 24,
          }}
          animate={{
            opacity: 1,
            x: 0,
          }}
          transition={{
            duration: 0.25,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <header className="sticky top-0 z-20 flex items-center gap-3 bg-[#121212]/95 px-3 pb-3 pt-4 backdrop-blur">
            <button
              type="button"
              onClick={() => {
                if (likedRemoveMode) {
                  setLikedRemoveMode(
                    false
                  );
                  setSelectedLikedSongIds(
                    new Set()
                  );
                  return;
                }

                setView({
                  type: "library",
                });
              }}
              aria-label={
                likedRemoveMode
                  ? "Cancel selection"
                  : "Back to Library"
              }
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/10 active:scale-95"
            >
              <ArrowLeftIcon size={24} />
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-extrabold text-white">
                {likedRemoveMode
                  ? `${selectedLikedSongIds.size} selected`
                  : "Liked Songs"}
              </h1>

              {likedRemoveMode ? (
                <p className="truncate text-xs text-neutral-400">
                  Tap songs to select or deselect
                </p>
              ) : null}
            </div>
          </header>

          <div className="px-3 pt-2">
            {isLoadingSongs &&
            likedSongs.length === 0 ? (
              <div className="space-y-2">
                {Array.from({
                  length: 18,
                }).map((_, index) => (
                  <div
                    key={`liked-shimmer-${index}`}
                    className="relative flex items-center gap-3 overflow-hidden rounded-md p-2"
                  >
                    <div className="h-12 w-12 flex-shrink-0 rounded bg-white/[0.08]" />

                    <div className="min-w-0 flex-1">
                      <div className="h-3.5 w-[66%] rounded-full bg-white/[0.08]" />
                      <div className="mt-2 h-3 w-[46%] rounded-full bg-white/[0.06]" />
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
            ) : likedSongs.length === 0 ? (
              <div className="flex min-h-[calc(100dvh-112px)] flex-col items-center justify-center px-6 pb-16 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1DB954]/10">
                  <HeartIcon
                    size={32}
                    className="text-[#1DB954]"
                  />
                </span>

                <h2 className="mt-4 text-lg font-bold text-white">
                  No liked songs yet
                </h2>

                <p className="mt-2 max-w-xs text-sm leading-6 text-neutral-400">
                  Songs you like will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {likedSongs.map(
                  (song) => (
                    <SongRow
                      key={song.id}
                      song={song}
                      queue={
                        likedSongsQueue
                      }
                      subtitle={
                        song.album
                          ? `${
                              song.artist ||
                              "Unknown artist"
                            } • ${song.album}`
                          : song.artist ||
                            "Unknown artist"
                      }
                      selectionMode={
                        likedRemoveMode
                      }
                      selected={
                        selectedLikedSongIds.has(
                          song.id
                        )
                      }
                      onSelectionChange={
                        handleLikedSelectionChange
                      }
                      onLongPress={() =>
                        handleLikedSongLongPress(
                          song.id
                        )
                      }
                    />
                  )
                )}
              </div>
            )}
          </div>

          <AnimatePresence>
            {likedRemoveMode ? (
              <motion.div
                initial={{
                  opacity: 0,
                  y: 24,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                  y: 24,
                }}
                className="sticky bottom-3 z-30 mx-4 mt-5"
              >
                <button
                  type="button"
                  onClick={
                    handleRemoveSelectedLikedSongs
                  }
                  disabled={
                    selectedLikedSongIds.size ===
                    0
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-[#1DB954] px-5 py-3 text-sm font-extrabold text-black shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2Icon
                    size={18}
                  />
                  Remove selected
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>

        <Modal
          open={
            likedSongActionsOpen
          }
          onClose={() => {
            setLikedSongActionsOpen(
              false
            );
            setSelectedLikedSongId(
              null
            );
          }}
          variant="sheet"
          labelledBy="liked-song-actions-title"
        >
          <h2
            id="liked-song-actions-title"
            className="mb-4 text-lg font-bold text-white"
          >
            Song options
          </h2>

          <div className="space-y-1">
            <button
              type="button"
              onClick={
                handleOpenLikedPlaylistPicker
              }
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold text-white transition hover:bg-white/5 active:bg-white/10"
            >
              <PlusIcon
                size={21}
                className="text-neutral-300"
              />
              Add to a playlist
            </button>

            <button
              type="button"
              onClick={
                handleStartLikedRemoval
              }
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold text-red-400 transition hover:bg-white/5 active:bg-white/10"
            >
              <Trash2Icon
                size={20}
              />
              Remove from Liked Songs
            </button>
          </div>
        </Modal>

        <Modal
          open={
            likedPlaylistPickerOpen
          }
          onClose={() => {
            setLikedPlaylistPickerOpen(
              false
            );
            setSelectedLikedSongId(
              null
            );
          }}
          variant="sheet"
          labelledBy="liked-playlist-picker-title"
        >
          <h2
            id="liked-playlist-picker-title"
            className="mb-4 text-lg font-bold text-white"
          >
            Add to a playlist
          </h2>

          {playlists.length === 0 ? (
            <div className="py-7 text-center">
              <MusicIcon
                size={30}
                className="mx-auto text-neutral-500"
              />

              <p className="mt-3 text-sm font-semibold text-white">
                No playlists yet
              </p>

              <p className="mt-1 text-xs text-neutral-500">
                Create a playlist first.
              </p>
            </div>
          ) : (
            <div className="max-h-[52vh] space-y-1 overflow-y-auto">
              {playlists.map(
                (playlist) => (
                  <button
                    key={
                      playlist.id
                    }
                    type="button"
                    onClick={() =>
                      handleAddLikedSongToPlaylist(
                        playlist.id
                      )
                    }
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-white/5 active:bg-white/10"
                  >
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-white/10 text-white">
                      <MusicIcon
                        size={20}
                      />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">
                        {
                          playlist.name
                        }
                      </span>

                    </span>
                  </button>
                )
              )}
            </div>
          )}
        </Modal>
      </>
    );
  }

  /*
   * Folder-style playlist screen.
   */
  if (
    view.type === "playlist" &&
    activePlaylist
  ) {
    const showCover =
      Boolean(activePlaylist.cover) &&
      !failedPlaylistCovers.has(
        activePlaylist.id
      );

    return (
      <motion.div
        ref={playlistPageRef}
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
            onClick={() =>
              setView({
                type: "library",
              })
            }
            aria-label="Back to Library"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/10 active:scale-95"
          >
            <ArrowLeftIcon size={24} />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-extrabold text-white">
              {activePlaylist.name}
            </h1>

          </div>

          <button
            type="button"
            onClick={() =>
              handleOpenAddSongs(
                activePlaylist.id
              )
            }
            aria-label={`Add songs to ${activePlaylist.name}`}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/10 active:scale-95"
          >
            <PlusIcon size={25} />
          </button>

          <button
            type="button"
            onClick={() =>
              handleOpenPlaylistActions(
                activePlaylist.id
              )
            }
            aria-label={`More options for ${activePlaylist.name}`}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-neutral-300 transition hover:bg-white/10 hover:text-white active:scale-95"
          >
            <MoreVerticalIcon size={22} />
          </button>
        </header>

        <div className="px-3">
          <div className="mb-5 flex items-end gap-4 px-2 pt-3">
            <span className="flex h-28 w-28 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/10 shadow-xl">
              {showCover ? (
                <img
                  src={
                    activePlaylist.cover
                  }
                  alt={`${activePlaylist.name} cover`}
                  className="h-full w-full object-cover"
                  onError={() =>
                    handlePlaylistCoverError(
                      activePlaylist.id
                    )
                  }
                />
              ) : (
                <MusicIcon
                  size={42}
                  className="text-neutral-400"
                />
              )}
            </span>

            <div className="min-w-0 pb-1">
              <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">
                Playlist
              </p>

              <h2 className="mt-1 line-clamp-2 text-2xl font-extrabold text-white">
                {activePlaylist.name}
              </h2>

            </div>
          </div>

          {activePlaylistSongs.length ===
          0 ? (
            <div className="flex min-h-[42vh] flex-col items-center justify-center px-6 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                <MusicIcon
                  size={30}
                  className="text-neutral-500"
                />
              </span>

              <h2 className="mt-4 text-lg font-bold text-white">
                This playlist is empty
              </h2>

              <p className="mt-2 max-w-xs text-sm leading-6 text-neutral-400">
                Add songs from Local Files or
                Cloudinary to get started.
              </p>

              <button
                type="button"
                onClick={() =>
                  handleOpenAddSongs(
                    activePlaylist.id
                  )
                }
                className="mt-5 rounded-full bg-white px-6 py-2.5 text-sm font-bold text-black transition active:scale-95"
              >
                Add songs
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-2 pr-7">
                {groupedActivePlaylistSongs.map(
                  ({
                    letter,
                    songs: groupSongs,
                  }) => (
                    <section
                      key={letter}
                      ref={(element) => {
                        if (element) {
                          playlistSongSectionRefs
                            .current[letter] =
                            element;
                        } else {
                          delete playlistSongSectionRefs
                            .current[letter];
                        }
                      }}
                      className="scroll-mt-20"
                      aria-labelledby={`playlist-song-section-${letter}`}
                    >
                      <div className="px-2 pb-1 pt-2">
                        <h2
                          id={`playlist-song-section-${letter}`}
                          className="text-xs font-black uppercase tracking-widest text-neutral-400"
                        >
                          {letter}
                        </h2>
                      </div>

                      <div className="space-y-1">
                        {groupSongs.map(
                          (song) => (
                            <SongRow
                              key={song.id}
                              song={song}
                              queue={
                                activePlaylistQueue
                              }
                              playlistId={
                                activePlaylist.id
                              }
                              subtitle={
                                song.album
                                  ? `${
                                      song.artist ||
                                      "Unknown artist"
                                    } • ${song.album}`
                                  : song.artist ||
                                    "Unknown artist"
                              }
                            />
                          )
                        )}
                      </div>
                    </section>
                  )
                )}
              </div>

              <AlphabeticalIndex
                activeLetter={
                  activePlaylistSongLetter
                }
                availableLetters={
                  availableActivePlaylistLetters
                }
                onSelectLetter={
                  handleSelectPlaylistSongLetter
                }
                ariaLabel={`${activePlaylist.name} songs alphabetical index`}
              />
            </>
          )}
        </div>

        <PlaylistModals
          selectedPlaylist={
            selectedPlaylist
          }
          playlistActionsOpen={
            playlistActionsOpen
          }
          deleteConfirmOpen={
            deleteConfirmOpen
          }
          onCloseActions={
            handleClosePlaylistActions
          }
          onOpenDelete={
            handleOpenDeleteConfirmation
          }
          onCloseDelete={
            handleCloseDeleteConfirmation
          }
          onDelete={
            handleDeletePlaylist
          }
        />
      </motion.div>
    );
  }

  return (
    <div className="min-h-full pb-4">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-[#121212]/95 px-4 pb-3 pt-5 backdrop-blur">
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
          Your Library
        </h1>

        <motion.button
          type="button"
          onClick={() =>
            setLibraryLayout(
              (current) =>
                current === "list"
                  ? "grid"
                  : "list"
            )
          }
          whileTap={{
            scale: 0.88,
          }}
          whileHover={{
            scale: 1.04,
          }}
          transition={{
            type: "spring",
            stiffness: 500,
            damping: 28,
          }}
          aria-label={
            libraryLayout === "list"
              ? "Show library as icons"
              : "Show library as list"
          }
          aria-pressed={
            libraryLayout === "grid"
          }
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
        >
          <AnimatePresence
            mode="wait"
            initial={false}
          >
            {libraryLayout ===
            "list" ? (
              <motion.span
                key="grid"
                initial={{
                  opacity: 0,
                  scale: 0.65,
                  rotate: -45,
                }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  rotate: 0,
                }}
                exit={{
                  opacity: 0,
                  scale: 0.65,
                  rotate: 45,
                }}
                transition={{
                  type: "spring",
                  stiffness: 520,
                  damping: 26,
                }}
                className="flex items-center justify-center"
              >
                <LayoutGridIcon
                  size={22}
                />
              </motion.span>
            ) : (
              <motion.span
                key="list"
                initial={{
                  opacity: 0,
                  scale: 0.65,
                  rotate: 45,
                }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  rotate: 0,
                }}
                exit={{
                  opacity: 0,
                  scale: 0.65,
                  rotate: -45,
                }}
                transition={{
                  type: "spring",
                  stiffness: 520,
                  damping: 26,
                }}
                className="flex items-center justify-center"
              >
                <ListIcon
                  size={23}
                />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        <motion.button
          type="button"
          onClick={() =>
            setAddOpen(true)
          }
          whileTap={{
            scale: 0.86,
            rotate: 90,
          }}
          whileHover={{
            scale: 1.05,
          }}
          transition={{
            type: "spring",
            stiffness: 520,
            damping: 24,
          }}
          aria-label="Add to library"
          className="flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
        >
          <motion.span
            className="flex items-center justify-center"
            initial={false}
          >
            <PlusIcon size={26} />
          </motion.span>
        </motion.button>
      </header>

      <div className="px-4 pt-2">
        {libraryLayout === "list" ? (
          <>
            <button
              type="button"
              onClick={onOpenLocalFiles}
              className="flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-white/5 active:bg-white/10"
              aria-label="Open Local Files"
            >
              <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded bg-white/10">
                <FolderIcon
                  size={26}
                  className="text-[#1DB954]"
                />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-bold text-white">
                  Local Files
                </span>

              </span>

              <ChevronRightIcon
                size={20}
                className="flex-shrink-0 text-neutral-500"
              />
            </button>

            <button
              type="button"
              onClick={() =>
                setView({
                  type: "liked-songs",
                })
              }
              className="mt-1 flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-white/5 active:bg-white/10"
              aria-label="Open Liked Songs"
            >
              <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded bg-white/10">
                <HeartIcon
                  size={27}
                  className="text-[#1DB954]"
                />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-bold text-white">
                  Liked Songs
                </span>

              </span>

              <ChevronRightIcon
                size={20}
                className="flex-shrink-0 text-neutral-500"
              />
            </button>

            <h2 className="mb-1 mt-5 text-sm font-bold uppercase tracking-wide text-neutral-400">
              Playlists
            </h2>

            <div className="space-y-1">
              {playlists.map(
                  (playlist) => {
                    const showCover =
                      Boolean(
                        playlist.cover
                      ) &&
                      !failedPlaylistCovers.has(
                        playlist.id
                      );

                    return (
                      <div
                        key={playlist.id}
                        className="flex w-full items-center rounded-md transition-colors hover:bg-white/5"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenPlaylist(
                              playlist.id
                            )
                          }
                          className="flex min-w-0 flex-1 items-center gap-3 p-2 text-left active:bg-white/10"
                          aria-label={`Open playlist ${playlist.name}`}
                        >
                          <span className="h-14 w-14 flex-shrink-0 overflow-hidden rounded bg-white/10">
                            {showCover ? (
                              <img
                                src={
                                  playlist.cover
                                }
                                alt={`${playlist.name} cover`}
                                className="h-full w-full object-cover"
                                loading="lazy"
                                onError={() =>
                                  handlePlaylistCoverError(
                                    playlist.id
                                  )
                                }
                              />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center text-white">
                                <MusicIcon
                                  size={24}
                                />
                              </span>
                            )}
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-base font-semibold text-white">
                              {playlist.name}
                            </span>

                            <span className="block truncate text-xs text-neutral-400">
                              Playlist
                            </span>
                          </span>

                          <ChevronRightIcon
                            size={20}
                            className="flex-shrink-0 text-neutral-500"
                          />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleOpenPlaylistActions(
                              playlist.id
                            )
                          }
                          className="mr-1 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-neutral-300 transition hover:bg-white/10 hover:text-white active:scale-95"
                          aria-label={`More options for ${playlist.name}`}
                        >
                          <MoreVerticalIcon
                            size={21}
                          />
                        </button>
                      </div>
                    );
                  }
                )}
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 pt-2">
              <button
                type="button"
                onClick={onOpenLocalFiles}
                aria-label="Open Local Files"
                className="min-w-0 text-left outline-none transition active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-white/40"
              >
                <span className="flex aspect-square w-full items-center justify-center rounded-2xl bg-white/[0.07] shadow-[0_14px_34px_rgba(0,0,0,0.35)] ring-1 ring-white/[0.06]">
                  <FolderIcon
                    size={48}
                    className="text-[#1DB954]"
                  />
                </span>

                <span className="mt-2 block truncate text-sm font-bold text-white">
                  Local Files
                </span>

              </button>

              <button
                type="button"
                onClick={() =>
                  setView({
                    type: "liked-songs",
                  })
                }
                aria-label="Open Liked Songs"
                className="min-w-0 text-left outline-none transition active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-white/40"
              >
                <span className="flex aspect-square w-full items-center justify-center rounded-2xl bg-white/[0.07] shadow-[0_14px_34px_rgba(0,0,0,0.35)] ring-1 ring-white/[0.06]">
                  <HeartIcon
                    size={48}
                    className="text-[#1DB954]"
                  />
                </span>

                <span className="mt-2 block truncate text-sm font-bold text-white">
                  Liked Songs
                </span>

              </button>

              {playlists.map(
                (playlist) => {
                  const showCover =
                    Boolean(
                      playlist.cover
                    ) &&
                    !failedPlaylistCovers.has(
                      playlist.id
                    );

                  return (
                    <div
                      key={playlist.id}
                      className="relative min-w-0"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenPlaylist(
                            playlist.id
                          )
                        }
                        aria-label={`Open playlist ${playlist.name}`}
                        className="block w-full min-w-0 text-left outline-none transition active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-white/40"
                      >
                        <span className="flex aspect-square w-full overflow-hidden rounded-2xl bg-white/[0.07] shadow-[0_14px_34px_rgba(0,0,0,0.35)] ring-1 ring-white/[0.06]">
                          {showCover ? (
                            <img
                              src={
                                playlist.cover
                              }
                              alt={`${playlist.name} cover`}
                              className="h-full w-full object-cover"
                              loading="lazy"
                              onError={() =>
                                handlePlaylistCoverError(
                                  playlist.id
                                )
                              }
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-white">
                              <MusicIcon
                                size={46}
                              />
                            </span>
                          )}
                        </span>

                        <span className="mt-2 block truncate text-sm font-bold text-white">
                          {playlist.name}
                        </span>

                        <span className="mt-0.5 block truncate text-xs text-neutral-400">
                          Playlist
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleOpenPlaylistActions(
                            playlist.id
                          )
                        }
                        className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/70 active:scale-95"
                        aria-label={`More options for ${playlist.name}`}
                      >
                        <MoreVerticalIcon
                          size={20}
                        />
                      </button>
                    </div>
                  );
                }
              )}
            </div>

          </>
        )}
      </div>

      <Modal
        open={addOpen}
        onClose={() =>
          setAddOpen(false)
        }
        labelledBy="library-add-title"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />

        <h2
          id="library-add-title"
          className="mb-3 text-lg font-bold text-white"
        >
          Add
        </h2>

        <button
          type="button"
          onClick={
            handleOpenCreateModal
          }
          className="flex w-full items-center gap-3 rounded-lg px-2 py-3.5 text-left transition-colors hover:bg-white/5 active:bg-white/10"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
            <PlusIcon
              size={22}
              className="text-white"
            />
          </span>

          <span className="text-sm font-semibold text-white">
            Create playlist
          </span>
        </button>
      </Modal>

      <Modal
        open={createOpen}
        onClose={
          handleCloseCreateModal
        }
        variant="center"
        labelledBy="create-playlist-title"
        keyboardAvoiding
      >
        <h2
          id="create-playlist-title"
          className="mb-6 text-center text-xl font-bold text-white"
        >
          Give your playlist a name
        </h2>

        <input
          autoFocus
          value={name}
          onChange={(event) =>
            setName(
              event.target.value
            )
          }
          onKeyDown={(event) => {
            if (
              event.key === "Enter"
            ) {
              event.preventDefault();
              handleCreatePlaylist();
            }
          }}
          placeholder="My playlist"
          className="w-full border-b-2 border-white/30 bg-transparent pb-2 text-center text-lg font-semibold text-white placeholder:text-neutral-600 focus:border-white focus:outline-none"
          aria-label="Playlist name"
          maxLength={80}
        />

        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={
              handleCloseCreateModal
            }
            className="px-6 py-2.5 text-sm font-bold text-white transition active:scale-95"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={
              handleCreatePlaylist
            }
            disabled={!name.trim()}
            className="rounded-full bg-white px-8 py-2.5 text-sm font-bold text-black transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Create
          </button>
        </div>
      </Modal>

      <PlaylistModals
        selectedPlaylist={
          selectedPlaylist
        }
        playlistActionsOpen={
          playlistActionsOpen
        }
        deleteConfirmOpen={
          deleteConfirmOpen
        }
        onCloseActions={
          handleClosePlaylistActions
        }
        onOpenDelete={
          handleOpenDeleteConfirmation
        }
        onCloseDelete={
          handleCloseDeleteConfirmation
        }
        onDelete={
          handleDeletePlaylist
        }
      />
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
});

interface PlaylistModalsProps {
  selectedPlaylist:
    | {
        id: string;
        name: string;
      }
    | null;

  playlistActionsOpen: boolean;
  deleteConfirmOpen: boolean;

  onCloseActions: () => void;
  onOpenDelete: () => void;
  onCloseDelete: () => void;
  onDelete: () => void;
}

function PlaylistModals({
  selectedPlaylist,
  playlistActionsOpen,
  deleteConfirmOpen,
  onCloseActions,
  onOpenDelete,
  onCloseDelete,
  onDelete,
}: PlaylistModalsProps) {
  return (
    <>
      <Modal
        open={playlistActionsOpen}
        onClose={onCloseActions}
        labelledBy="playlist-actions-title"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />

        <h2
          id="playlist-actions-title"
          className="truncate text-lg font-bold text-white"
        >
          {selectedPlaylist?.name ??
            "Playlist"}
        </h2>

        <p className="mb-3 mt-1 text-xs text-neutral-400">
          Playlist options
        </p>

        <button
          type="button"
          onClick={onOpenDelete}
          className="flex w-full items-center gap-3 rounded-lg px-2 py-3.5 text-left text-red-400 transition-colors hover:bg-red-500/10 active:bg-red-500/15"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
            <Trash2Icon size={20} />
          </span>

          <span className="text-sm font-semibold">
            Delete playlist
          </span>
        </button>
      </Modal>

      <Modal
        open={deleteConfirmOpen}
        onClose={onCloseDelete}
        variant="center"
        labelledBy="delete-playlist-title"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-400">
          <Trash2Icon size={23} />
        </div>

        <h2
          id="delete-playlist-title"
          className="mt-4 text-center text-xl font-bold text-white"
        >
          Delete playlist?
        </h2>

        <p className="mt-2 text-center text-sm leading-6 text-neutral-400">
          “
          {selectedPlaylist?.name ??
            "This playlist"}
          ” will be permanently removed.
        </p>

        <div className="mt-7 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onCloseDelete}
            className="rounded-full px-6 py-2.5 text-sm font-bold text-white transition hover:bg-white/10 active:scale-95"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onDelete}
            className="rounded-full bg-red-500 px-7 py-2.5 text-sm font-bold text-white transition hover:bg-red-400 active:scale-95"
          >
            Delete
          </button>
        </div>
      </Modal>
    </>
  );
}