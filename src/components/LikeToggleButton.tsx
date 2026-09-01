import React from "react";

import {
  AnimatePresence,
  motion,
} from "framer-motion";

import {
  CirclePlusIcon,
  HeartIcon,
} from "lucide-react";

import {
  usePlayer,
} from "../context/PlayerContext";

interface Props {
  songId: string;
  size?: number;
  className?: string;
}

export function LikeToggleButton({
  songId,
  size = 20,
  className = "",
}: Props) {
  const {
    likedSongIds,
    toggleLikedSong,
  } = usePlayer();

  const liked =
    likedSongIds.includes(songId);

  function handleToggleLike(
    event:
      React.MouseEvent<HTMLButtonElement>
  ): void {
    event.preventDefault();
    event.stopPropagation();

    toggleLikedSong(songId);
  }

  const buttonClassName =
    liked
      ? "text-[#1DB954]"
      : "text-white/85";

  return (
    <motion.button
      type="button"
      onClick={handleToggleLike}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      whileTap={{
        scale: 0.88,
      }}
      aria-label={
        liked
          ? "Remove from Liked Songs"
          : "Add to Liked Songs"
      }
      aria-pressed={liked}
      className={`relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/35 ${buttonClassName} ${className}`}
      style={{
        WebkitTapHighlightColor:
          "transparent",
      }}
    >
      <AnimatePresence
        mode="wait"
        initial={false}
      >
        {liked ? (
          <motion.span
            key="liked"
            initial={{
              opacity: 0,
              scale: 0.35,
              rotate: -18,
            }}
            animate={{
              opacity: 1,
              scale: [0.35, 1.22, 0.94, 1],
              rotate: [-18, 7, -3, 0],
            }}
            exit={{
              opacity: 0,
              scale: 0.55,
              rotate: 12,
            }}
            transition={{
              duration: 0.42,
              times: [
                0,
                0.42,
                0.72,
                1,
              ],
              ease: [
                0.22,
                1,
                0.36,
                1,
              ],
            }}
            className="flex items-center justify-center"
            aria-hidden="true"
          >
            <HeartIcon
              size={size}
              strokeWidth={2.2}
              fill="currentColor"
            />
          </motion.span>
        ) : (
          <motion.span
            key="unliked"
            initial={{
              opacity: 0,
              scale: 0.55,
              rotate: 14,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              rotate: 0,
            }}
            exit={{
              opacity: 0,
              scale: 0.45,
              rotate: -12,
            }}
            transition={{
              duration: 0.22,
              ease: [
                0.22,
                1,
                0.36,
                1,
              ],
            }}
            className="flex items-center justify-center"
            aria-hidden="true"
          >
            <CirclePlusIcon
              size={size + 2}
              strokeWidth={2}
            />
          </motion.span>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {liked ? (
          <motion.span
            key="like-burst"
            className="pointer-events-none absolute inset-0 rounded-full border border-[#1DB954]/60"
            initial={{
              opacity: 0.7,
              scale: 0.6,
            }}
            animate={{
              opacity: 0,
              scale: 1.55,
            }}
            exit={{
              opacity: 0,
            }}
            transition={{
              duration: 0.45,
              ease: "easeOut",
            }}
            aria-hidden="true"
          />
        ) : null}
      </AnimatePresence>
    </motion.button>
  );
}