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
  MusicIcon,
  UserIcon,
} from "lucide-react";

import {
  ProfileMenu,
} from "../components/ProfileMenu";

import {
  SettingsScreen,
} from "../components/SettingsScreen";

import {
  MusicTriviaScreen,
} from "../components/MusicTriviaScreen";

import {
  usePlayer,
} from "../context/PlayerContext";

import {
  useProfile,
} from "../context/ProfileContext";

import {
  ScrollingSongText,
} from "../components/ScrollingSongText";

import {
  ArtistImageService,
} from "../services/ArtistImageService";

import type {
  Song,
} from "../types";

interface ArtistItem {
  id: string;
  name: string;
  playCount: number;
  image?: string;
}

interface ArtistHistoryItem {
  id: string;
  name: string;
  imageUrl?: string;
}

const TOP_ARTISTS_HISTORY_KEY =
  "audio-beat-home-top-artists-history";

const TOP_ARTISTS_IMAGE_CACHE =
  "audio-beat-home-top-artists-images-v1";

const MAX_TOP_ARTISTS = 10;

function normaliseArtistName(
  rawName:
    | string
    | undefined
    | null
): {
  id: string;
  name: string;
} | null {
  const name =
    rawName
      ?.trim()
      .replace(
        /\s+/g,
        " "
      ) ?? "";

  const id =
    name.toLocaleLowerCase();

  if (
    !name ||
    id === "unknown artist" ||
    id === "<unknown>" ||
    id === "various artists"
  ) {
    return null;
  }

  return {
    id,
    name,
  };
}

function loadTopArtistHistory():
  ArtistHistoryItem[] {
  try {
    const saved =
      window.localStorage.getItem(
        TOP_ARTISTS_HISTORY_KEY
      );

    if (!saved) {
      return [];
    }

    const parsed: unknown =
      JSON.parse(saved);

    if (!Array.isArray(parsed)) {
      return [];
    }

    const seen =
      new Set<string>();

    return parsed
      .filter(
        (
          value
        ): value is
          ArtistHistoryItem =>
          typeof value ===
            "object" &&
          value !== null &&
          "id" in value &&
          typeof value.id ===
            "string" &&
          "name" in value &&
          typeof value.name ===
            "string"
      )
      .map(
        (
          artist
        ) => ({
          id:
            artist.id
              .trim()
              .toLocaleLowerCase(),
          name:
            artist.name
              .trim()
              .replace(
                /\s+/g,
                " "
              ),
          imageUrl:
            typeof artist.imageUrl ===
              "string" &&
            artist.imageUrl.trim()
              ? artist.imageUrl
              : undefined,
        })
      )
      .filter(
        (
          artist
        ) => {
          if (
            !artist.id ||
            !artist.name ||
            seen.has(
              artist.id
            )
          ) {
            return false;
          }

          seen.add(
            artist.id
          );

          return true;
        }
      )
      .slice(
        0,
        MAX_TOP_ARTISTS
      );
  } catch {
    return [];
  }
}

function saveTopArtistHistory(
  artists: ArtistHistoryItem[]
): void {
  try {
    window.localStorage.setItem(
      TOP_ARTISTS_HISTORY_KEY,
      JSON.stringify(
        artists.slice(
          0,
          MAX_TOP_ARTISTS
        )
      )
    );
  } catch {
    // Ignore unavailable/full localStorage.
  }
}

async function getCachedArtistImage(
  imageUrl: string
): Promise<string | null> {
  if (
    !("caches" in window)
  ) {
    return null;
  }

  try {
    const cache =
      await window.caches.open(
        TOP_ARTISTS_IMAGE_CACHE
      );

    const response =
      await cache.match(
        imageUrl
      );

    if (!response) {
      return null;
    }

    const blob =
      await response.blob();

    if (
      blob.size <= 0
    ) {
      return null;
    }

    return URL.createObjectURL(
      blob
    );
  } catch {
    return null;
  }
}

async function cacheArtistImage(
  imageUrl: string
): Promise<string> {
  if (
    !("caches" in window)
  ) {
    return imageUrl;
  }

  try {
    const cache =
      await window.caches.open(
        TOP_ARTISTS_IMAGE_CACHE
      );

    const existing =
      await cache.match(
        imageUrl
      );

    if (existing) {
      const existingBlob =
        await existing.blob();

      if (
        existingBlob.size > 0
      ) {
        return URL.createObjectURL(
          existingBlob
        );
      }
    }

    const response =
      await fetch(
        imageUrl,
        {
          cache: "force-cache",
        }
      );

    if (!response.ok) {
      return imageUrl;
    }

    await cache.put(
      imageUrl,
      response.clone()
    );

    const blob =
      await response.blob();

    return blob.size > 0
      ? URL.createObjectURL(
          blob
        )
      : imageUrl;
  } catch {
    /*
     * If the image host blocks Cache API fetching,
     * keep the original URL so online behaviour is
     * exactly the same as before.
     */
    return imageUrl;
  }
}


const RECENTLY_PLAYED_AUTO_SCROLL_KEY =
  "audio-beat-home-recently-played-auto-scroll";

const TOP_ARTISTS_AUTO_SCROLL_KEY =
  "audio-beat-home-top-artists-auto-scroll";

const HOME_CAROUSEL_SETTINGS_EVENT =
  "audio-beat-home-carousel-settings-changed";

function loadAutoScrollSetting(
  key: string
): boolean {
  try {
    const saved =
      window.localStorage.getItem(
        key
      );

    return saved === null
      ? true
      : saved === "true";
  } catch {
    return true;
  }
}

function greetingForHour(
  hour: number
): string {
  if (
    hour >= 5 &&
    hour < 12
  ) {
    return "Good morning";
  }

  if (
    hour >= 12 &&
    hour < 17
  ) {
    return "Good afternoon";
  }

  if (
    hour >= 17 &&
    hour < 21
  ) {
    return "Good evening";
  }

  return "Good night";
}

