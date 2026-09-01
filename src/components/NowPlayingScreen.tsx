import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AnimatePresence,
  motion,
} from "framer-motion";

import {
  BluetoothIcon,
  
  CarIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  HeadphonesIcon,
  MicVocalIcon,
  MonitorSpeakerIcon,
  SmartphoneIcon,
  UsbIcon,
  MoreVerticalIcon,
  MusicIcon,
  PauseIcon,
  PlayIcon,
  SkipBackIcon,
  SkipForwardIcon,
  SpeakerIcon,
} from "lucide-react";

import { usePlayer } from "../context/PlayerContext";
import { VideoStorage } from "../plugins/VideoStorage";
import { formatTime } from "../utils/formatTime";
import { useAlbumArtworkTheme } from "../utils/useAlbumArtworkTheme";
import { LikeToggleButton } from "./LikeToggleButton";
import { SyncedLyrics } from "./SyncedLyrics";
import { VideoBackgroundControls } from "./VideoBackgroundControls";
import { ConnectedDevices } from "./ConnectedDevices";
import { ScrollingSongText, ScrollingText } from "./ScrollingSongText";

type VisualPanel = "art" | "video";

type OutputDeviceLike = {
  name?: string;
  type?: string;
};

function getOutputDeviceIcon(
  device: OutputDeviceLike | null
) {
  if (!device) {
    return BluetoothIcon;
  }

  const name =
    device.name
      ?.trim()
      .toLocaleLowerCase() ?? "";

  /*
   * Android can expose some classic Bluetooth A2DP
   * products under a generic/headphones route. Use
   * the accessory name as a small UI-level refinement
   * when it clearly identifies the form factor.
   */
  const looksLikeSpeaker =
    /speaker|soundbar|partybox|boombox/.test(
      name
    );

  const looksLikeHeadphones =
    /headphone|headset|earbud|earbuds|buds|airpods|neckband/.test(
      name
    );

  if (looksLikeSpeaker) {
    return SpeakerIcon;
  }

  if (looksLikeHeadphones) {
    return HeadphonesIcon;
  }

  switch (device.type) {
    case "headphones":
    case "wired":
      return HeadphonesIcon;

    case "speaker":
    case "bluetooth":
      return SpeakerIcon;

    case "car":
      return CarIcon;

    case "usb":
      return UsbIcon;

    case "hdmi":
      return MonitorSpeakerIcon;

    default:
      return SmartphoneIcon;
  }
}


