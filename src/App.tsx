import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  App as CapacitorApp,
} from "@capacitor/app";

import type {
  PluginListenerHandle,
} from "@capacitor/core";

import {
  AnimatePresence,
  motion,
} from "framer-motion";

import { Toaster } from "sonner";

import {
  PlayerProvider,
  usePlayer,
} from "./context/PlayerContext";

import { AudioPlayer } from "./plugins/AudioPlayer";

import {
  ProfileProvider,
  useProfile,
} from "./context/ProfileContext";

import {
  BottomNav,
  Tab,
} from "./components/BottomNav";

import { NowPlayingBar } from "./components/NowPlayingBar";
import { NowPlayingScreen } from "./components/NowPlayingScreen";
import {
  closeConnectedDevicesOverlay,
  isConnectedDevicesOverlayOpen,
} from "./components/ConnectedDevices";
import { UsernameSetupModal } from "./components/UsernameSetupModal";
import { LaunchScreen } from "./components/LaunchScreen";

import { Home } from "./pages/Home";

import type {
  HomeHandle,
} from "./pages/Home";

import { Search } from "./pages/Search";
import { Albums } from "./pages/Albums";

import type {
  AlbumsHandle,
} from "./pages/Albums";

import { Library } from "./pages/Library";

import type {
  LibraryHandle,
} from "./pages/Library";

import { LocalFiles } from "./pages/LocalFiles";

type LibraryView =
  | "library"
  | "local-files";

