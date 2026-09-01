import React, {
  useEffect,
  useState,
} from "react";

import {
  AnimatePresence,
  motion,
} from "framer-motion";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  InfoIcon,
  SlidersHorizontalIcon,
  UserIcon,
} from "lucide-react";

import { toast } from "sonner";

import {
  useProfile,
} from "../context/ProfileContext";

interface Props {
  onBack: () => void;
}

interface ToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
}

const RECENTLY_PLAYED_AUTO_SCROLL_KEY =
  "audio-beat-home-recently-played-auto-scroll";

const TOP_ARTISTS_AUTO_SCROLL_KEY =
  "audio-beat-home-top-artists-auto-scroll";

const HOME_CAROUSEL_SETTINGS_EVENT =
  "audio-beat-home-carousel-settings-changed";

function loadBooleanSetting(
  key: string,
  fallback: boolean
): boolean {
  try {
    const saved =
      window.localStorage.getItem(
        key
      );

    return saved === null
      ? fallback
      : saved === "true";
  } catch {
    return fallback;
  }
}

function saveBooleanSetting(
  key: string,
  value: boolean
): void {
  try {
    window.localStorage.setItem(
      key,
      String(value)
    );

    window.dispatchEvent(
      new Event(
        HOME_CAROUSEL_SETTINGS_EVENT
      )
    );
  } catch (error) {
    console.error(
      "Unable to save Home scrolling preference:",
      error
    );
  }
}