interface ThreeDCarouselProps<T> {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T, active: boolean) => React.ReactNode;
  onSelect?: (item: T) => void;
  itemAriaLabel?: (item: T) => string;
  intervalMs?: number;
  autoAdvance?: boolean;
}

function ThreeDCarousel<T>({
  items,
  getKey,
  renderItem,
  onSelect,
  itemAriaLabel,
  intervalMs = 3800,
  autoAdvance = true,
}: ThreeDCarouselProps<T>) {
  const [
    activeIndex,
    setActiveIndex,
  ] = useState<number>(0);

  const gestureActiveRef =
    useRef<boolean>(
      false
    );

  const gestureStartXRef =
    useRef<number>(
      0
    );

  const gestureStartTimeRef =
    useRef<number>(
      0
    );

  const movedRef =
    useRef<boolean>(
      false
    );

  useEffect(() => {
    if (
      items.length === 0
    ) {
      setActiveIndex(0);
      return;
    }

    setActiveIndex(
      (current) =>
        current % items.length
    );
  }, [items.length]);

  useEffect(() => {
    if (
      !autoAdvance ||
      items.length <= 1
    ) {
      return;
    }

    const timer =
      window.setInterval(
        () => {
          if (
            gestureActiveRef.current
          ) {
            return;
          }

          setActiveIndex(
            (current) =>
              (
                current + 1
              ) % items.length
          );
        },
        intervalMs
      );

    return () =>
      window.clearInterval(
        timer
      );
  }, [
    autoAdvance,
    intervalMs,
    items.length,
  ]);

  function move(
    direction: number
  ): void {
    if (
      items.length <= 1
    ) {
      return;
    }

    setActiveIndex(
      (current) =>
        (
          current +
          direction +
          items.length
        ) % items.length
    );
  }

  function relativeOffset(
    itemIndex: number
  ): number {
    if (
      items.length <= 1
    ) {
      return 0;
    }

    let offset =
      itemIndex -
      activeIndex;

    const halfway =
      items.length / 2;

    if (
      offset > halfway
    ) {
      offset -=
        items.length;
    }

    if (
      offset < -halfway
    ) {
      offset +=
        items.length;
    }

    return offset;
  }

  function beginGesture(
    event:
      React.PointerEvent<HTMLDivElement>
  ): void {
    gestureActiveRef.current =
      true;

    movedRef.current =
      false;

    gestureStartXRef.current =
      event.clientX;

    gestureStartTimeRef.current =
      performance.now();

    event.currentTarget
      .setPointerCapture(
        event.pointerId
      );
  }

  function updateGesture(
    event:
      React.PointerEvent<HTMLDivElement>
  ): void {
    if (
      !gestureActiveRef.current
    ) {
      return;
    }

    if (
      Math.abs(
        event.clientX -
          gestureStartXRef.current
      ) > 8
    ) {
      movedRef.current =
        true;
    }
  }

  function endGesture(
    event:
      React.PointerEvent<HTMLDivElement>
  ): void {
    if (
      !gestureActiveRef.current
    ) {
      return;
    }

    const deltaX =
      event.clientX -
      gestureStartXRef.current;

    const elapsed =
      Math.max(
        1,
        performance.now() -
          gestureStartTimeRef.current
      );

    const velocity =
      deltaX / elapsed;

    gestureActiveRef.current =
      false;

    if (
      event.currentTarget.hasPointerCapture(
        event.pointerId
      )
    ) {
      event.currentTarget
        .releasePointerCapture(
          event.pointerId
        );
    }

    if (
      deltaX < -42 ||
      velocity < -0.42
    ) {
      move(1);
      return;
    }

    if (
      deltaX > 42 ||
      velocity > 0.42
    ) {
      move(-1);
    }
  }

  if (
    items.length === 0
  ) {
    return null;
  }

  return (
    <div
      className="relative h-[250px] overflow-hidden px-6"
      style={{
        perspective:
          "1200px",
        contain:
          "layout paint",
        touchAction:
          "pan-y",
      }}
      onPointerDown={
        beginGesture
      }
      onPointerMove={
        updateGesture
      }
      onPointerUp={
        endGesture
      }
      onPointerCancel={() => {
        gestureActiveRef.current =
          false;
      }}
    >
      {items.map(
        (
          item,
          itemIndex
        ) => {
          const offset =
            relativeOffset(
              itemIndex
            );

          const distance =
            Math.abs(offset);

          if (
            distance > 2
          ) {
            return null;
          }

          const active =
            offset === 0;

          return (
            <motion.div
              key={getKey(item)}
              className={`absolute left-1/2 top-2 origin-center will-change-transform ${
                active
                  ? "pointer-events-auto"
                  : "pointer-events-none"
              }`}
              initial={false}
              animate={{
                x:
                  `calc(-50% + ${
                    offset * 148
                  }px)`,
                y:
                  distance * 14,
                scale:
                  active
                    ? 1
                    : distance === 1
                      ? 0.78
                      : 0.62,
                rotateY:
                  offset * -26,
                opacity:
                  distance === 2
                    ? 0.22
                    : active
                      ? 1
                      : 0.56,
                zIndex:
                  30 - distance,
              }}
              transition={{
                duration: 0.32,
                ease: [
                  0.22,
                  1,
                  0.36,
                  1,
                ],
              }}
              style={{
                transformStyle:
                  "preserve-3d",
                backfaceVisibility:
                  "hidden",
              }}
              onClick={() => {
                if (
                  movedRef.current
                ) {
                  movedRef.current =
                    false;
                  return;
                }

                if (
                  active &&
                  onSelect
                ) {
                  onSelect(item);
                }
              }}
              role={
                onSelect
                  ? "button"
                  : undefined
              }
              tabIndex={
                active && onSelect
                  ? 0
                  : -1
              }
              aria-label={
                active &&
                itemAriaLabel
                  ? itemAriaLabel(
                      item
                    )
                  : undefined
              }
              onKeyDown={(
                event
              ) => {
                if (
                  !active ||
                  !onSelect
                ) {
                  return;
                }

                if (
                  event.key ===
                    "Enter" ||
                  event.key === " "
                ) {
                  event.preventDefault();
                  onSelect(item);
                }
              }}
            >
              {renderItem(
                item,
                active
              )}
            </motion.div>
          );
        }
      )}
    </div>
  );
}