export function NowPlayingScreen() {
  const {
    currentSong,
    isPlaying,
    togglePlay,
    next,
    previous,
    progress,
    seek,
    isPlayerOpen,
    closePlayer,
    isFullLyricsOpen,
    openFullLyrics,
    closeFullLyrics,
    lyricsOn,
    setLyricsOn,
    getVideoForSong,
    connectedDevice,
  } = usePlayer();

  const [menuOpen, setMenuOpen] =
    useState<boolean>(false);

  const [devicesOpen, setDevicesOpen] =
    useState<boolean>(false);

  const [visualPanel, setVisualPanel] =
    useState<VisualPanel>("art");

  const [canvasPlaying, setCanvasPlaying] =
    useState<boolean>(false);

  const [canvasOpacity, setCanvasOpacity] =
    useState<number>(0);

  const [cachedVideo, setCachedVideo] =
    useState<string | undefined>(undefined);

  const videoCacheRequestRef =
    useRef<number>(0);

  const canvasVideoRef =
    useRef<HTMLVideoElement | null>(null);

  const [albumArtFailed, setAlbumArtFailed] =
    useState<boolean>(false);

  const [isSeeking, setIsSeeking] =
    useState<boolean>(false);

  const [dragProgress, setDragProgress] =
    useState<number>(0);

  const [pendingSeekProgress, setPendingSeekProgress] =
    useState<number | null>(null);

  const seekTrackRef =
    useRef<HTMLDivElement | null>(null);

  const lyricsSeekTrackRef =
    useRef<HTMLDivElement | null>(null);

  const activeSeekPointerIdRef =
    useRef<number | null>(null);

  const dragProgressRef =
    useRef<number>(0);

  const pendingSeekTimeoutRef =
    useRef<number | null>(null);

  const song = currentSong;

  const ConnectedOutputIcon =
    getOutputDeviceIcon(
      connectedDevice
    );

  const video = useMemo(
    () => getVideoForSong(song),
    [getVideoForSong, song]
  );

  const hasVideo = Boolean(video);

  const canvasVideo =
    cachedVideo;

  /*
   * Cloudinary songs are swipeable only when the
   * backend catalogue contains an associated video.
   *
   * Local songs keep the existing manual-video panel.
   */
  const canOpenVideoPanel =
    song?.source !==
      "cloudinary" ||
    hasVideo;

  const duration =
    song &&
    Number.isFinite(song.duration) &&
    song.duration > 0
      ? song.duration
      : 0;

  const safeProgress = Number.isFinite(progress)
    ? Math.max(
        0,
        duration > 0
          ? Math.min(progress, duration)
          : progress
      )
    : 0;

  const displayedProgress =
    isSeeking
      ? dragProgress
      : pendingSeekProgress ??
        safeProgress;

  const displayedProgressPercentage =
    duration > 0
      ? Math.min(
          100,
          Math.max(
            0,
            (displayedProgress / duration) * 100
          )
        )
      : 0;

  const theme =
    useAlbumArtworkTheme(
      song?.albumArt,
      song?.color
    );

  const backgroundColor =
    theme.primary;

  const hasAlbumArt =
    Boolean(song?.albumArt) && !albumArtFailed;

  useEffect(() => {
    videoCacheRequestRef.current +=
      1;
    setCachedVideo(undefined);
    setAlbumArtFailed(false);
    setVisualPanel("art");
    setCanvasPlaying(false);
    setCanvasOpacity(0);
    setMenuOpen(false);
    closeFullLyrics();
    setIsSeeking(false);
    setDragProgress(0);
    setPendingSeekProgress(null);
    activeSeekPointerIdRef.current = null;
    dragProgressRef.current = 0;

    if (pendingSeekTimeoutRef.current !== null) {
      window.clearTimeout(
        pendingSeekTimeoutRef.current
      );
      pendingSeekTimeoutRef.current = null;
    }
  }, [song?.id]);

  useEffect(() => {
    if (
      visualPanel !== "video" ||
      !song ||
      !video
    ) {
      return;
    }

    const requestId =
      videoCacheRequestRef.current +
      1;

    videoCacheRequestRef.current =
      requestId;

    setCachedVideo(undefined);

    void VideoStorage.cacheVideo({
      songId: song.id,
      url: video,
    })
      .then(
        ({ url }) => {
          if (
            videoCacheRequestRef.current !==
            requestId
          ) {
            return;
          }

          setCachedVideo(url);
        }
      )
      .catch(
        (error) => {
          if (
            videoCacheRequestRef.current !==
            requestId
          ) {
            return;
          }

          console.warn(
            "Unable to prepare cached Canvas video. Falling back to the original video URL:",
            error
          );

          setCachedVideo(video);
        }
      );
  }, [
    song?.id,
    video,
    visualPanel,
  ]);

  useEffect(() => {
    if (!isPlayerOpen) {
      videoCacheRequestRef.current +=
        1;
      setCachedVideo(undefined);
      setMenuOpen(false);
      setDevicesOpen(false);
      closeFullLyrics();
      setVisualPanel("art");
      setCanvasPlaying(false);
      setCanvasOpacity(0);
      setIsSeeking(false);
      setPendingSeekProgress(null);
      activeSeekPointerIdRef.current = null;
    }
  }, [isPlayerOpen]);

  useEffect(() => {
    if (
      pendingSeekProgress === null ||
      isSeeking
    ) {
      return;
    }

    if (
      Math.abs(
        safeProgress - pendingSeekProgress
      ) <= 0.75
    ) {
      setPendingSeekProgress(null);
    }
  }, [
    isSeeking,
    pendingSeekProgress,
    safeProgress,
  ]);

  useEffect(() => {
    return () => {
      if (
        pendingSeekTimeoutRef.current !== null
      ) {
        window.clearTimeout(
          pendingSeekTimeoutRef.current
        );
      }
    };
  }, []);

  function handleClosePlayer(): void {
    setMenuOpen(false);
    setDevicesOpen(false);
    closeFullLyrics();
    setVisualPanel("art");
    closePlayer();
  }

  function handleToggleLyrics(): void {
    setLyricsOn(!lyricsOn);
    setMenuOpen(false);
  }

  function getSeekPositionFromClientX(
    clientX: number
  ): number {
    const track =
      isFullLyricsOpen
        ? lyricsSeekTrackRef.current
        : seekTrackRef.current;

    if (!track || duration <= 0) {
      return 0;
    }

    const bounds =
      track.getBoundingClientRect();

    if (bounds.width <= 0) {
      return 0;
    }

    const ratio = Math.min(
      1,
      Math.max(
        0,
        (clientX - bounds.left) /
          bounds.width
      )
    );

    return ratio * duration;
  }

  function updateLocalSeek(
    clientX: number
  ): void {
    const nextProgress =
      getSeekPositionFromClientX(
        clientX
      );

    dragProgressRef.current =
      nextProgress;

    setDragProgress(
      nextProgress
    );
  }

  function handleSeekPointerDown(
    event:
      React.PointerEvent<HTMLDivElement>
  ): void {
    if (duration <= 0) {
      return;
    }

    event.preventDefault();

    activeSeekPointerIdRef.current =
      event.pointerId;

    event.currentTarget.setPointerCapture(
      event.pointerId
    );

    setPendingSeekProgress(null);
    setIsSeeking(true);
    updateLocalSeek(event.clientX);
  }

  function handleSeekPointerMove(
    event:
      React.PointerEvent<HTMLDivElement>
  ): void {
    if (
      activeSeekPointerIdRef.current !==
      event.pointerId
    ) {
      return;
    }

    event.preventDefault();
    updateLocalSeek(event.clientX);
  }

  function finishSeek(
    event:
      React.PointerEvent<HTMLDivElement>
  ): void {
    if (
      activeSeekPointerIdRef.current !==
      event.pointerId
    ) {
      return;
    }

    event.preventDefault();
    updateLocalSeek(event.clientX);

    const requestedPosition =
      dragProgressRef.current;

    activeSeekPointerIdRef.current = null;

    if (
      event.currentTarget.hasPointerCapture(
        event.pointerId
      )
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId
      );
    }

    setIsSeeking(false);
    setPendingSeekProgress(
      requestedPosition
    );

    if (
      pendingSeekTimeoutRef.current !== null
    ) {
      window.clearTimeout(
        pendingSeekTimeoutRef.current
      );
    }

    pendingSeekTimeoutRef.current =
      window.setTimeout(() => {
        setPendingSeekProgress(null);
        pendingSeekTimeoutRef.current = null;
      }, 1800);

    seek(requestedPosition);
  }

  function cancelSeek(
    event:
      React.PointerEvent<HTMLDivElement>
  ): void {
    if (
      activeSeekPointerIdRef.current !==
      event.pointerId
    ) {
      return;
    }

    activeSeekPointerIdRef.current = null;
    setIsSeeking(false);
    setDragProgress(safeProgress);
    dragProgressRef.current = safeProgress;
  }

  function handleSeekKeyDown(
    event:
      React.KeyboardEvent<HTMLDivElement>
  ): void {
    if (duration <= 0) {
      return;
    }

    let nextProgress:
      number | null = null;

    if (
      event.key === "ArrowLeft" ||
      event.key === "ArrowDown"
    ) {
      nextProgress =
        Math.max(0, safeProgress - 5);
    } else if (
      event.key === "ArrowRight" ||
      event.key === "ArrowUp"
    ) {
      nextProgress =
        Math.min(duration, safeProgress + 5);
    } else if (event.key === "Home") {
      nextProgress = 0;
    } else if (event.key === "End") {
      nextProgress = duration;
    }

    if (nextProgress === null) {
      return;
    }

    event.preventDefault();
    setPendingSeekProgress(nextProgress);
    seek(nextProgress);
  }

  function handleCanvasPlaying(): void {
    setCanvasPlaying(true);
    setCanvasOpacity(1);
  }

  function handleCanvasTimeUpdate(
    event: React.SyntheticEvent<HTMLVideoElement>
  ): void {
    const element =
      event.currentTarget;

    const currentTime =
      element.currentTime;

    const videoDuration =
      element.duration;

    if (
      !Number.isFinite(videoDuration) ||
      videoDuration <= 0
    ) {
      return;
    }

    const fadeOutDuration = 0.9;
    const remaining =
      videoDuration - currentTime;

    if (
      remaining <
      fadeOutDuration
    ) {
      setCanvasOpacity(
        Math.max(
          0,
          remaining /
            fadeOutDuration
        )
      );
      return;
    }

    if (
      canvasOpacity !== 1
    ) {
      setCanvasOpacity(1);
    }
  }

  function handleCanvasEnded(): void {
    const element =
      canvasVideoRef.current;

    setCanvasOpacity(0);
    setCanvasPlaying(false);

    if (!element) {
      return;
    }

    element.currentTime = 0;

    void element
      .play()
      .catch((error) => {
        console.warn(
          "Unable to restart Canvas video:",
          error
        );
      });
  }

  function openVideoPanel(): void {
    if (!canOpenVideoPanel) {
      return;
    }

    setCanvasPlaying(false);
    setCanvasOpacity(0);
    setVisualPanel("video");
  }

  return (
    <AnimatePresence>
      {isPlayerOpen && song ? (
        <motion.div
          className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-black no-scrollbar transition-[background] duration-700"
          style={{
            background: `
              radial-gradient(
                circle at 50% 28%,
                ${theme.glow} 0%,
                ${theme.primary} 23%,
                ${theme.deep} 48%,
                rgba(18, 18, 18, 0.96) 71%,
                #000000 100%
              ),
              linear-gradient(
                180deg,
                ${theme.primary} 0%,
                ${theme.deep} 48%,
                #121212 75%,
                #000000 100%
              )
            `,
          }}
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{
            type: "spring",
            damping: 32,
            stiffness: 300,
          }}
        >
          <AnimatePresence>
            {visualPanel === "video" &&
            hasVideo &&
            canvasVideo ? (
              <motion.div
                key={`canvas-${song.id}`}
                className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-black"
                initial={{
                  opacity: 0,
                }}
                animate={{
                  opacity: 1,
                }}
                exit={{
                  opacity: 0,
                }}
                transition={{
                  duration: 0.35,
                  ease: "easeOut",
                }}
                aria-hidden="true"
              >
                <video
                  ref={canvasVideoRef}
                  key={canvasVideo}
                  src={canvasVideo}
                  autoPlay
                  muted
                  playsInline
                  preload="auto"
                  controls={false}
                  disablePictureInPicture
                  controlsList="nodownload noplaybackrate nofullscreen"
                  onPlaying={
                    handleCanvasPlaying
                  }
                  onTimeUpdate={
                    handleCanvasTimeUpdate
                  }
                  onEnded={
                    handleCanvasEnded
                  }
                  onError={() => {
                    setCanvasPlaying(false);
                    setCanvasOpacity(0);
                  }}
                  className="h-full w-full object-cover"
                  style={{
                    opacity:
                      canvasPlaying
                        ? canvasOpacity
                        : 0,
                    transition:
                      "opacity 180ms linear",
                  }}
                />

                <div className="absolute inset-0 bg-black/18" />

                <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.03)_30%,rgba(0,0,0,0.16)_58%,rgba(0,0,0,0.68)_100%)]" />

                <div className="absolute inset-x-0 bottom-0 h-[48%] bg-gradient-to-t from-black/75 via-black/28 to-transparent" />
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Header */}
          <div className="relative z-30 flex items-center justify-between px-5 pb-2 pt-5">
            <button
              type="button"
              onClick={handleClosePlayer}
              className="rounded-full p-1 text-white transition active:scale-95"
              aria-label="Close player"
            >
              <ChevronDownIcon size={28} />
            </button>

            <ScrollingText
              text={song.album || "Now playing"}
              restartKey={`album-${song.id}-${isPlayerOpen}`}
              className="w-[65%] text-center"
              textClassName="text-xs font-semibold uppercase tracking-wide text-white/80"
              initialDelaySeconds={1.25}
              pauseSeconds={1}
              pixelsPerSecond={30}
            />

            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setMenuOpen(
                    (open: boolean) => !open
                  )
                }
                className="rounded-full p-1 text-white transition active:scale-95"
                aria-label="More options"
                aria-expanded={menuOpen}
              >
                <MoreVerticalIcon size={24} />
              </button>

              <AnimatePresence>
                {menuOpen ? (
                  <>
                    <button
                      type="button"
                      className="fixed inset-0 z-40 cursor-default"
                      aria-label="Close options menu"
                      onClick={() =>
                        setMenuOpen(false)
                      }
                    />

                    <motion.div
                      initial={{
                        opacity: 0,
                        scale: 0.9,
                        y: -6,
                      }}
                      animate={{
                        opacity: 1,
                        scale: 1,
                        y: 0,
                      }}
                      exit={{
                        opacity: 0,
                        scale: 0.9,
                        y: -6,
                      }}
                      className="absolute right-0 top-9 z-50 w-56 overflow-hidden rounded-xl bg-neutral-800 py-1 shadow-xl"
                    >
                      <button
                        type="button"
                        onClick={handleToggleLyrics}
                        className="flex w-full items-center justify-between px-4 py-3 text-sm text-white hover:bg-white/5"
                      >
                        <span>Lyrics</span>

                        <span
                          className={`font-bold ${
                            lyricsOn
                              ? "text-[#1DB954]"
                              : "text-neutral-500"
                          }`}
                        >
                          {lyricsOn ? "On" : "Off"}
                        </span>
                      </button>

                    </motion.div>
                  </>
                ) : null}
              </AnimatePresence>
            </div>
          </div>

          <div className="relative z-10 px-6 pt-2">
            {/* Album artwork / Canvas swipe surface */}
            <div
              className={`relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-xl transition-shadow duration-300 ${
                visualPanel === "art"
                  ? "bg-neutral-900 shadow-2xl"
                  : hasVideo
                    ? "bg-transparent shadow-none"
                    : "bg-black/70 shadow-2xl"
              }`}
            >
              <AnimatePresence
                initial={false}
                mode="wait"
              >
                {visualPanel === "video" ? (
                  <motion.div
                    key="canvas-swipe-panel"
                    className="absolute inset-0"
                    initial={{
                      opacity: 0,
                      x: 40,
                    }}
                    animate={{
                      opacity: 1,
                      x: 0,
                    }}
                    exit={{
                      opacity: 0,
                      x: -40,
                    }}
                    drag="x"
                    dragConstraints={{
                      left: 0,
                      right: 0,
                    }}
                    dragElastic={0.15}
                    onDragEnd={(_, info) => {
                      if (info.offset.x > 60) {
                        setCanvasOpacity(0);
                        setCanvasPlaying(false);
                        canvasVideoRef.current?.pause();
                        setVisualPanel("art");
                      }
                    }}
                  >
                    {!hasVideo ? (
                      <div className="h-full w-full bg-black/70 p-4">
                        <VideoBackgroundControls
                          song={song}
                        />
                      </div>
                    ) : null}
                  </motion.div>
                ) : (
                  <motion.div
                    key="art-panel"
                    className="absolute inset-0"
                    initial={{
                      opacity: 0,
                      x: -40,
                    }}
                    animate={{
                      opacity: 1,
                      x: 0,
                    }}
                    exit={{
                      opacity: 0,
                      x: 40,
                    }}
                    drag={
                      canOpenVideoPanel
                        ? "x"
                        : false
                    }
                    dragConstraints={{
                      left: 0,
                      right: 0,
                    }}
                    dragElastic={
                      canOpenVideoPanel
                        ? 0.15
                        : 0
                    }
                    onDragEnd={(_, info) => {
                      if (
                        canOpenVideoPanel &&
                        info.offset.x < -60
                      ) {
                        openVideoPanel();
                      }
                    }}
                  >
                    {hasAlbumArt ? (
                      <img
                        src={song.albumArt}
                        alt={`${song.album || song.title} cover`}
                        className="h-full w-full object-cover"
                        onError={() =>
                          setAlbumArtFailed(true)
                        }
                      />
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center"
                        style={{
                          background: `linear-gradient(
                            145deg,
                            ${backgroundColor},
                            #181818
                          )`,
                        }}
                      >
                        <div className="flex h-28 w-28 items-center justify-center rounded-full bg-black/20 text-white/80 shadow-xl">
                          <MusicIcon size={54} />
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Song information */}
            <div className="mt-5 flex min-w-0 items-center gap-2">
              <ScrollingSongText
                title={song.title}
                artist={song.artist || "Unknown artist"}
                restartKey={`screen-${song.id}-${isPlayerOpen}`}
                className="min-w-0 flex-1"
                titleClassName="text-xl font-extrabold leading-7 text-white"
                artistClassName="mt-0.5 text-sm leading-5 text-white/65"
                initialDelaySeconds={1.25}
                pauseSeconds={1}
              />

              <LikeToggleButton
                songId={song.id}
                size={26}
                className="-mr-1"
              />
            </div>

            {/* Progress */}
            <div className="mt-5">
              <div
                ref={seekTrackRef}
                role="slider"
                tabIndex={duration > 0 ? 0 : -1}
                aria-label="Seek through song"
                aria-valuemin={0}
                aria-valuemax={duration}
                aria-valuenow={displayedProgress}
                aria-valuetext={`${formatTime(displayedProgress)} of ${formatTime(duration)}`}
                aria-disabled={duration <= 0}
                onPointerDown={
                  handleSeekPointerDown
                }
                onPointerMove={
                  handleSeekPointerMove
                }
                onPointerUp={finishSeek}
                onPointerCancel={cancelSeek}
                onLostPointerCapture={cancelSeek}
                onKeyDown={handleSeekKeyDown}
                className={`relative flex h-7 w-full touch-none items-center outline-none ${
                  duration > 0
                    ? "cursor-pointer"
                    : "cursor-not-allowed opacity-50"
                }`}
              >
                <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/25">
                  <div
                    className="h-full origin-left rounded-full bg-white"
                    style={{
                      width: `${displayedProgressPercentage}%`,
                    }}
                  />
                </div>

                <div
                  className={`pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_1px_5px_rgba(0,0,0,0.5)] ${
                    isSeeking
                      ? "scale-110"
                      : "scale-100"
                  }`}
                  style={{
                    left: `${displayedProgressPercentage}%`,
                  }}
                />
              </div>

              <div className="flex justify-between text-xs font-medium text-white/60">
                <span>
                  {formatTime(displayedProgress)}
                </span>

                <span>
                  {formatTime(duration)}
                </span>
              </div>
            </div>

            {/* Transport controls */}
            <div className="mt-4 flex items-center justify-center gap-10">
              <button
                type="button"
                onClick={previous}
                aria-label="Previous song"
                className="rounded-full p-2 text-white transition active:scale-90"
              >
                <SkipBackIcon
                  size={36}
                  fill="currentColor"
                />
              </button>

              <button
                type="button"
                onClick={togglePlay}
                aria-label={
                  isPlaying ? "Pause" : "Play"
                }
                className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-black shadow-lg transition active:scale-95"
              >
                {isPlaying ? (
                  <PauseIcon
                    size={30}
                    fill="currentColor"
                  />
                ) : (
                  <PlayIcon
                    size={30}
                    fill="currentColor"
                    className="ml-1"
                  />
                )}
              </button>

              <button
                type="button"
                onClick={next}
                aria-label="Next song"
                className="rounded-full p-2 text-white transition active:scale-90"
              >
                <SkipForwardIcon
                  size={36}
                  fill="currentColor"
                />
              </button>
            </div>

            {/* Connected-device control */}
            <button
              type="button"
              onClick={() =>
                setDevicesOpen(true)
              }
              className="mt-5 flex items-center gap-2 rounded-full py-2 text-xs font-semibold"
            >
              <ConnectedOutputIcon
                size={16}
                className={
                  connectedDevice
                    ? "text-[#1DB954]"
                    : "text-white/70"
                }
              />

              <span
                className={
                  connectedDevice
                    ? "max-w-[240px] truncate text-[#1DB954]"
                    : "text-white/70"
                }
              >
                {connectedDevice
                  ? connectedDevice.name
                  : "Connect to a device"}
              </span>
            </button>
          </div>

          {/* Lyrics */}
          <div className="relative z-10 mt-8 px-6 pb-10">
            {lyricsOn ? (
              <div
                className="relative overflow-hidden rounded-2xl p-5"
                style={{
                  background: `
                    radial-gradient(
                      circle at 18% 0%,
                      ${theme.glow} 0%,
                      transparent 58%
                    ),
                    linear-gradient(
                      145deg,
                      ${theme.lyrics} 0%,
                      ${theme.deep} 72%,
                      ${theme.darker} 100%
                    )
                  `,
                  boxShadow:
                    `0 18px 48px ${theme.darker}`,
                }}
              >
                <div className="absolute inset-0 bg-black/16" />

                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background: `linear-gradient(
                      180deg,
                      rgba(255,255,255,0.08) 0%,
                      transparent 32%,
                      rgba(0,0,0,0.18) 100%
                    )`,
                  }}
                />

                <div className="relative">
                  <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-white/80">
                    <MicVocalIcon size={16} />
                    Lyrics
                  </h2>

                  <SyncedLyrics
                    song={song}
                    progress={safeProgress}
                    mode="preview"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      openFullLyrics()
                    }
                    className="mt-5 rounded-full bg-white px-5 py-2 text-xs font-bold text-black transition active:scale-95"
                  >
                    Show lyrics
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-white/5 p-5 text-sm text-neutral-400">
                Lyrics are turned off. Enable
                them from the menu above.
              </div>
            )}
          </div>

          {/* Full lyrics overlay */}
          <AnimatePresence>
            {isFullLyricsOpen ? (
              <motion.div
                className="fixed inset-0 z-50 flex flex-col px-6"
                style={{
                  background: `
                    radial-gradient(
                      circle at 50% 8%,
                      ${theme.glow} 0%,
                      ${theme.primary} 28%,
                      ${theme.deep} 60%,
                      #121212 100%
                    ),
                    linear-gradient(
                      180deg,
                      ${theme.primary} 0%,
                      ${theme.deep} 55%,
                      #121212 100%
                    )
                  `,
                }}
                initial={{
                  opacity: 0,
                  y: 30,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                  y: 30,
                }}
              >
                <div className="flex items-center gap-3 py-5">
                  <button
                    type="button"
                    onClick={
                      closeFullLyrics
                    }
                    aria-label="Back"
                    className="rounded-full p-1 text-white"
                  >
                    <ChevronLeftIcon size={26} />
                  </button>

                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-white">
                      {song.title}
                    </p>

                    <p className="truncate text-xs text-white/70">
                      {song.artist ||
                        "Unknown artist"}
                    </p>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-hidden">
                  <SyncedLyrics
                    song={song}
                    progress={displayedProgress}
                    mode="full"
                    onSeek={(seconds) => {
                      setPendingSeekProgress(
                        seconds
                      );

                      seek(seconds);
                    }}
                  />
                </div>

                <div className="border-t border-white/10 pb-5 pt-3">
                  <div
                    ref={lyricsSeekTrackRef}
                    role="slider"
                    tabIndex={duration > 0 ? 0 : -1}
                    aria-label="Seek through song"
                    aria-valuemin={0}
                    aria-valuemax={duration}
                    aria-valuenow={displayedProgress}
                    aria-valuetext={`${formatTime(displayedProgress)} of ${formatTime(duration)}`}
                    aria-disabled={duration <= 0}
                    onPointerDown={
                      handleSeekPointerDown
                    }
                    onPointerMove={
                      handleSeekPointerMove
                    }
                    onPointerUp={finishSeek}
                    onPointerCancel={cancelSeek}
                    onLostPointerCapture={cancelSeek}
                    onKeyDown={handleSeekKeyDown}
                    className={`relative flex h-8 w-full touch-none items-center outline-none ${
                      duration > 0
                        ? "cursor-pointer"
                        : "cursor-not-allowed opacity-50"
                    }`}
                  >
                    <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/25">
                      <div
                        className="h-full origin-left rounded-full bg-white"
                        style={{
                          width: `${displayedProgressPercentage}%`,
                        }}
                      />
                    </div>

                    <div
                      className={`pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_1px_5px_rgba(0,0,0,0.5)] ${
                        isSeeking
                          ? "scale-110"
                          : "scale-100"
                      }`}
                      style={{
                        left: `${displayedProgressPercentage}%`,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="w-14 text-left text-xs text-white/60">
                      {formatTime(displayedProgress)}
                    </span>

                    <button
                      type="button"
                      onClick={togglePlay}
                      className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-black transition active:scale-95"
                      aria-label={
                        isPlaying
                          ? "Pause"
                          : "Play"
                      }
                    >
                      {isPlaying ? (
                        <PauseIcon
                          size={22}
                          fill="currentColor"
                        />
                      ) : (
                        <PlayIcon
                          size={22}
                          fill="currentColor"
                          className="ml-0.5"
                        />
                      )}
                    </button>

                    <span className="w-14 text-right text-xs text-white/60">
                      {formatTime(duration)}
                    </span>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <ConnectedDevices
            open={devicesOpen}
            onClose={() =>
              setDevicesOpen(false)
            }
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}