function Toggle({
  value,
  onChange,
  label,
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      onClick={() =>
        onChange(!value)
      }
      className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
        value
          ? "bg-[#1DB954]"
          : "bg-neutral-600"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
          value
            ? "left-[22px]"
            : "left-0.5"
        }`}
      />
    </button>
  );
}

export function SettingsScreen({
  onBack,
}: Props) {
  const {
    username,
    setUsername,
  } = useProfile();

  const [
    editUsernameOpen,
    setEditUsernameOpen,
  ] = useState<boolean>(false);

  const [
    editedUsername,
    setEditedUsername,
  ] = useState<string>(username);

  const [
    recentlyPlayedAutoScroll,
    setRecentlyPlayedAutoScroll,
  ] = useState<boolean>(
    () =>
      loadBooleanSetting(
        RECENTLY_PLAYED_AUTO_SCROLL_KEY,
        true
      )
  );

  const [
    topArtistsAutoScroll,
    setTopArtistsAutoScroll,
  ] = useState<boolean>(
    () =>
      loadBooleanSetting(
        TOP_ARTISTS_AUTO_SCROLL_KEY,
        true
      )
  );

  const [
    editViewport,
    setEditViewport,
  ] = useState<{
    top: number;
    height: number;
  } | null>(
    null
  );

  useEffect(() => {
    if (editUsernameOpen) {
      setEditedUsername(
        username
      );
    }
  }, [
    editUsernameOpen,
    username,
  ]);

  useEffect(() => {
    if (!editUsernameOpen) {
      setEditViewport(null);
      return;
    }

    const visualViewport =
      window.visualViewport;

    function updateEditViewport():
      void {
      if (visualViewport) {
        setEditViewport({
          top:
            visualViewport.offsetTop,
          height:
            visualViewport.height,
        });

        return;
      }

      setEditViewport({
        top: 0,
        height:
          window.innerHeight,
      });
    }

    updateEditViewport();

    if (!visualViewport) {
      window.addEventListener(
        "resize",
        updateEditViewport
      );

      return () => {
        window.removeEventListener(
          "resize",
          updateEditViewport
        );
      };
    }

    visualViewport.addEventListener(
      "resize",
      updateEditViewport
    );

    visualViewport.addEventListener(
      "scroll",
      updateEditViewport
    );

    return () => {
      visualViewport.removeEventListener(
        "resize",
        updateEditViewport
      );

      visualViewport.removeEventListener(
        "scroll",
        updateEditViewport
      );
    };
  }, [
    editUsernameOpen,
  ]);

  function handleSaveUsername(): void {
    const trimmedName =
      editedUsername.trim();

    if (!trimmedName) {
      return;
    }

    setUsername(
      trimmedName
    );

    setEditUsernameOpen(
      false
    );

    toast.success(
      "Username updated"
    );
  }

  function handleRecentlyPlayedAutoScroll(
    value: boolean
  ): void {
    setRecentlyPlayedAutoScroll(
      value
    );

    saveBooleanSetting(
      RECENTLY_PLAYED_AUTO_SCROLL_KEY,
      value
    );
  }

  function handleTopArtistsAutoScroll(
    value: boolean
  ): void {
    setTopArtistsAutoScroll(
      value
    );

    saveBooleanSetting(
      TOP_ARTISTS_AUTO_SCROLL_KEY,
      value
    );
  }

  return (
    <>
      <motion.div
        className="absolute inset-0 z-40 flex flex-col overflow-y-auto bg-[#121212] no-scrollbar"
        initial={{
          x: "100%",
        }}
        animate={{
          x: 0,
        }}
        exit={{
          x: "100%",
        }}
        transition={{
          type: "spring",
          damping: 32,
          stiffness: 320,
        }}
      >
        <div className="sticky top-0 z-10 flex items-center gap-3 bg-[#121212]/95 px-4 py-4 backdrop-blur">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="text-white"
          >
            <ChevronLeftIcon
              size={26}
            />
          </button>

          <h1 className="text-xl font-bold text-white">
            Settings & Privacy
          </h1>
        </div>

        <div className="px-4 pb-12">
          <Section
            icon={UserIcon}
            title="Account"
          >
            <button
              type="button"
              onClick={() =>
                setEditUsernameOpen(
                  true
                )
              }
              className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-white/5 active:bg-white/10"
            >
              <span className="min-w-0">
                <span className="block text-sm text-white">
                  Username
                </span>

                <span className="mt-0.5 block truncate text-xs text-neutral-500">
                  {username}
                </span>
              </span>

              <ChevronRightIcon
                size={18}
                className="flex-shrink-0 text-neutral-500"
              />
            </button>
          </Section>

          <Section
            icon={SlidersHorizontalIcon}
            title="Home"
          >
            <ToggleRow
              label="Recently played auto-scroll"
              description={
                recentlyPlayedAutoScroll
                  ? "Automatic scrolling"
                  : "Manual scrolling"
              }
              value={
                recentlyPlayedAutoScroll
              }
              onChange={
                handleRecentlyPlayedAutoScroll
              }
            />

            <ToggleRow
              label="Top artists auto-scroll"
              description={
                topArtistsAutoScroll
                  ? "Automatic scrolling"
                  : "Manual scrolling"
              }
              value={
                topArtistsAutoScroll
              }
              onChange={
                handleTopArtistsAutoScroll
              }
            />
          </Section>

          <Section
            icon={InfoIcon}
            title="About"
          >
            <AboutRow
              label="App"
              value="Audio Beat"
            />

            <AboutRow
              label="Version"
              value="1.0.0"
            />

            <AboutRow
              label="Lyrics"
              value="LRCLIB"
            />

            <AboutRow
              label="Cloud support"
              value="Cloudinary"
            />

            <AboutRow
              label="Artist images"
              value="TheAudioDB"
            />

            <AboutRow
              label="Android Auto"
              value="Supported"
            />

            <AboutRow
              label="Local music"
              value="Supported"
            />
          </Section>

        </div>
      </motion.div>

      <AnimatePresence>
        {editUsernameOpen ? (
          <motion.div
            key="edit-username-overlay"
            className="fixed inset-0 z-[140]"
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
          >
            <button
              type="button"
              aria-label="Close change username"
              onClick={() =>
                setEditUsernameOpen(
                  false
                )
              }
              className="absolute inset-0 border-0 bg-black/65 p-0"
            />

            <div
              className="pointer-events-none fixed left-0 right-0 z-10 flex items-center justify-center px-4 py-3"
              style={{
                top:
                  editViewport?.top ??
                  0,
                height:
                  editViewport?.height ??
                  window.innerHeight,
              }}
            >
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="edit-username-title"
                className="pointer-events-auto w-full max-w-[390px] max-h-full -translate-y-10 overflow-y-auto rounded-3xl border border-white/10 bg-neutral-900 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.62)] no-scrollbar"
                initial={{
                  opacity: 0,
                  scale: 0.94,
                }}
                animate={{
                  opacity: 1,
                  scale: 1,
                }}
                exit={{
                  opacity: 0,
                  scale: 0.94,
                }}
                transition={{
                  duration: 0.2,
                  ease: "easeOut",
                }}
              >
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSaveUsername();
                }}
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                  <UserIcon
                    size={24}
                    className="text-white"
                  />
                </div>

                <h2
                  id="edit-username-title"
                  className="mt-4 text-center text-xl font-bold text-white"
                >
                  Change username
                </h2>

                <input
                  autoFocus
                  autoComplete="name"
                  value={editedUsername}
                  onChange={(event) =>
                    setEditedUsername(
                      event.target.value
                    )
                  }
                  maxLength={40}
                  placeholder="Enter your name"
                  className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-base font-semibold text-white outline-none placeholder:text-neutral-600 focus:border-[#1DB954]"
                />

                <div className="mt-5 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setEditUsernameOpen(
                        false
                      )
                    }
                    className="rounded-full px-6 py-2.5 text-sm font-bold text-white transition hover:bg-white/10 active:scale-95"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      !editedUsername.trim()
                    }
                    className="rounded-full bg-[#1DB954] px-7 py-2.5 text-sm font-bold text-black transition hover:bg-[#1ed760] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Save
                  </button>
                </div>
              </form>
              </motion.div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

interface SectionProps {
  icon: typeof UserIcon;
  title: string;
  children: React.ReactNode;
}

function Section({
  icon: Icon,
  title,
  children,
}: SectionProps) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-neutral-400">
        <Icon size={14} />

        {title}
      </h2>

      <div className="overflow-hidden rounded-xl bg-white/5">
        {children}
      </div>
    </section>
  );
}

interface ToggleRowProps {
  label: string;
  description: string;
  value: boolean;
  onChange: (
    value: boolean
  ) => void;
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
}: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/5 px-4 py-3.5 last:border-b-0">
      <span className="min-w-0">
        <span className="block text-sm text-white">
          {label}
        </span>

        <span className="mt-0.5 block text-xs text-neutral-500">
          {description}
        </span>
      </span>

      <Toggle
        value={value}
        onChange={onChange}
        label={label}
      />
    </div>
  );
}

interface AboutRowProps {
  label: string;
  value: string;
}

function AboutRow({
  label,
  value,
}: AboutRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/5 px-4 py-3.5 last:border-b-0">
      <span className="text-sm text-white">
        {label}
      </span>

      <span className="max-w-[55%] text-right text-sm text-neutral-400">
        {value}
      </span>
    </div>
  );
}