function AppShell() {
  const [tab, setTab] =
    useState<Tab>("home");

  const [
    libraryView,
    setLibraryView,
  ] = useState<LibraryView>(
    "library"
  );

  const [
    exitConfirmOpen,
    setExitConfirmOpen,
  ] = useState<boolean>(false);

  const [
    isExiting,
    setIsExiting,
  ] = useState<boolean>(false);

  const [
    launchVisible,
    setLaunchVisible,
  ] = useState<boolean>(true);

  const {
    currentSong,
    isPlayerOpen,
    closePlayer,
    isFullLyricsOpen,
    closeFullLyrics,
  } = usePlayer();

  const {
    hasCompletedProfileSetup,
    setUsername,
  } = useProfile();

  const homeRef =
    useRef<HomeHandle>(null);

  const libraryRef =
    useRef<LibraryHandle>(null);

  const albumsRef =
    useRef<AlbumsHandle>(null);

  const homeScrollRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const searchScrollRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const albumsScrollRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const libraryScrollRef =
    useRef<HTMLDivElement | null>(
      null
    );

  /*
   * Refs make sure the native Android back-button
   * listener always sees the latest React state.
   */
  const tabRef =
    useRef<Tab>(tab);

  const libraryViewRef =
    useRef<LibraryView>(
      libraryView
    );

  const isPlayerOpenRef =
    useRef<boolean>(
      isPlayerOpen
    );

  const isFullLyricsOpenRef =
    useRef<boolean>(
      isFullLyricsOpen
    );

  const exitConfirmOpenRef =
    useRef<boolean>(
      exitConfirmOpen
    );

  const profileSetupCompleteRef =
    useRef<boolean>(
      hasCompletedProfileSetup
    );

  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);

  useEffect(() => {
    libraryViewRef.current =
      libraryView;
  }, [libraryView]);

  useEffect(() => {
    isPlayerOpenRef.current =
      isPlayerOpen;
  }, [isPlayerOpen]);

  useEffect(() => {
    isFullLyricsOpenRef.current =
      isFullLyricsOpen;
  }, [isFullLyricsOpen]);

  useEffect(() => {
    exitConfirmOpenRef.current =
      exitConfirmOpen;
  }, [exitConfirmOpen]);

  useEffect(() => {
    profileSetupCompleteRef.current =
      hasCompletedProfileSetup;
  }, [hasCompletedProfileSetup]);

  useEffect(() => {
    const timer =
      window.setTimeout(
        () =>
          setLaunchVisible(
            false
          ),
        2100
      );

    return () =>
      window.clearTimeout(
        timer
      );
  }, []);

  const handleTabChange =
    useCallback(
      (
        nextTab: Tab
      ): void => {
        if (
          tabRef.current ===
          nextTab
        ) {
          if (
            nextTab ===
            "library"
          ) {
            setLibraryView(
              "library"
            );

            window.requestAnimationFrame(
              () => {
                libraryScrollRef.current?.scrollTo(
                  {
                    top: 0,
                    behavior:
                      "smooth",
                  }
                );
              }
            );
          } else if (
            nextTab ===
            "albums"
          ) {
            if (
              albumsRef.current?.canGoBack()
            ) {
              albumsRef.current.goBack();
            }

            window.requestAnimationFrame(
              () => {
                albumsScrollRef.current?.scrollTo(
                  {
                    top: 0,
                    behavior:
                      "smooth",
                  }
                );
              }
            );
          } else {
            const scrollContainer =
              nextTab ===
              "home"
                ? homeScrollRef.current
                : searchScrollRef.current;

            scrollContainer?.scrollTo(
              {
                top: 0,
                behavior:
                  "smooth",
              }
            );
          }

          setExitConfirmOpen(
            false
          );

          return;
        }

        setTab(nextTab);

        setLibraryView(
          "library"
        );

        setExitConfirmOpen(
          false
        );
      },
      []
    );

  const openLocalFiles =
    useCallback((): void => {
      setLibraryView(
        "local-files"
      );
    }, []);

  const closeLocalFiles =
    useCallback((): void => {
      setLibraryView(
        "library"
      );
    }, []);

  const requestExit =
    useCallback((): void => {
      if (isExiting) {
        return;
      }

      setExitConfirmOpen(
        true
      );
    }, [isExiting]);

  const cancelExit =
    useCallback((): void => {
      if (isExiting) {
        return;
      }

      setExitConfirmOpen(
        false
      );
    }, [isExiting]);

  const confirmExit =
    useCallback(
      async (): Promise<void> => {
        if (isExiting) {
          return;
        }

        setIsExiting(
          true
        );

        setExitConfirmOpen(
          false
        );

        try {
          /*
           * Stop Media3 playback, clear the queue and
           * remove the playback notification before
           * closing the Android Activity.
           */
          await AudioPlayer.release();
        } catch (error) {
          console.warn(
            "Unable to release playback before exiting:",
            error
          );
        } finally {
          /*
           * Exit only after the native player has been
           * asked to stop.
           */
          await CapacitorApp.exitApp();
        }
      },
      [isExiting]
    );

  useEffect(() => {
    let listener:
      | PluginListenerHandle
      | undefined;

    let disposed = false;

    async function installBackButtonListener():
      Promise<void> {
      const nextListener =
        await CapacitorApp.addListener(
          "backButton",
          () => {
            /*
             * Ignore further back presses while
             * the app is already exiting.
             */
            if (isExiting) {
              return;
            }

            /*
             * The mandatory username modal cannot
             * be bypassed with Android's back button.
             */
            if (
              launchVisible ||
              !profileSetupCompleteRef.current
            ) {
              return;
            }

            /*
             * 1. Close the connected-devices sheet first.
             *
             * This applies whether the sheet was opened from
             * Now Playing or from the mini Now Playing bar.
             */
            if (
              isConnectedDevicesOverlayOpen()
            ) {
              closeConnectedDevicesOverlay();
              return;
            }

            /*
             * 2. Close the full lyrics overlay first,
             *    while keeping Now Playing open.
             */
            if (
              isFullLyricsOpenRef.current
            ) {
              closeFullLyrics();
              return;
            }

            /*
             * 3. Close Now Playing.
             */
            if (
              isPlayerOpenRef.current
            ) {
              closePlayer();
              return;
            }

            /*
             * 4. Close an already-open exit dialog.
             */
            if (
              exitConfirmOpenRef.current
            ) {
              setExitConfirmOpen(
                false
              );

              return;
            }

            /*
             * 5. Let Home close its top-most overlay first:
             *    Music Trivia -> Settings -> Profile drawer.
             *
             * HomeHandle owns that order so Android's hardware/
             * gesture back button behaves the same as the UI back.
             */
            if (
              tabRef.current ===
                "home" &&
              homeRef.current?.canGoBack()
            ) {
              homeRef.current.goBack();
              return;
            }

            /*
             * 6. Close an open album preview and return
             *    to the main Albums grid.
             */
            if (
              tabRef.current ===
                "albums" &&
              albumsRef.current?.canGoBack()
            ) {
              albumsRef.current.goBack();
              return;
            }

            /*
             * 7. Navigate from Local Files back to
             *    the main Library screen.
             */
            if (
              tabRef.current ===
                "library" &&
              libraryViewRef.current ===
                "local-files"
            ) {
              setLibraryView(
                "library"
              );

              return;
            }

            /*
             * 8. Let Library handle its own internal
             *    screens and modals before exiting.
             *
             *    Add Songs -> Playlist -> Library
             */
            if (
              tabRef.current ===
                "library" &&
              libraryViewRef.current ===
                "library" &&
              libraryRef.current?.canGoBack()
            ) {
              libraryRef.current.goBack();
              return;
            }

            /*
             * 9. Treat bottom tabs as root screens
             *    and ask before exiting.
             */
            requestExit();
          }
        );

      /*
       * addListener() is asynchronous.
       *
       * If this effect has already been cleaned up
       * before Capacitor finishes creating the native
       * listener, remove the newly-created listener
       * immediately instead of leaving it registered.
       */
      if (disposed) {
        void nextListener.remove();
        return;
      }

      listener =
        nextListener;
    }

    void installBackButtonListener();

    return () => {
      disposed = true;

      if (listener) {
        void listener.remove();
        listener =
          undefined;
      }
    };
  }, [
    closeFullLyrics,
    closePlayer,
    isExiting,
    launchVisible,
    requestExit,
  ]);

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[#121212] text-white">
      <div
        className={`flex min-h-0 flex-1 flex-col transition-opacity duration-500 ${
          launchVisible
            ? "pointer-events-none opacity-0"
            : "opacity-100"
        }`}
        aria-hidden={
          launchVisible
        }
      >
        <main className="min-h-0 flex-1 overflow-hidden">
          <div
            ref={
              homeScrollRef
            }
            className={`no-scrollbar h-full overflow-y-auto ${
              tab === "home"
                ? "block"
                : "hidden"
            }`}
          >
            <Home
              ref={homeRef}
            />
          </div>

          <div
            ref={
              searchScrollRef
            }
            className={`no-scrollbar h-full overflow-y-auto ${
              tab === "search"
                ? "block"
                : "hidden"
            }`}
          >
            <Search />
          </div>

          <div
            ref={
              albumsScrollRef
            }
            className={`no-scrollbar h-full overflow-y-auto ${
              tab === "albums"
                ? "block"
                : "hidden"
            }`}
          >
            <Albums
              ref={
                albumsRef
              }
            />
          </div>

          <div
            ref={
              libraryScrollRef
            }
            className={`no-scrollbar h-full overflow-y-auto ${
              tab === "library"
                ? "block"
                : "hidden"
            }`}
          >
            {libraryView ===
            "library" ? (
              <Library
                ref={
                  libraryRef
                }
                onOpenLocalFiles={
                  openLocalFiles
                }
              />
            ) : (
              <LocalFiles
                onBack={
                  closeLocalFiles
                }
              />
            )}
          </div>
        </main>

        {currentSong && (
          <NowPlayingBar />
        )}

        <BottomNav
          active={tab}
          onChange={
            handleTabChange
          }
        />

        <NowPlayingScreen />

        <AnimatePresence>
          {exitConfirmOpen ? (
            <motion.div
              className="fixed inset-0 z-[100] flex items-center justify-center px-6"
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
                duration: 0.18,
              }}
              role="presentation"
            >
              <button
                type="button"
                className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
                aria-label="Cancel exit"
                onClick={
                  cancelExit
                }
              />

              <motion.div
                className="relative z-10 w-full max-w-[300px] rounded-2xl border border-white/10 bg-neutral-900 px-6 py-6 shadow-[0_24px_70px_rgba(0,0,0,0.62)]"
                initial={{
                  opacity: 0,
                  scale: 0.94,
                  y: 8,
                }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                  scale: 0.96,
                  y: 6,
                }}
                transition={{
                  type: "spring",
                  stiffness: 360,
                  damping: 28,
                }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="exit-app-title"
              >
                <h2
                  id="exit-app-title"
                  className="text-center text-xl font-bold text-white"
                >
                  Exit app?
                </h2>

                <div className="mt-6 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={
                      cancelExit
                    }
                    disabled={
                      isExiting
                    }
                    className="min-w-[96px] rounded-full bg-white/10 px-6 py-2.5 text-sm font-bold text-white transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    No
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      void confirmExit();
                    }}
                    disabled={
                      isExiting
                    }
                    className="min-w-[96px] rounded-full bg-white px-6 py-2.5 text-sm font-bold text-black transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Yes
                  </button>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <UsernameSetupModal
        open={
          !launchVisible &&
          !hasCompletedProfileSetup
        }
        onSave={
          setUsername
        }
      />

      <AnimatePresence>
        {launchVisible ? (
          <LaunchScreen />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function App() {
  return (
    <ProfileProvider>
      <PlayerProvider>
        <div className="flex h-full w-full items-center justify-center bg-black">
          <div className="relative mx-auto flex h-full max-h-[900px] w-full max-w-[430px] flex-col overflow-hidden bg-[#121212] shadow-2xl sm:h-[900px] sm:rounded-[2.5rem] sm:border-8 sm:border-neutral-900">
            <AppShell />

            <Toaster
              theme="dark"
              position="top-center"
              toastOptions={{
                style: {
                  background:
                    "#282828",
                  color:
                    "#fff",
                  border:
                    "none",
                },
              }}
            />
          </div>
        </div>
      </PlayerProvider>
    </ProfileProvider>
  );
}