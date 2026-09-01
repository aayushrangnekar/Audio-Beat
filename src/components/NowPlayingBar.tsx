import React, {
  useState,
} from "react";

import {
  MusicIcon,
  PauseIcon,
  PlayIcon,
} from "lucide-react";

import {
  usePlayer,
} from "../context/PlayerContext";

import {
  useAlbumArtworkTheme,
} from "../utils/useAlbumArtworkTheme";

import {
  getOutputDeviceIcon,
} from "../utils/getOutputDeviceIcon";

import {
  ConnectedDevices,
} from "./ConnectedDevices";

import {
  LikeToggleButton,
} from "./LikeToggleButton";

import {
  ScrollingSongText,
} from "./ScrollingSongText";

export function NowPlayingBar() {
  const {
    currentSong,
    isPlaying,
    togglePlay,
    progress,
    openPlayer,
    connectedDevice,
    isPlayerOpen,
  } = usePlayer();

  const [
    devicesOpen,
    setDevicesOpen,
  ] = useState(false);

  const theme =
    useAlbumArtworkTheme(
      currentSong?.albumArt,
      currentSong?.color
    );

  if (
    !currentSong ||
    isPlayerOpen
  ) {
    return null;
  }

  const duration =
    Number.isFinite(
      currentSong.duration
    ) &&
    currentSong.duration > 0
      ? currentSong.duration
      : 0;

  const safeProgress =
    Number.isFinite(progress)
      ? Math.max(
          0,
          progress
        )
      : 0;

  const progressPercentage =
    duration > 0
      ? Math.min(
          100,
          Math.max(
            0,
            (
              safeProgress /
              duration
            ) * 100
          )
        )
      : 0;

  const artist =
    currentSong.artist ||
    "Unknown artist";

  const ConnectedOutputIcon =
    getOutputDeviceIcon(
      connectedDevice
    );

  function handleTogglePlay(
    event:
      React.MouseEvent
  ): void {
    event.stopPropagation();
    togglePlay();
  }

  function handleOpenDevices(
    event:
      React.MouseEvent
  ): void {
    event.stopPropagation();
    setDevicesOpen(true);
  }

  return (
    <>
      <div className="px-2 pb-2">
        <div
          className="relative overflow-hidden rounded-lg shadow-[0_8px_28px_rgba(0,0,0,0.38)] transition-[background] duration-700"
          style={{
            background: `linear-gradient(
              110deg,
              ${theme.primary} 0%,
              ${theme.deep} 64%,
              ${theme.darker} 100%
            )`,
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(
                circle at 13% 50%,
                ${theme.glow} 0%,
                transparent 58%
              )`,
              opacity: 0.3,
            }}
          />

          <div className="relative flex items-center gap-3 px-2 py-2">
            <button
              type="button"
              onClick={
                openPlayer
              }
              className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden text-left"
              aria-label={`Open now playing: ${currentSong.title}`}
            >
              {currentSong.albumArt ? (
                <img
                  src={
                    currentSong.albumArt
                  }
                  alt={`${currentSong.title} album artwork`}
                  className="h-10 w-10 flex-shrink-0 rounded object-cover shadow-md"
                  onError={(
                    event
                  ) => {
                    event.currentTarget.style.display =
                      "none";
                  }}
                />
              ) : (
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-white/10 text-white/80">
                  <MusicIcon
                    size={20}
                  />
                </span>
              )}

              <ScrollingSongText
                title={
                  currentSong.title
                }
                artist={
                  artist
                }
                restartKey={`bar-${currentSong.id}`}
                className="flex-1"
                titleClassName="text-sm font-semibold leading-5 text-white"
                artistClassName="text-xs leading-4 text-white/70"
                initialDelaySeconds={
                  1.25
                }
                pauseSeconds={
                  1
                }
              />
            </button>

            <button
              type="button"
              onClick={
                handleOpenDevices
              }
              className="rounded-full p-2 text-white/90 transition active:scale-95"
              aria-label={
                connectedDevice
                  ? `Connected to ${connectedDevice.name}`
                  : "Connect to a device"
              }
            >
              <ConnectedOutputIcon
                size={20}
                className={
                  connectedDevice
                    ? "text-[#1DB954]"
                    : ""
                }
              />
            </button>

            <LikeToggleButton
              songId={
                currentSong.id
              }
              size={18}
            />

            <button
              type="button"
              onClick={
                handleTogglePlay
              }
              className="rounded-full p-2 text-white transition active:scale-95"
              aria-label={
                isPlaying
                  ? "Pause"
                  : "Play"
              }
            >
              {isPlaying ? (
                <PauseIcon
                  size={20}
                  fill="currentColor"
                />
              ) : (
                <PlayIcon
                  size={20}
                  fill="currentColor"
                />
              )}
            </button>
          </div>

          <div className="relative mx-2 mb-1 h-[3px] overflow-hidden rounded-full bg-white/25">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-white transition-[width] duration-200"
              style={{
                width:
                  `${progressPercentage}%`,
              }}
            />
          </div>
        </div>
      </div>

      <ConnectedDevices
        open={
          devicesOpen
        }
        onClose={() =>
          setDevicesOpen(false)
        }
      />
    </>
  );
}
