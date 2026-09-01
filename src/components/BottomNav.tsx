import React from "react";

import {
  motion,
} from "framer-motion";

import {
  Disc3Icon,
  HomeIcon,
  SearchIcon,
  Library as LibraryIcon,
} from "lucide-react";

export type Tab =
  | "home"
  | "search"
  | "albums"
  | "library";

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
}

const items: {
  key: Tab;
  label: string;
  Icon: typeof HomeIcon;
}[] = [
  {
    key: "home",
    label: "Home",
    Icon: HomeIcon,
  },
  {
    key: "search",
    label: "Search",
    Icon: SearchIcon,
  },
  {
    key: "albums",
    label: "Albums",
    Icon: Disc3Icon,
  },
  {
    key: "library",
    label: "Your Library",
    Icon: LibraryIcon,
  },
];

export function BottomNav({
  active,
  onChange,
}: Props) {
  return (
    <nav
      className="flex items-stretch justify-around border-t border-white/5 bg-black/95 px-1 pb-2 pt-3 backdrop-blur"
      aria-label="Primary"
    >
      {items.map(
        ({
          key,
          label,
          Icon,
        }) => {
          const isActive =
            active === key;

          return (
            <motion.button
              key={key}
              type="button"
              onClick={() =>
                onChange(key)
              }
              aria-current={
                isActive
                  ? "page"
                  : undefined
              }
              className="group pointer-events-auto relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl py-2 outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              whileTap={{
                scale: 0.94,
              }}
              transition={{
                type: "spring",
                stiffness: 420,
                damping: 24,
              }}
            >
              <motion.span
                className="relative flex h-8 w-8 items-center justify-center"
                animate={
                  isActive
                    ? {
                        y: -4,
                        scale: 1.16,
                      }
                    : {
                        y: 0,
                        scale: 1,
                      }
                }
                transition={{
                  type: "spring",
                  stiffness: 380,
                  damping: 20,
                }}
              >
                {isActive ? (
                  <motion.span
                    className="absolute inset-0 rounded-full bg-white/10 blur-md"
                    initial={{
                      opacity: 0,
                      scale: 0.6,
                    }}
                    animate={{
                      opacity: [
                        0,
                        0.85,
                        0.35,
                      ],
                      scale: [
                        0.6,
                        1.35,
                        1,
                      ],
                    }}
                    transition={{
                      duration: 0.5,
                      ease: "easeOut",
                    }}
                    aria-hidden="true"
                  />
                ) : null}

                <motion.span
                  animate={
                    isActive
                      ? {
                          rotate: [
                            0,
                            -8,
                            7,
                            0,
                          ],
                        }
                      : {
                          rotate: 0,
                        }
                  }
                  transition={{
                    duration: 0.42,
                    ease: "easeOut",
                  }}
                  className="relative"
                >
                  <Icon
                    size={24}
                    strokeWidth={
                      isActive
                        ? 2.6
                        : 2
                    }
                    className={
                      isActive
                        ? "text-white drop-shadow-[0_4px_8px_rgba(255,255,255,0.18)]"
                        : "text-neutral-400 drop-shadow-[0_2px_5px_rgba(0,0,0,0.65)] transition-colors duration-200 group-hover:text-neutral-200"
                    }
                  />
                </motion.span>
              </motion.span>

              <motion.span
                animate={{
                  y: isActive
                    ? -2
                    : 0,
                  opacity: isActive
                    ? 1
                    : 0.78,
                }}
                transition={{
                  duration: 0.2,
                }}
                className={`max-w-full truncate text-[10px] font-medium drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${
                  isActive
                    ? "text-white"
                    : "text-neutral-300"
                }`}
              >
                {label}
              </motion.span>
            </motion.button>
          );
        }
      )}
    </nav>
  );
}