const MemoThreeDCarousel =
  React.memo(
    ThreeDCarousel
  ) as typeof ThreeDCarousel;

function ContinuousSongRail({
  songs,
  currentSong,
  isPlaying,
  failedArtwork,
  onArtworkError,
  onPlay,
}: {
  songs: Song[];
  currentSong: Song | null;
  isPlaying: boolean;
  failedArtwork: Set<string>;
  onArtworkError: (songId: string) => void;
  onPlay: (songId: string) => void;
}) {
  const railRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const touchingRef =
    useRef(false);

  useEffect(() => {
    if (
      !railRef.current ||
      !songs.length
    ) {
      return;
    }

    let frame = 0;
    let initialized = false;

    const tick =
      (): void => {
        const node =
          railRef.current;

        if (!node) return;

        const segment =
          node.scrollWidth / 3;

        if (
          segment > 0 &&
          !initialized
        ) {
          node.scrollLeft =
            segment;

          initialized =
            true;
        }

        if (
          segment > 0 &&
          !touchingRef.current
        ) {
          node.scrollLeft +=
            0.36;

          if (
            node.scrollLeft >=
            segment * 2
          ) {
            node.scrollLeft -=
              segment;
          } else if (
            node.scrollLeft <=
            segment * 0.2
          ) {
            node.scrollLeft +=
              segment;
          }
        }

        frame =
          window.requestAnimationFrame(
            tick
          );
      };

    frame =
      window.requestAnimationFrame(
        tick
      );

    return () =>
      window.cancelAnimationFrame(
        frame
      );
  }, [songs.length]);

  if (!songs.length) return null;

  const repeated = [
    ...songs,
    ...songs,
    ...songs,
  ];

  return (
    <div
      ref={railRef}
      className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-4 pb-3"
      style={{
        scrollBehavior: "auto",
        overscrollBehaviorX:
          "contain",
      }}
      onPointerDown={() => {
        touchingRef.current =
          true;
      }}
      onPointerUp={() => {
        touchingRef.current =
          false;
      }}
      onPointerCancel={() => {
        touchingRef.current =
          false;
      }}
      onPointerLeave={() => {
        touchingRef.current =
          false;
      }}
    >
      {repeated.map(
        (
          song,
          index
        ) => {
          const showArtwork =
            Boolean(
              song.albumArt
            ) &&
            !failedArtwork.has(
              song.id
            );

          const playing =
            currentSong?.id ===
              song.id &&
            isPlaying;

          return (
            <button
              key={`${song.id}-${index}`}
              type="button"
              onClick={() =>
                onPlay(song.id)
              }
              className="flex w-[236px] flex-shrink-0 items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.055] p-3 text-left shadow-[0_10px_30px_rgba(0,0,0,0.18)] transition active:scale-[0.98]"
              aria-label={`Play ${song.title}`}
            >
              <span className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-white/10">
                {showArtwork ? (
                  <img
                    src={
                      song.albumArt
                    }
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                    onError={() =>
                      onArtworkError(
                        song.id
                      )
                    }
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-white/80">
                    <MusicIcon
                      size={24}
                    />
                  </span>
                )}
              </span>

              <span className="min-w-0 flex-1">
                {playing ? (
                  <ScrollingSongText
                    title={
                      song.title ||
                      "Unknown title"
                    }
                    artist={
                      song.artist?.trim() ||
                      "Unknown artist"
                    }
                    restartKey={`home-most-playing-${song.id}`}
                    className="min-w-0"
                    titleClassName="text-sm font-bold leading-5 text-white"
                    artistClassName="text-xs leading-4 text-white/45"
                    initialDelaySeconds={1.25}
                    pauseSeconds={1}
                    pixelsPerSecond={30}
                  />
                ) : (
                  <>
                    <span className="block truncate text-sm font-bold text-white">
                      {song.title ||
                        "Unknown title"}
                    </span>

                    <span className="mt-0.5 block truncate text-xs text-white/45">
                      {song.artist?.trim() ||
                        "Unknown artist"}
                    </span>
                  </>
                )}
              </span>
            </button>
          );
        }
      )}
    </div>
  );
}

const MemoContinuousSongRail =
  React.memo(
    ContinuousSongRail
  );

export interface HomeHandle {
  canGoBack: () => boolean;
  goBack: () => void;
}

