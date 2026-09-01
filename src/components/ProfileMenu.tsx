import React, {
  useState,
} from "react";

import {
  AnimatePresence,
  motion,
} from "framer-motion";

import {
  SettingsIcon,
  SparklesIcon,
  UserIcon,
} from "lucide-react";

import {
  useProfile,
} from "../context/ProfileContext";

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenTrivia: () => void;
}

export function ProfileMenu({
  open,
  onClose,
  onOpenSettings,
  onOpenTrivia,
}: Props) {
  const {
    username,
  } = useProfile();

  const [
    pendingSettingsOpen,
    setPendingSettingsOpen,
  ] = useState(false);

  const [
    pendingTriviaOpen,
    setPendingTriviaOpen,
  ] = useState(false);

  function handleOpenSettings(): void {
    setPendingSettingsOpen(true);
    onClose();
  }

  function handleOpenTrivia(): void {
    setPendingTriviaOpen(true);
    onClose();
  }

  function handleExitComplete(): void {
    if (pendingSettingsOpen) {
      setPendingSettingsOpen(false);
      onOpenSettings();
      return;
    }

    if (pendingTriviaOpen) {
      setPendingTriviaOpen(false);
      onOpenTrivia();
    }
  }

  return (
    <AnimatePresence
      onExitComplete={
        handleExitComplete
      }
    >
      {open ? (
        <div
          key="profile-drawer-root"
          className="fixed inset-0 z-[100]"
        >
          {/* Tap the revealed Home area to close */}
          <button
            type="button"
            aria-label="Close profile menu"
            onClick={onClose}
            className="absolute inset-0 border-0 bg-black/45 p-0"
            style={{
              WebkitTapHighlightColor:
                "transparent",
            }}
          />

          {/* Left drawer */}
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-title"
            className="absolute inset-y-0 left-0 flex w-[84%] max-w-[360px] flex-col overflow-hidden border-r border-white/10 bg-neutral-950 shadow-[18px_0_50px_rgba(0,0,0,0.48)]"
            initial={{
              x: "-100%",
            }}
            animate={{
              x: 0,
            }}
            exit={{
              x: "-100%",
            }}
            transition={{
              type: "spring",
              stiffness: 360,
              damping: 34,
              mass: 0.85,
            }}
            drag="x"
            dragDirectionLock
            dragMomentum={false}
            dragConstraints={{
              left: 0,
              right: 0,
            }}
            dragElastic={{
              left: 0.45,
              right: 0.04,
            }}
            onDragEnd={(
              _event,
              info
            ) => {
              const swipedLeft =
                info.offset.x < -70 ||
                info.velocity.x < -500;

              if (swipedLeft) {
                onClose();
              }
            }}
          >
            <div className="flex-1 overflow-y-auto px-5 pb-6 pt-[max(1.25rem,env(safe-area-inset-top))]">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/10">
                  <UserIcon
                    size={22}
                    className="text-white"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    id="profile-title"
                    className="truncate text-lg font-bold text-white"
                  >
                    {username}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <button
                  type="button"
                  onClick={
                    handleOpenSettings
                  }
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-3.5 text-left transition-colors hover:bg-white/5 active:bg-white/10"
                  aria-label="Open settings and privacy"
                  style={{
                    WebkitTapHighlightColor:
                      "transparent",
                  }}
                >
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/5">
                    <SettingsIcon
                      size={21}
                      className="text-neutral-300"
                    />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">
                      Settings & Privacy
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={
                    handleOpenTrivia
                  }
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-3.5 text-left transition-colors hover:bg-white/5 active:bg-white/10"
                  aria-label="Open Music Trivia"
                  style={{
                    WebkitTapHighlightColor:
                      "transparent",
                  }}
                >
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/5">
                    <SparklesIcon
                      size={21}
                      className="text-neutral-300"
                    />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">
                      Music Trivia
                    </span>
                  </span>
                </button>
              </div>
            </div>
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
