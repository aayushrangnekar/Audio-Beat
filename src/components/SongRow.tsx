import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  CheckIcon,
  ListPlusIcon,
  MusicIcon,
  PauseIcon,
  PlayIcon,
  Trash2Icon,
} from "lucide-react";

import { toast } from "sonner";

import { Modal } from "./Modal";
import { usePlayer } from "../context/PlayerContext";

import type { Song } from "../types";

interface Props {
  song: Song;
  queue?: string[];
  subtitle?: string;

  /*
   * Pass this when rendering a song inside a playlist.
   * It enables "Remove from this playlist".
   */
  playlistId?: string;

  /*
   * Selection mode is used by the Add Songs screen.
   */
  selectionMode?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onSelectionChange?: (
    songId: string,
    selected: boolean
  ) => void;

  /*
   * Optional parent-controlled long-press action.
   *
   * When provided, SongRow keeps its existing
   * long-press detection but lets the parent
   * decide which actions to show.
   */
  onLongPress?: (
    song: Song
  ) => void;
}

const LONG_PRESS_DURATION = 550;
const LONG_PRESS_MOVE_LIMIT = 12;

export function SongRow({
  song,
  queue,
  subtitle,
  playlistId,
  selectionMode = false,
  selected = false,
  disabled = false,
  onSelectionChange,
  onLongPress,
}: Props) {
  const {
    playSong,
    togglePlay,
    currentSong,
    isPlaying,

    playlists,
    addSongToPlaylists,
    removeSongFromPlaylist,
  } = usePlayer();

  const [albumArtFailed, setAlbumArtFailed] =
    useState<boolean>(false);

  const [actionsOpen, setActionsOpen] =
    useState<boolean>(false);

  const [
    playlistPickerOpen,
    setPlaylistPickerOpen,
  ] = useState<boolean>(false);

  const [
    selectedPlaylistIds,
    setSelectedPlaylistIds,
  ] = useState<Set<string>>(
    () => new Set()
  );

  const longPressTimerRef =
    useRef<number | null>(null);

  const pointerStartRef = useRef<{
    x: number;
    y: number;
  } | null>(null);

  const longPressTriggeredRef =
    useRef<boolean>(false);

  const isCurrent =
    currentSong?.id === song.id;

  const displaySubtitle =
    subtitle ||
    (song.album
      ? `${
          song.artist ||
          "Unknown artist"
        } • ${song.album}`
      : song.artist ||
        "Unknown artist");

  const availablePlaylists =
    playlists.filter(
      (playlist) =>
        !playlist.songIds.includes(song.id)
    );

  useEffect(() => {
    setAlbumArtFailed(false);
    setActionsOpen(false);
    setPlaylistPickerOpen(false);
    setSelectedPlaylistIds(new Set());
  }, [song.id]);

  useEffect(() => {
    return () => {
      cancelLongPress();
    };
  }, []);

  function cancelLongPress(): void {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(
        longPressTimerRef.current
      );

      longPressTimerRef.current = null;
    }

    pointerStartRef.current = null;
  }

  function openActions(): void {
    if (selectionMode || disabled) {
      return;
    }

    longPressTriggeredRef.current = true;

    if (onLongPress) {
      onLongPress(song);
      return;
    }

    setActionsOpen(true);
  }

  function handlePointerDown(
    event: React.PointerEvent<HTMLButtonElement>
  ): void {
    if (selectionMode || disabled) {
      return;
    }

    longPressTriggeredRef.current = false;

    cancelLongPress();

    pointerStartRef.current = {
      x: event.clientX,
      y: event.clientY,
    };

    longPressTimerRef.current =
      window.setTimeout(() => {
        openActions();
      }, LONG_PRESS_DURATION);
  }

  function handlePointerMove(
    event: React.PointerEvent<HTMLButtonElement>
  ): void {
    const start =
      pointerStartRef.current;

    if (!start) {
      return;
    }

    const horizontalMovement =
      Math.abs(event.clientX - start.x);

    const verticalMovement =
      Math.abs(event.clientY - start.y);

    if (
      horizontalMovement >
        LONG_PRESS_MOVE_LIMIT ||
      verticalMovement >
        LONG_PRESS_MOVE_LIMIT
    ) {
      cancelLongPress();
    }
  }

  function handlePointerEnd(): void {
    cancelLongPress();
  }

  function handleRowClick(): void {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }

    if (disabled) {
      return;
    }

    if (selectionMode) {
      onSelectionChange?.(
        song.id,
        !selected
      );

      return;
    }

    if (isCurrent) {
      togglePlay();
      return;
    }

    playSong(song.id, queue);
  }

  function handleContextMenu(
    event: React.MouseEvent<HTMLButtonElement>
  ): void {
    /*
     * Prevent Android/WebView from showing its native
     * text-selection or copy context menu.
     */
    event.preventDefault();

    if (selectionMode || disabled) {
      return;
    }

    openActions();
  }

  function handleOpenPlaylistPicker(): void {
    setActionsOpen(false);
    setSelectedPlaylistIds(new Set());
    setPlaylistPickerOpen(true);
  }

  function handleTogglePlaylist(
    selectedPlaylistId: string
  ): void {
    setSelectedPlaylistIds(
      (current) => {
        const next = new Set(current);

        if (
          next.has(selectedPlaylistId)
        ) {
          next.delete(selectedPlaylistId);
        } else {
          next.add(selectedPlaylistId);
        }

        return next;
      }
    );
  }

  function handleAddToPlaylists(): void {
    const targetIds =
      Array.from(selectedPlaylistIds);

    if (targetIds.length === 0) {
      return;
    }

    addSongToPlaylists(
      targetIds,
      song.id
    );

    toast.success(
      targetIds.length === 1
        ? `Added “${song.title}” to playlist`
        : `Added “${song.title}” to ${targetIds.length} playlists`
    );

    setSelectedPlaylistIds(new Set());
    setPlaylistPickerOpen(false);
  }

  function handleRemoveFromPlaylist(): void {
    if (!playlistId) {
      return;
    }

    removeSongFromPlaylist(
      playlistId,
      song.id
    );

    setActionsOpen(false);

    toast.success(
      `Removed “${song.title}” from playlist`
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleRowClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onPointerLeave={handlePointerEnd}
        onContextMenu={handleContextMenu}
        disabled={disabled}
        style={{
          WebkitUserSelect: "none",
          userSelect: "none",
          WebkitTouchCallout: "none",
        }}
        className={`group flex w-full touch-pan-y select-none items-center gap-3 rounded-md p-2 text-left transition-colors ${
          selected
            ? "bg-white/10"
            : "hover:bg-white/5 active:bg-white/10"
        } ${
          disabled
            ? "cursor-not-allowed opacity-45"
            : ""
        }`}
        aria-label={
          selectionMode
            ? selected
              ? `Deselect ${song.title}`
              : `Select ${song.title}`
            : isCurrent
              ? isPlaying
                ? `Pause ${song.title}`
                : `Play ${song.title}`
              : `Play ${song.title}`
        }
        aria-pressed={
          selectionMode
            ? selected
            : isCurrent && isPlaying
        }
      >
        <span className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded bg-neutral-800">
          {song.albumArt &&
          !albumArtFailed ? (
            <img
              src={song.albumArt}
              alt={`${song.title} album artwork`}
              className="h-full w-full object-cover"
              loading="lazy"
              draggable={false}
              onError={() =>
                setAlbumArtFailed(true)
              }
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-neutral-400">
              <MusicIcon size={22} />
            </span>
          )}

          {!selectionMode ? (
            <span
              className={`absolute inset-0 flex items-center justify-center bg-black/45 transition-opacity ${
                isCurrent
                  ? "opacity-100"
                  : "opacity-0 group-hover:opacity-100"
              }`}
              aria-hidden="true"
            >
              {isCurrent && isPlaying ? (
                <PauseIcon
                  size={20}
                  fill="currentColor"
                  className="text-white"
                />
              ) : (
                <PlayIcon
                  size={20}
                  fill="currentColor"
                  className="ml-0.5 text-white"
                />
              )}
            </span>
          ) : null}
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-sm font-semibold ${
              !selectionMode && isCurrent
                ? "text-[#1DB954]"
                : "text-white"
            }`}
          >
            {song.title}
          </span>

          <span className="block truncate text-xs text-neutral-400">
            {displaySubtitle}
          </span>
        </span>

        {selectionMode ? (
          <span
            className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border transition ${
              selected
                ? "border-[#1DB954] bg-[#1DB954] text-black"
                : "border-neutral-500 text-transparent"
            }`}
            aria-hidden="true"
          >
            <CheckIcon size={16} />
          </span>
        ) : isCurrent ? (
          <span
            className="flex h-5 w-5 flex-shrink-0 items-end justify-center gap-0.5"
            aria-label={
              isPlaying
                ? "Currently playing"
                : "Currently selected"
            }
          >
            {isPlaying ? (
              [0, 1, 2].map(
                (index: number) => (
                  <span
                    key={index}
                    className="song-row-equalizer-bar w-0.5 rounded-full bg-[#1DB954]"
                    style={{
                      height: 14,
                      animationDelay: `${
                        index * 0.15
                      }s`,
                    }}
                    aria-hidden="true"
                  />
                )
              )
            ) : (
              <span
                className="h-2 w-2 rounded-full bg-[#1DB954]"
                aria-hidden="true"
              />
            )}
          </span>
        ) : null}

        <style>
          {`
            @keyframes song-row-equalizer {
              0%,
              100% {
                transform: scaleY(0.3);
              }

              50% {
                transform: scaleY(1);
              }
            }

            .song-row-equalizer-bar {
              transform-origin: bottom;
              animation:
                song-row-equalizer
                0.9s
                ease-in-out
                infinite;
            }

            @media (prefers-reduced-motion: reduce) {
              .song-row-equalizer-bar {
                animation: none;
                transform: scaleY(0.65);
              }
            }
          `}
        </style>
      </button>

      {/* Song actions bottom sheet */}
      <Modal
        open={actionsOpen}
        onClose={() =>
          setActionsOpen(false)
        }
        labelledBy={`song-actions-${song.id}`}
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" />

        <div className="flex items-center gap-4 pb-5">
          <span className="h-16 w-16 flex-shrink-0 overflow-hidden rounded bg-neutral-800">
            {song.albumArt &&
            !albumArtFailed ? (
              <img
                src={song.albumArt}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
                onError={() =>
                  setAlbumArtFailed(true)
                }
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-neutral-400">
                <MusicIcon size={27} />
              </span>
            )}
          </span>

          <div className="min-w-0 flex-1">
            <h2
              id={`song-actions-${song.id}`}
              className="truncate text-base font-bold text-white"
            >
              {song.title}
            </h2>

            <p className="mt-1 truncate text-sm text-neutral-400">
              {song.artist ||
                "Unknown artist"}
              {song.album
                ? ` • ${song.album}`
                : ""}
            </p>
          </div>
        </div>

        <div className="border-t border-white/10 pt-2">
          <button
            type="button"
            onClick={
              handleOpenPlaylistPicker
            }
            className="flex w-full items-center gap-4 rounded-lg px-2 py-4 text-left text-white transition hover:bg-white/5 active:bg-white/10"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
              <ListPlusIcon size={21} />
            </span>

            <span className="text-sm font-semibold">
              Add to playlist
            </span>
          </button>

          {playlistId ? (
            <button
              type="button"
              onClick={
                handleRemoveFromPlaylist
              }
              className="flex w-full items-center gap-4 rounded-lg px-2 py-4 text-left text-red-400 transition hover:bg-red-500/10 active:bg-red-500/15"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
                <Trash2Icon size={20} />
              </span>

              <span className="text-sm font-semibold">
                Remove from this playlist
              </span>
            </button>
          ) : null}
        </div>
      </Modal>

      {/* Select one or multiple playlists */}
      <Modal
        open={playlistPickerOpen}
        onClose={() => {
          setPlaylistPickerOpen(false);

          setSelectedPlaylistIds(
            new Set()
          );
        }}
        labelledBy={`playlist-picker-${song.id}`}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />

        <h2
          id={`playlist-picker-${song.id}`}
          className="text-lg font-bold text-white"
        >
          Add to playlist
        </h2>

        <p className="mt-1 text-xs text-neutral-400">
          Select one or more playlists.
        </p>

        <div className="mt-4 max-h-[48vh] space-y-1 overflow-y-auto">
          {playlists.length === 0 ? (
            <div className="rounded-lg bg-white/5 px-4 py-7 text-center">
              <MusicIcon
                size={28}
                className="mx-auto text-neutral-600"
              />

              <p className="mt-3 text-sm font-semibold text-white">
                No playlists available
              </p>

              <p className="mt-1 text-xs text-neutral-500">
                Create a playlist from Your
                Library first.
              </p>
            </div>
          ) : (
            playlists.map(
              (playlist) => {
                const alreadyAdded =
                  playlist.songIds.includes(
                    song.id
                  );

                const isSelected =
                  selectedPlaylistIds.has(
                    playlist.id
                  );

                return (
                  <button
                    key={playlist.id}
                    type="button"
                    disabled={alreadyAdded}
                    onClick={() =>
                      handleTogglePlaylist(
                        playlist.id
                      )
                    }
                    className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition hover:bg-white/5 active:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded bg-white/10">
                      {playlist.cover ? (
                        <img
                          src={
                            playlist.cover
                          }
                          alt=""
                          className="h-full w-full object-cover"
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
                        {playlist.name}
                      </span>

                      <span className="block truncate text-xs text-neutral-400">
                        {alreadyAdded
                          ? "Already in playlist"
                          : `${playlist.songIds.length} ${
                              playlist
                                .songIds
                                .length ===
                              1
                                ? "song"
                                : "songs"
                            }`}
                      </span>
                    </span>

                    <span
                      className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border ${
                        alreadyAdded ||
                        isSelected
                          ? "border-[#1DB954] bg-[#1DB954] text-black"
                          : "border-neutral-500 text-transparent"
                      }`}
                    >
                      <CheckIcon size={16} />
                    </span>
                  </button>
                );
              }
            )
          )}
        </div>

        {availablePlaylists.length >
        0 ? (
          <button
            type="button"
            disabled={
              selectedPlaylistIds.size === 0
            }
            onClick={
              handleAddToPlaylists
            }
            className="mt-5 w-full rounded-full bg-white py-3 text-sm font-bold text-black transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add
            {selectedPlaylistIds.size > 0
              ? ` (${selectedPlaylistIds.size})`
              : ""}
          </button>
        ) : null}
      </Modal>
    </>
  );
}