export const Home =
  forwardRef<HomeHandle>(
    function Home(
      _props,
      ref
    ) {
  const {
    songs,
    playSong,
    isLoadingSongs,
    recentlyPlayedIds,
    playCounts,
    currentSong,
    isPlaying,
    togglePlay,
  } = usePlayer();

  const {
    username,
  } = useProfile();

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

  const [
    triviaOpen,
    setTriviaOpen,
  ] = useState<boolean>(
    false
  );

  useImperativeHandle(
    ref,
    () => ({
      canGoBack: () =>
        triviaOpen ||
        settingsOpen ||
        profileOpen,
      goBack: () => {
        if (triviaOpen) {
          setTriviaOpen(
            false
          );
          return;
        }

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
        }
      },
    }),
    [
      profileOpen,
      settingsOpen,
      triviaOpen,
    ]
  );

  const [
    failedArtwork,
    setFailedArtwork,
  ] = useState<
    Set<string>
  >(
    () => new Set()
  );

  const [
    failedArtistArtwork,
    setFailedArtistArtwork,
  ] = useState<
    Set<string>
  >(
    () => new Set()
  );

  const [
    artistImages,
    setArtistImages,
  ] = useState<
    Record<string, string>
  >({});

  const [
    topArtistHistory,
    setTopArtistHistory,
  ] = useState<
    ArtistHistoryItem[]
  >(
    loadTopArtistHistory
  );

  const artistObjectUrlsRef =
    useRef<Set<string>>(
      new Set()
    );

  const [
    currentHour,
    setCurrentHour,
  ] = useState<number>(
    () =>
      new Date().getHours()
  );

  const [
    showWelcome,
    setShowWelcome,
  ] = useState<boolean>(
    true
  );


  const [
    recentlyPlayedAutoScroll,
    setRecentlyPlayedAutoScroll,
  ] = useState<boolean>(
    () =>
      loadAutoScrollSetting(
        RECENTLY_PLAYED_AUTO_SCROLL_KEY
      )
  );

  const [
    topArtistsAutoScroll,
    setTopArtistsAutoScroll,
  ] = useState<boolean>(
    () =>
      loadAutoScrollSetting(
        TOP_ARTISTS_AUTO_SCROLL_KEY
      )
  );


  useEffect(() => {
    function refreshCarouselSettings():
      void {
      setRecentlyPlayedAutoScroll(
        loadAutoScrollSetting(
          RECENTLY_PLAYED_AUTO_SCROLL_KEY
        )
      );

      setTopArtistsAutoScroll(
        loadAutoScrollSetting(
          TOP_ARTISTS_AUTO_SCROLL_KEY
        )
      );
    }

    window.addEventListener(
      HOME_CAROUSEL_SETTINGS_EVENT,
      refreshCarouselSettings
    );

    window.addEventListener(
      "storage",
      refreshCarouselSettings
    );

    return () => {
      window.removeEventListener(
        HOME_CAROUSEL_SETTINGS_EVENT,
        refreshCarouselSettings
      );

      window.removeEventListener(
        "storage",
        refreshCarouselSettings
      );
    };
  }, []);

  const songQueue =
    useMemo(
      () =>
        songs.map(
          (
            song
          ) =>
            song.id
        ),
      [songs]
    );

  const recentSongs =
    useMemo(
      () => {
        const songsById =
          new Map(
            songs.map(
              (
                song
              ) => [
                song.id,
                song,
              ]
            )
          );

        return recentlyPlayedIds
          .map(
            (
              songId
            ) =>
              songsById.get(
                songId
              )
          )
          .filter(
            (
              song
            ): song is
              (typeof songs)[number] =>
              Boolean(song)
          )
          .slice(0, 10);
      },
      [
        recentlyPlayedIds,
        songs,
      ]
    );

  const topSongs =
    useMemo(
      () =>
        [...songs]
          .filter(
            (
              song
            ) =>
              (
                playCounts[
                  song.id
                ] ?? 0
              ) > 0
          )
          .sort(
            (
              firstSong,
              secondSong
            ) => {
              const countDifference =
                (
                  playCounts[
                    secondSong.id
                  ] ?? 0
                ) -
                (
                  playCounts[
                    firstSong.id
                  ] ?? 0
                );

              if (
                countDifference !==
                0
              ) {
                return countDifference;
              }

              const firstIndex =
                recentlyPlayedIds.indexOf(
                  firstSong.id
                );

              const secondIndex =
                recentlyPlayedIds.indexOf(
                  secondSong.id
                );

              const safeFirstIndex =
                firstIndex === -1
                  ? Number.MAX_SAFE_INTEGER
                  : firstIndex;

              const safeSecondIndex =
                secondIndex === -1
                  ? Number.MAX_SAFE_INTEGER
                  : secondIndex;

              return (
                safeFirstIndex -
                safeSecondIndex
              );
            }
          )
          .slice(0, 10),
      [
        playCounts,
        recentlyPlayedIds,
        songs,
      ]
    );


  const vinylSong =
    useMemo(
      () =>
        currentSong ??
        recentSongs[0] ??
        topSongs[0] ??
        songs[0] ??
        null,
      [
        currentSong,
        recentSongs,
        songs,
        topSongs,
      ]
    );

  const vinylIsCurrent =
    Boolean(
      vinylSong &&
      currentSong?.id ===
        vinylSong.id
    );

  function handleVinylPress():
    void {
    if (!vinylSong) {
      return;
    }

    if (vinylIsCurrent) {
      togglePlay();
      return;
    }

    handlePlaySong(
      vinylSong.id
    );
  }

  /*
   * Artist image candidates come from both the live
   * catalogue and the persisted Top Artists history.
   *
   * Keeping the history in the candidate pool means
   * cached Top Artists can still restore their images
   * at app startup even before the network is available.
   */
  const artistCandidates =
    useMemo<ArtistItem[]>(
      () => {
        const candidates =
          new Map<
            string,
            ArtistItem
          >();

        topArtistHistory.forEach(
          (
            artist
          ) => {
            candidates.set(
              artist.id,
              {
                id:
                  artist.id,
                name:
                  artist.name,
                playCount: 0,
                image:
                  artistImages[
                    artist.id
                  ],
              }
            );
          }
        );

        songs.forEach(
          (
            song
          ) => {
            const artist =
              normaliseArtistName(
                song.artist
              );

            if (!artist) {
              return;
            }

            if (
              !candidates.has(
                artist.id
              )
            ) {
              candidates.set(
                artist.id,
                {
                  ...artist,
                  playCount: 0,
                  image:
                    artistImages[
                      artist.id
                    ],
                }
              );
            }
          }
        );

        return Array.from(
          candidates.values()
        );
      },
      [
        artistImages,
        songs,
        topArtistHistory,
      ]
    );

  /*
   * Top Artists now uses the same recency behaviour as
   * Recently Played, but at artist level:
   *
   * play Artist A -> A is first
   * play Artist B -> B is first, A shifts back
   * play Artist A again -> A moves back to first
   *
   * Only the latest ten unique artists are retained.
   * Older artists naturally fall off the end.
   */
  const artists =
    useMemo<ArtistItem[]>(
      () => {
        const playCountByArtist =
          new Map<
            string,
            number
          >();

        songs.forEach(
          (
            song
          ) => {
            const artist =
              normaliseArtistName(
                song.artist
              );

            if (!artist) {
              return;
            }

            const count =
              playCounts[
                song.id
              ] ?? 0;

            playCountByArtist.set(
              artist.id,
              (
                playCountByArtist.get(
                  artist.id
                ) ?? 0
              ) + count
            );
          }
        );

        return topArtistHistory
          .map(
            (
              artist
            ) => ({
              id:
                artist.id,
              name:
                artist.name,
              playCount:
                playCountByArtist.get(
                  artist.id
                ) ?? 0,
              image:
                artistImages[
                  artist.id
                ],
            })
          )
          .slice(
            0,
            MAX_TOP_ARTISTS
          );
      },
      [
        artistImages,
        playCounts,
        songs,
        topArtistHistory,
      ]
    );

  /*
   * Keep Top artists visually clean:
   * artists without a successfully restored/fetched image
   * do not enter the carousel.
   */
  const artistsWithImages =
    useMemo(
      () =>
        artists.filter(
          (
            artist
          ) =>
            Boolean(
              artist.image
            ) &&
            !failedArtistArtwork.has(
              artist.id
            )
        ),
      [
        artists,
        failedArtistArtwork,
      ]
    );

  const greeting =
    greetingForHour(
      currentHour
    );

  const displayedUsername =
    username.trim() ||
    "there";

  useEffect(() => {
    const updateHour =
      (): void => {
        setCurrentHour(
          new Date().getHours()
        );
      };

    updateHour();

    const intervalId =
      window.setInterval(
        updateHour,
        60_000
      );

    return () => {
      window.clearInterval(
        intervalId
      );
    };
  }, []);

  useEffect(() => {
    const timeoutId =
      window.setTimeout(
        () => {
          setShowWelcome(
            false
          );
        },
        5000
      );

    return () => {
      window.clearTimeout(
        timeoutId
      );
    };
  }, []);

  /*
   * Update Top Artists from the most-recently-played song.
   * This is intentionally separate from play-count ranking.
   */
  useEffect(() => {
    const latestSong =
      recentSongs[0];

    if (!latestSong) {
      return;
    }

    const latestArtist =
      normaliseArtistName(
        latestSong.artist
      );

    if (!latestArtist) {
      return;
    }

    setTopArtistHistory(
      (
        current
      ) => {
        const existing =
          current.find(
            (
              artist
            ) =>
              artist.id ===
              latestArtist.id
          );

        const next:
          ArtistHistoryItem[] = [
            {
              ...latestArtist,
              imageUrl:
                existing?.imageUrl,
            },

            ...current.filter(
              (
                artist
              ) =>
                artist.id !==
                latestArtist.id
            ),
          ].slice(
            0,
            MAX_TOP_ARTISTS
          );

        saveTopArtistHistory(
          next
        );

        return next;
      }
    );
  }, [
    recentSongs,
  ]);

  /*
   * Existing users may already have play-count data but
   * no Top Artists history yet. Seed the new recency list
   * once so the carousel is not suddenly empty after the
   * update. After this bootstrap, new plays use the
   * recency behaviour above.
   */
  useEffect(() => {
    if (
      topArtistHistory.length > 0 ||
      songs.length === 0
    ) {
      return;
    }

    const totals =
      new Map<
        string,
        {
          id: string;
          name: string;
          count: number;
          recentIndex: number;
        }
      >();

    songs.forEach(
      (
        song
      ) => {
        const artist =
          normaliseArtistName(
            song.artist
          );

        if (!artist) {
          return;
        }

        const count =
          playCounts[
            song.id
          ] ?? 0;

        if (count <= 0) {
          return;
        }

        const songRecentIndex =
          recentlyPlayedIds.indexOf(
            song.id
          );

        const safeRecentIndex =
          songRecentIndex === -1
            ? Number.MAX_SAFE_INTEGER
            : songRecentIndex;

        const existing =
          totals.get(
            artist.id
          );

        totals.set(
          artist.id,
          existing
            ? {
                ...existing,
                count:
                  existing.count +
                  count,
                recentIndex:
                  Math.min(
                    existing.recentIndex,
                    safeRecentIndex
                  ),
              }
            : {
                ...artist,
                count,
                recentIndex:
                  safeRecentIndex,
              }
        );
      }
    );

    const seeded =
      Array.from(
        totals.values()
      )
        .sort(
          (
            first,
            second
          ) => {
            if (
              first.recentIndex !==
              second.recentIndex
            ) {
              return (
                first.recentIndex -
                second.recentIndex
              );
            }

            return (
              second.count -
              first.count
            );
          }
        )
        .slice(
          0,
          MAX_TOP_ARTISTS
        )
        .map(
          (
            artist
          ) => ({
            id:
              artist.id,
            name:
              artist.name,
          })
        );

    if (
      seeded.length > 0
    ) {
      saveTopArtistHistory(
        seeded
      );

      setTopArtistHistory(
        seeded
      );
    }
  }, [
    playCounts,
    recentlyPlayedIds,
    songs,
    topArtistHistory.length,
  ]);

  /*
   * Restore actual cached artist-image bytes from the
   * browser Cache Storage. This makes Top Artists artwork
   * available after an offline app startup instead of
   * depending on the remote TheAudioDB image URL.
   */
  useEffect(() => {
    let cancelled = false;

    void Promise.all(
      topArtistHistory.map(
        async (
          artist
        ) => {
          if (
            !artist.imageUrl ||
            artistImages[
              artist.id
            ]
          ) {
            return;
          }

          const cachedImage =
            await getCachedArtistImage(
              artist.imageUrl
            );

          if (
            cancelled ||
            !cachedImage
          ) {
            return;
          }

          artistObjectUrlsRef.current.add(
            cachedImage
          );

          setArtistImages(
            (
              current
            ) => ({
              ...current,
              [artist.id]:
                cachedImage,
            })
          );
        }
      )
    );

    return () => {
      cancelled = true;
    };
  }, [
    artistImages,
    topArtistHistory,
  ]);

  /*
   * Revoke blob URLs when Home unmounts.
   */
  useEffect(
    () => () => {
      artistObjectUrlsRef.current.forEach(
        (
          objectUrl
        ) => {
          URL.revokeObjectURL(
            objectUrl
          );
        }
      );

      artistObjectUrlsRef.current.clear();
    },
    []
  );

  useEffect(() => {
    let cancelled = false;

    void Promise.all(
      artistCandidates.map(
        async (
          artist
        ) => {
          if (
            artist.image ||
            failedArtistArtwork.has(
              artist.id
            )
          ) {
            return;
          }

          const image =
            await ArtistImageService
              .getArtistImage(
                artist.name
              );

          if (
            cancelled ||
            !image
          ) {
            return;
          }

          const displayImage =
            await cacheArtistImage(
              image
            );

          if (cancelled) {
            if (
              displayImage !==
              image &&
              displayImage.startsWith(
                "blob:"
              )
            ) {
              URL.revokeObjectURL(
                displayImage
              );
            }

            return;
          }

          if (
            displayImage.startsWith(
              "blob:"
            )
          ) {
            artistObjectUrlsRef.current.add(
              displayImage
            );
          }

          setArtistImages(
            (
              current
            ) => ({
              ...current,
              [artist.id]:
                displayImage,
            })
          );

          setTopArtistHistory(
            (
              current
            ) => {
              const next =
                current.map(
                  (
                    historyArtist
                  ) =>
                    historyArtist.id ===
                    artist.id
                      ? {
                          ...historyArtist,
                          imageUrl:
                            image,
                        }
                      : historyArtist
                );

              saveTopArtistHistory(
                next
              );

              return next;
            }
          );
        }
      )
    );

    return () => {
      cancelled = true;
    };
  }, [
    artistCandidates,
    failedArtistArtwork,
  ]);

  const handlePlaySong =
    useCallback(
      (songId: string): void => {
        playSong(
          songId,
          songQueue
        );
      },
      [
        playSong,
        songQueue,
      ]
    );

  const handleArtworkError =
    useCallback(
      (songId: string): void => {
        setFailedArtwork(
          (current) => {
            const next =
              new Set(
                current
              );

            next.add(
              songId
            );

            return next;
          }
        );
      },
      []
    );

  const handleArtistArtworkError =
    useCallback(
      (artistId: string): void => {
        setFailedArtistArtwork(
          (current) => {
            const next =
              new Set(
                current
              );

            next.add(
              artistId
            );

            return next;
          }
        );
      },
      []
    );

  const renderRecentSong =
    useCallback(
      (
        song: Song,
        active: boolean
      ): React.ReactNode => {
        const showArtwork =
          Boolean(song.albumArt) &&
          !failedArtwork.has(
            song.id
          );

        const playing =
          currentSong?.id ===
            song.id &&
          isPlaying;

        return (
          <div className="w-[150px] text-center">
            <div
              className={`relative aspect-square overflow-hidden rounded-[22px] bg-white/10 shadow-[0_18px_42px_rgba(0,0,0,0.42)] ring-1 transition ${
                active
                  ? "ring-white/20"
                  : "ring-white/[0.06]"
              }`}
            >
              {showArtwork ? (
                <img
                  src={song.albumArt}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                  onError={() =>
                    handleArtworkError(
                      song.id
                    )
                  }
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-500/20 to-white/[0.03] text-white/90">
                  <MusicIcon
                    size={42}
                  />
                </div>
              )}

              {playing ? (
                <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-white backdrop-blur">
                  Playing
                </span>
              ) : null}
            </div>

            {playing ? (
              <ScrollingSongText
                title={
                  song.title ||
                  "Unknown title"
                }
                artist={
                  song.artist?.trim() ||
                  "Unknown artist"
                }
                restartKey={`home-recent-playing-${song.id}`}
                className="mt-3 min-w-0"
                titleClassName="text-sm font-extrabold leading-5 text-white"
                artistClassName="text-xs leading-4 text-white/45"
                initialDelaySeconds={1.25}
                pauseSeconds={1}
                pixelsPerSecond={30}
              />
            ) : (
              <div className="mt-3 min-w-0">
                <p className="truncate text-sm font-extrabold text-white">
                  {song.title ||
                    "Unknown title"}
                </p>

                <p className="mt-0.5 truncate text-xs text-white/45">
                  {song.artist?.trim() ||
                    "Unknown artist"}
                </p>
              </div>
            )}
          </div>
        );
      },
      [
        currentSong?.id,
        failedArtwork,
        handleArtworkError,
        isPlaying,
      ]
    );

  const renderTopArtist =
    useCallback(
      (
        artist: ArtistItem,
        active: boolean
      ): React.ReactNode => (
        <div className="w-[144px] text-center">
          <div
            className={`mx-auto h-[132px] w-[132px] overflow-hidden rounded-full bg-white/10 shadow-[0_18px_40px_rgba(0,0,0,0.4)] ring-2 transition ${
              active
                ? "ring-purple-300/35"
                : "ring-white/[0.07]"
            }`}
          >
            <img
              src={artist.image}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
              onError={() =>
                handleArtistArtworkError(
                  artist.id
                )
              }
            />
          </div>

          <p className="mt-3 truncate text-sm font-bold text-white">
            {artist.name}
          </p>
        </div>
      ),
      [handleArtistArtworkError]
    );

  const getSongKey =
    useCallback(
      (song: Song): string =>
        song.id,
      []
    );

  const selectRecentSong =
    useCallback(
      (song: Song): void => {
        handlePlaySong(
          song.id
        );
      },
      [handlePlaySong]
    );

  const recentSongAriaLabel =
    useCallback(
      (song: Song): string =>
        `Play ${song.title}`,
      []
    );

  const getArtistKey =
    useCallback(
      (artist: ArtistItem): string =>
        artist.id,
      []
    );

  return (
    <div className="min-h-full pb-4">
      <header className="px-4 pb-3 pt-5">
        <div className="grid grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-3">
          <button
            type="button"
            onClick={() =>
              setProfileOpen(
                true
              )
            }
            aria-label="Open profile menu"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 ring-2 ring-white/10 transition hover:bg-white/15 hover:ring-white/20 active:scale-95"
          >
            <UserIcon
              size={21}
              className="text-white"
            />
          </button>

          <div className="relative col-start-2 flex min-w-0 items-center justify-center overflow-hidden px-3">
            <AnimatePresence mode="wait" initial={false}>
              {showWelcome ? (
                <motion.div
                  key="home-hello"
                  initial={{
                    opacity: 0,
                    scale: 0.96,
                  }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                  }}
                  exit={{
                    opacity: 0,
                    scale: 0.96,
                  }}
                  transition={{
                    duration: 0.45,
                    ease: "easeOut",
                  }}
                  className="flex w-full translate-x-2 justify-center"
                >
                  <svg
                    viewBox="0 0 1230.94 414.57"
                    className="h-10 w-full max-w-[160px]"
                    aria-label="Hello"
                  >
                    <path
                      d="M-293.58-104.62S-103.61-205.49-60-366.25c9.13-32.45,9-58.31,0-74-10.72-18.82-49.69-33.21-75.55,31.94-27.82,70.11-52.22,377.24-44.11,322.48s34-176.24,99.89-183.19c37.66-4,49.55,23.58,52.83,47.92a117.06,117.06,0,0,1-3,45.32c-7.17,27.28-20.47,97.67,33.51,96.86,66.93-1,131.91-53.89,159.55-84.49,31.1-36.17,31.1-70.64,19.27-90.25-16.74-29.92-69.47-33-92.79,16.73C62.78-179.86,98.7-93.8,159-81.63S302.7-99.55,393.3-269.92c29.86-58.16,52.85-114.71,46.14-150.08-7.44-39.21-59.74-54.5-92.87-8.7-47,65-61.78,266.62-34.74,308.53S416.62-58,481.52-130.31s133.2-188.56,146.54-256.23c14-71.15-56.94-94.64-88.4-47.32C500.53-375,467.58-229.49,503.3-127a73.73,73.73,0,0,0,23.43,33.67c25.49,20.23,55.1,16,77.46,6.32a111.25,111.25,0,0,0,30.44-19.87c37.73-34.23,29-36.71,64.58-127.53C724-284.3,785-298.63,821-259.13a71,71,0,0,1,13.69,22.56c17.68,46,6.81,80-6.81,107.89-12,24.62-34.56,42.72-61.45,47.91-23.06,4.45-48.37-.35-66.48-24.27a78.88,78.88,0,0,1-12.66-25.8c-14.75-51,4.14-88.76,11-101.41,6.18-11.39,37.26-69.61,103.42-42.24,55.71,23.05,100.66-23.31,100.66-23.31"
                      transform="translate(311.08 476.02)"
                      fill="none"
                      stroke="white"
                      strokeLinecap="round"
                      strokeMiterlimit={10}
                      strokeWidth={35}
                      pathLength={1}
                      className="[stroke-dasharray:1] [stroke-dashoffset:1] animate-[homeHelloDraw_5s_linear_forwards]"
                    />
                  </svg>
                </motion.div>
              ) : (
                <motion.div
                  key="home-brand"
                  initial={{
                    opacity: 0,
                    y: 5,
                    scale: 0.96,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                  }}
                  transition={{
                    duration: 0.45,
                    ease: "easeOut",
                  }}
                  className="flex w-full justify-center"
                >
                  <span
                    className="translate-x-2 whitespace-nowrap text-[22px] font-semibold tracking-wide text-purple-400"
                    style={{
                      fontFamily:
                        '"Brush Script MT", "Segoe Script", cursive',
                    }}
                    aria-label="Audio Beat"
                  >
                    Audio Beat ♫
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <span
            className="h-10 w-10"
            aria-hidden="true"
          />
        </div>

        <AnimatePresence initial={false}>
          {showWelcome ? (
            <motion.div
              key="home-greeting"
              initial={{
                opacity: 0,
                height: 0,
                marginTop: 0,
              }}
              animate={{
                opacity: 1,
                height: "auto",
                marginTop: 16,
              }}
              exit={{
                opacity: 0,
                height: 0,
                marginTop: 0,
              }}
              transition={{
                duration: 0.5,
                ease: "easeInOut",
              }}
              className="overflow-hidden"
            >
              <h1 className="text-2xl font-extrabold leading-tight text-white">
                {greeting},{" "}
                {displayedUsername}
              </h1>

              <p className="mt-1 text-sm text-neutral-400">
                Let the music set your mood
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <style>
          {`
            @keyframes homeVinylSpin {
              from {
                transform: translate3d(0, 0, 0) rotate(0deg);
              }

              to {
                transform: translate3d(0, 0, 0) rotate(360deg);
              }
            }

            @keyframes homeHelloDraw {
              0%,
              25% {
                stroke-dashoffset: 1;
              }

              100% {
                stroke-dashoffset: 0;
              }
            }
          `}
        </style>
      </header>

      {isLoadingSongs ? (
        <div
          className="animate-pulse"
          aria-label="Loading your music"
          aria-busy="true"
        >
          <section className="pt-4">
            <div className="mx-4 h-6 w-36 rounded-md bg-white/10" />
            <div className="mx-auto mt-4 h-[190px] w-[152px] rounded-2xl bg-white/10" />
          </section>

          <section className="pt-8">
            <div className="mx-4 h-5 w-32 rounded-md bg-white/10" />
            <div className="mx-auto mt-4 h-28 w-28 rounded-full bg-white/10" />
          </section>

          <section className="pt-8">
            <div className="mx-4 h-5 w-28 rounded-md bg-white/10" />
            <div className="no-scrollbar mt-4 flex gap-3 overflow-hidden px-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`most-played-shimmer-${index}`}
                  className="h-20 w-[236px] flex-shrink-0 rounded-2xl bg-white/10"
                />
              ))}
            </div>
          </section>
        </div>
      ) : songs.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <MusicIcon size={36} className="mx-auto text-neutral-600" />
          <h2 className="mt-4 text-lg font-bold text-white">
            No songs available
          </h2>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-5 text-neutral-400">
            Songs from your connected music catalogue will appear here.
          </p>
        </div>
      ) : (
        <>
          <section className="pt-4">
            <div className="flex items-end justify-between px-4">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Recently played
                </h2>
              </div>
            </div>

            {recentSongs.length > 0 ? (
              <div className="mt-3">
                <MemoThreeDCarousel
                  items={recentSongs}
                  getKey={getSongKey}
                  onSelect={
                    selectRecentSong
                  }
                  itemAriaLabel={
                    recentSongAriaLabel
                  }
                  renderItem={
                    renderRecentSong
                  }
                  autoAdvance={
                    recentlyPlayedAutoScroll
                  }
                />
              </div>
            ) : (
              <p className="px-4 pt-3 text-sm text-neutral-500">
                Songs you play will appear here.
              </p>
            )}
          </section>

          <section className="pt-2">
            <div className="flex items-end justify-between px-4">
              <div>
                <h2 className="text-lg font-bold text-white">
                  Top artists
                </h2>
              </div>
            </div>

            {artistsWithImages.length > 0 ? (
              <div className="mt-3">
                <MemoThreeDCarousel
                  items={artistsWithImages}
                  getKey={getArtistKey}
                  renderItem={
                    renderTopArtist
                  }
                  autoAdvance={
                    topArtistsAutoScroll
                  }
                />
              </div>
            ) : (
              <p className="px-4 pt-3 text-sm text-neutral-500">
              </p>
            )}
          </section>

          <section className="pt-2">
            <div className="flex items-end justify-between px-4">
              <div>
                <h2 className="text-lg font-bold text-white">
                  Most played
                </h2>
              </div>
            </div>

            {topSongs.length > 0 ? (
              <MemoContinuousSongRail
                songs={topSongs}
                currentSong={currentSong}
                isPlaying={isPlaying}
                failedArtwork={failedArtwork}
                onArtworkError={handleArtworkError}
                onPlay={handlePlaySong}
              />
            ) : (
              <p className="px-4 pt-3 text-sm text-neutral-500">
                Your most-played songs will appear here as you listen.
              </p>
            )}
          </section>

          <section className="px-4 pb-3 pt-8">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">
                  On the turntable
                </h2>

              </div>
            </div>

            {vinylSong ? (
              <div className="mt-4 overflow-hidden rounded-[28px] border border-white/[0.07] bg-white/[0.035] px-5 py-6 shadow-[0_18px_48px_rgba(0,0,0,0.28)]">
                <div className="flex flex-col items-center">
                  <motion.button
                    type="button"
                    onClick={
                      handleVinylPress
                    }
                    className="relative flex h-[238px] w-[238px] items-center justify-center rounded-full outline-none active:scale-[0.985]"
                    aria-label={
                      vinylIsCurrent &&
                      isPlaying
                        ? `Pause ${vinylSong.title}`
                        : `Play ${vinylSong.title}`
                    }
                    whileTap={{
                      scale: 0.98,
                    }}
                  >
                    <span
                      className="absolute inset-0 rounded-full shadow-[0_24px_55px_rgba(0,0,0,0.55)]"
                      style={{
                        background:
                          "repeating-radial-gradient(circle at center, #0b0b0b 0px, #0b0b0b 3px, #171717 4px, #0b0b0b 7px)",
                        animation:
                          "homeVinylSpin 8s linear infinite",
                        animationPlayState:
                          vinylIsCurrent &&
                          isPlaying
                            ? "running"
                            : "paused",
                        willChange:
                          "transform",
                        backfaceVisibility:
                          "hidden",
                        WebkitBackfaceVisibility:
                          "hidden",
                        contain:
                          "paint",
                        isolation:
                          "isolate",
                      }}
                    >
                      <span className="absolute inset-[8%] rounded-full border border-white/[0.05]" />
                      <span className="absolute inset-[16%] rounded-full border border-white/[0.045]" />
                      <span className="absolute inset-[24%] rounded-full border border-white/[0.04]" />

                      <span className="absolute left-1/2 top-1/2 h-[104px] w-[104px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border-[5px] border-neutral-900 bg-neutral-800 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
                        {vinylSong.albumArt &&
                        !failedArtwork.has(
                          vinylSong.id
                        ) ? (
                          <img
                            src={
                              vinylSong.albumArt
                            }
                            alt=""
                            className="h-full w-full object-cover"
                            onError={() =>
                              handleArtworkError(
                                vinylSong.id
                              )
                            }
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-500/35 to-black text-white/85">
                            <MusicIcon
                              size={34}
                            />
                          </span>
                        )}
                      </span>

                    </span>
                  </motion.button>

                  <div className="mt-5 w-full min-w-0 text-center">
                    <p className="truncate text-base font-extrabold text-white">
                      {vinylSong.title ||
                        "Unknown title"}
                    </p>

                    <p className="mt-1 truncate text-sm text-white/45">
                      {vinylSong.artist?.trim() ||
                        "Unknown artist"}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
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
        onOpenTrivia={() => {
          setProfileOpen(
            false
          );

          setTriviaOpen(
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

      <AnimatePresence>
        {triviaOpen ? (
          <MusicTriviaScreen
            onBack={() =>
              setTriviaOpen(
                false
              )
            }
          />
        ) : null}
      </AnimatePresence>
    </div>
      );
    }
  );

Home.displayName = "Home";